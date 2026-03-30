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
 *   - 30.03.2026: Исправлен вызов render()
 * ============================================
 */

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
    
    // Переопределяем render - не вызываем super.render()
    async render() {
        if (!this.container) return;
        
        // Если данные еще не загружены, загружаем
        if (!this.tasks.length && !this.loading) {
            await this.fetchData();
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const html = `
            <div class="widget" style="height: 100%; display: flex; flex-direction: column;">
                <div class="widget-header" style="padding: 12px 16px; border-bottom: 1px solid var(--card-border);">
                    <div class="widget-title" style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tasks" style="color: var(--accent);"></i>
                        <span style="font-weight: 600;">Мои задачи</span>
                        ${this.tasks.length > 0 ? `<span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px;">${this.tasks.length}</span>` : ''}
                    </div>
                    <div class="widget-actions" style="display: flex; gap: 8px;">
                        <button class="widget-refresh-btn" title="Обновить" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="widget-settings-btn" title="Настройки" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="widget-expand-btn" title="Все задачи" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-body" style="flex: 1; padding: 16px; overflow-y: auto;">
                    ${this.renderTasksList(today)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Привязываем обработчики
        this.bindEvents();
        
        // Подписываемся на события
        this.setupEventListeners();
    }
    
    renderTasksList(today) {
        if (this.tasks.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 32px; opacity: 0.5;"></i>
                    <span>Нет задач для отображения</span>
                    <small style="margin-top: 8px;">Отличная работа! 🎉</small>
                </div>
            `;
        }
        
        return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${this.tasks.map(task => {
                    const isOverdue = task.due_date && task.due_date < today && task.status !== 'completed';
                    const priorityClass = this.getPriorityClass(task.priority);
                    
                    return `
                        <div class="widget-list-item" data-task-id="${task.id}" style="padding: 10px; background: var(--hover-bg); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                <input type="checkbox" 
                                       class="task-checkbox" 
                                       ${task.status === 'completed' ? 'checked' : ''}
                                       data-task-id="${task.id}"
                                       onclick="event.stopPropagation()"
                                       style="cursor: pointer;">
                                <span style="${task.status === 'completed' ? 'text-decoration: line-through; opacity: 0.7;' : ''} font-weight: 500; flex: 1;">
                                    ${window.escapeHtml(task.title)}
                                </span>
                                ${task.priority !== 'low' ? `<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: ${priorityClass === 'widget-status-high' ? 'rgba(255,107,107,0.2)' : 'rgba(255,193,7,0.2)'}; color: ${priorityClass === 'widget-status-high' ? '#ff6b6b' : '#ffc107'};">${this.getPriorityText(task.priority)}</span>` : ''}
                                ${isOverdue ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,107,107,0.2); color: #ff6b6b;">Просрочена</span>' : ''}
                            </div>
                            <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-left: 28px;">
                                ${task.due_date ? `<span><i class="far fa-calendar-alt"></i> ${window.formatDate ? window.formatDate(task.due_date) : task.due_date}</span>` : ''}
                                <span><i class="fas fa-tag"></i> ${this.getStatusText(task.status)}</span>
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
            
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            await updateTask(taskId, {
                status: newStatus,
                completed_at: completed ? new Date().toISOString() : null
            });
            
            task.status = newStatus;
            if (completed) {
                task.completed_at = new Date().toISOString();
            } else {
                task.completed_at = null;
            }
            
            await this.render();
            
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.emit('task:updated', task);
            }
            
            this.showNotification(
                completed ? '✅ Задача завершена!' : '🔄 Задача восстановлена',
                'success'
            );
            
        } catch (error) {
            console.error('[my-tasks-widget] Ошибка:', error);
            this.showNotification('❌ Ошибка при изменении статуса', 'error');
            await this.refresh();
        }
    }
    
    openTask(taskId) {
        console.log('[my-tasks-widget] Открываем задачу:', taskId);
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
    
    getStatusText(status) {
        switch (status) {
            case 'completed': return 'Завершена';
            case 'in_progress': return 'В работе';
            case 'pending': return 'Ожидает';
            default: return status;
        }
    }
    
    setupEventListeners() {
        if (!window.CRM?.EventBus) return;
        
        this.subscribe('task:created', (task) => {
            if (task.assigned_to === this.user?.github_username) {
                this.refresh();
            }
        });
        
        this.subscribe('task:updated', (task) => {
            if (task.assigned_to === this.user?.github_username) {
                this.refresh();
            }
        });
        
        this.subscribe('task:deleted', (taskId) => {
            const hadTask = this.tasks.some(t => t.id === taskId);
            if (hadTask) {
                this.refresh();
            }
        });
        
        this.setAutoRefresh(5 * 60 * 1000);
    }
    
    async refresh() {
        this.clearCache();
        this.loading = true;
        this.showLoading();
        try {
            await this.fetchData();
            await this.render();
            this.loading = false;
        } catch (error) {
            console.error('[my-tasks-widget] Ошибка:', error);
            this.showError(error.message);
            this.loading = false;
        }
    }
}

// Регистрируем виджет
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
    console.log('[my-tasks-widget] ✅ Виджет зарегистрирован');
}

export default MyTasksWidget;
