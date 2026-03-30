/**
 * ============================================
 * ФАЙЛ: js/components/widgets/my-tasks-widget.js
 * РОЛЬ: Виджет "Мои задачи" для дашборда
 * 
 * ОСОБЕННОСТИ:
 *   - Отображает задачи текущего пользователя
 *   - Возможность фильтрации по статусу
 *   - Быстрое изменение статуса задачи (чекбокс)
 *   - Переход к задаче по клику
 *   - Автообновление при создании/изменении задач
 * 
 * ЗАВИСИМОСТИ:
 *   - js/components/widget.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание виджета
 * ============================================
 */

// Правильный импорт базового класса
import Widget from '../widget.js';
import { getTasks, updateTask } from '../../services/tasks-supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

console.log('[my-tasks-widget] Загрузка виджета...');

class MyTasksWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        // Настройки по умолчанию
        this.settings = {
            limit: options.settings?.limit || 10,
            showCompleted: options.settings?.showCompleted || false,
            statusFilter: options.settings?.statusFilter || 'pending,in_progress',
            ...options.settings
        };
        
        this.user = null;
        this.tasks = [];
        
        console.log('[my-tasks-widget] Виджет создан, настройки:', this.settings);
    }
    
    async fetchData() {
        // Проверяем кэш
        const cached = this.getCachedData();
        if (cached && !this.options.forceRefresh) {
            console.log('[my-tasks-widget] Используем кэшированные данные');
            this.tasks = cached;
            return cached;
        }
        
        // Получаем текущего пользователя
        this.user = getCurrentSupabaseUser();
        if (!this.user) {
            throw new Error('Пользователь не авторизован');
        }
        
        console.log('[my-tasks-widget] Загружаем задачи для пользователя:', this.user.name);
        
        // Загружаем все задачи
        const allTasks = await getTasks();
        
        // Фильтруем по assigned_to (github_username)
        let filteredTasks = allTasks.filter(task => 
            task.assigned_to === this.user.github_username
        );
        
        // Фильтр по статусу
        if (this.settings.statusFilter) {
            const allowedStatuses = this.settings.statusFilter.split(',');
            filteredTasks = filteredTasks.filter(task => 
                allowedStatuses.includes(task.status)
            );
        }
        
        // Исключаем завершенные если нужно
        if (!this.settings.showCompleted) {
            filteredTasks = filteredTasks.filter(task => 
                task.status !== 'completed'
            );
        }
        
        // Сортируем: сначала просроченные, потом по дате
        const today = new Date().toISOString().split('T')[0];
        filteredTasks.sort((a, b) => {
            // Просроченные вверх
            const aOverdue = a.due_date && a.due_date < today && a.status !== 'completed';
            const bOverdue = b.due_date && b.due_date < today && b.status !== 'completed';
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            // По дате
            if (a.due_date && b.due_date) {
                return a.due_date.localeCompare(b.due_date);
            }
            if (a.due_date) return -1;
            if (b.due_date) return 1;
            
            return 0;
        });
        
        // Ограничиваем количество
        if (this.settings.limit > 0) {
            filteredTasks = filteredTasks.slice(0, this.settings.limit);
        }
        
        this.tasks = filteredTasks;
        
        // Сохраняем в кэш на 2 минуты
        this.cacheData(this.tasks, 2 * 60 * 1000);
        
        console.log('[my-tasks-widget] Загружено задач:', this.tasks.length);
        return this.tasks;
    }
    
    async render() {
        if (!this.container) return;
        
        const today = new Date().toISOString().split('T')[0];
        
        const html = `
            <div class="widget">
                <div class="widget-header">
                    <div class="widget-title">
                        <i class="fas fa-tasks"></i>
                        Мои задачи
                        ${this.tasks.length > 0 ? `<span class="widget-badge" style="margin-left: 8px; background: var(--accent); color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px;">${this.tasks.length}</span>` : ''}
                    </div>
                    <div class="widget-actions">
                        <button class="widget-refresh-btn" title="Обновить">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="widget-settings-btn" title="Настройки">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="widget-expand-btn" title="Все задачи">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-body">
                    ${this.renderTasksList(today)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Привязываем обработчики
        this.bindEvents();
    }
    
    renderTasksList(today) {
        if (this.tasks.length === 0) {
            return `
                <div class="widget-empty">
                    <i class="fas fa-check-circle"></i>
                    <span>Нет задач для отображения</span>
                    <small style="margin-top: 8px; display: block;">Отличная работа! 🎉</small>
                </div>
            `;
        }
        
        return `
            <div class="widget-list">
                ${this.tasks.map(task => {
                    const isOverdue = task.due_date && task.due_date < today && task.status !== 'completed';
                    const priorityClass = this.getPriorityClass(task.priority);
                    const statusClass = this.getStatusClass(task.status);
                    
                    return `
                        <div class="widget-list-item" data-task-id="${task.id}" data-task-status="${task.status}" style="cursor: pointer;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <input type="checkbox" 
                                           class="task-checkbox" 
                                           ${task.status === 'completed' ? 'checked' : ''}
                                           data-task-id="${task.id}"
                                           onclick="event.stopPropagation()"
                                           style="cursor: pointer;">
                                    <span style="${task.status === 'completed' ? 'text-decoration: line-through; opacity: 0.7;' : ''} font-weight: 500;">
                                        ${window.escapeHtml(task.title)}
                                    </span>
                                    ${task.priority !== 'low' ? `<span class="widget-status ${priorityClass}" style="font-size: 10px; padding: 2px 6px;">${this.getPriorityText(task.priority)}</span>` : ''}
                                    ${isOverdue ? '<span class="widget-status widget-status-high" style="font-size: 10px; padding: 2px 6px;">Просрочена</span>' : ''}
                                </div>
                                <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted);">
                                    ${task.due_date ? `<span><i class="far fa-calendar-alt"></i> ${window.formatDate ? window.formatDate(task.due_date) : task.due_date}</span>` : ''}
                                    <span><i class="fas fa-tag"></i> ${this.getStatusText(task.status)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${this.tasks.length >= this.settings.limit ? `
                <div style="margin-top: 12px; text-align: center; padding-top: 8px; border-top: 1px solid var(--card-border);">
                    <a href="tasks-supabase.html" style="color: var(--accent); font-size: 12px; text-decoration: none;">
                        Показать все задачи <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            ` : ''}
        `;
    }
    
    bindEvents() {
        // Обновление по кнопке
        const refreshBtn = this.container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = (e) => {
                e.stopPropagation();
                this.refresh();
            };
        }
        
        // Настройки
        const settingsBtn = this.container.querySelector('.widget-settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = (e) => {
                e.stopPropagation();
                this.showSettings();
            };
        }
        
        // Развернуть (перейти на страницу задач)
        const expandBtn = this.container.querySelector('.widget-expand-btn');
        if (expandBtn) {
            expandBtn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'tasks-supabase.html';
            };
        }
        
        // Клик по задаче
        const items = this.container.querySelectorAll('.widget-list-item');
        items.forEach(item => {
            item.onclick = (e) => {
                // Не открываем если кликнули на чекбокс
                if (e.target.classList && e.target.classList.contains('task-checkbox')) {
                    return;
                }
                const taskId = item.dataset.taskId;
                if (taskId) {
                    this.openTask(taskId);
                }
            };
        });
        
        // Чекбоксы
        const checkboxes = this.container.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.onchange = async (e) => {
                e.stopPropagation();
                const taskId = checkbox.dataset.taskId;
                const isChecked = checkbox.checked;
                await this.toggleTaskStatus(taskId, isChecked);
            };
        });
    }
    
    async toggleTaskStatus(taskId, completed) {
        try {
            const newStatus = completed ? 'completed' : 'pending';
            
            // Находим задачу
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Обновляем в БД
            await updateTask(taskId, {
                status: newStatus,
                completed_at: completed ? new Date().toISOString() : null
            });
            
            // Обновляем локально
            task.status = newStatus;
            if (completed) {
                task.completed_at = new Date().toISOString();
            } else {
                task.completed_at = null;
            }
            
            // Перерисовываем
            await this.render();
            
            // Отправляем событие
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.emit('task:updated', task);
            }
            
            this.showNotification(
                completed ? '✅ Задача завершена!' : '🔄 Задача восстановлена',
                'success'
            );
            
        } catch (error) {
            console.error('[my-tasks-widget] Ошибка изменения статуса:', error);
            this.showNotification('❌ Ошибка при изменении статуса', 'error');
            // Возвращаем чекбокс в исходное состояние
            await this.refresh();
        }
    }
    
    openTask(taskId) {
        console.log('[my-tasks-widget] Открываем задачу:', taskId);
        // TODO: открыть модальное окно с задачей
        this.showNotification(`📋 Задача #${taskId.slice(0, 8)}`, 'info');
    }
    
    showSettings() {
        const newLimit = prompt('Количество задач для отображения (0 - все):', this.settings.limit);
        if (newLimit !== null) {
            const limit = parseInt(newLimit);
            if (!isNaN(limit)) {
                this.settings.limit = limit;
                this.clearCache();
                this.refresh();
            }
        }
    }
    
    getPriorityClass(priority) {
        switch (priority) {
            case 'high': return 'widget-status-high';
            case 'medium': return 'widget-status-medium';
            case 'low': return 'widget-status-low';
            default: return '';
        }
    }
    
    getPriorityText(priority) {
        switch (priority) {
            case 'high': return 'Высокий';
            case 'medium': return 'Средний';
            case 'low': return 'Низкий';
            default: return priority;
        }
    }
    
    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'widget-status-completed';
            case 'in_progress': return 'widget-status-in_progress';
            case 'pending': return 'widget-status-pending';
            default: return '';
        }
    }
    
    getStatusText(status) {
        switch (status) {
            case 'completed': return 'Завершена';
            case 'in_progress': return 'В работе';
            case 'pending': return 'Ожидает';
            default: return status;
        }
    }
    
    // Подписка на события
    setupEventListeners() {
        if (!window.CRM?.EventBus) return;
        
        // Обновляем при создании задачи
        this.subscribe('task:created', (task) => {
            if (task.assigned_to === this.user?.github_username) {
                this.refresh();
            }
        });
        
        // Обновляем при изменении задачи
        this.subscribe('task:updated', (task) => {
            if (task.assigned_to === this.user?.github_username) {
                this.refresh();
            }
        });
        
        // Обновляем при удалении задачи
        this.subscribe('task:deleted', (taskId) => {
            const hadTask = this.tasks.some(t => t.id === taskId);
            if (hadTask) {
                this.refresh();
            }
        });
        
        // Автообновление каждые 5 минут
        this.setAutoRefresh(5 * 60 * 1000);
    }
    
    async refresh() {
        this.clearCache();
        await super.refresh();
    }
    
    async render() {
        await super.render();
        this.setupEventListeners();
    }
}

// Регистрируем виджет в глобальном объекте
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
    console.log('[my-tasks-widget] Виджет зарегистрирован в window.CRM.Widgets');
}

export default MyTasksWidget;
