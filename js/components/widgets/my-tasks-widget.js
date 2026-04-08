/**
 * ============================================
 * ФАЙЛ: js/components/widgets/my-tasks-widget.js
 * РОЛЬ: Виджет "Мои задачи" для дашборда
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание виджета
 *   - 30.03.2026: Полный рефакторинг рендера
 *   - 30.03.2026: Исправлена ошибка зависания при загрузке
 * ============================================
 */

import Widget from '../widget.js';
import { getTasks, updateTask } from '../../services/tasks-supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

console.log('[my-tasks-widget] Загрузка...');

class MyTasksWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.settings = {
            limit: options.settings?.limit || 10,
            showCompleted: false,
            statusFilter: 'pending,in_progress',
            ...options.settings
        };
        
        this.user = null;
        this.tasks = [];
        
        // Отключаем автообновление в конструкторе
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('[my-tasks-widget] Создан');
    }
    
    async loadTasks() {
        this.user = getCurrentSupabaseUser();
        if (!this.user) {
            console.warn('[my-tasks-widget] Пользователь не авторизован');
            this.tasks = [];
            return [];
        }
        
        try {
            const allTasks = await getTasks();
            
            // Фильтруем задачи: назначенные пользователю ИЛИ созданные им
            let filtered = allTasks.filter(task => 
                task.assigned_to === this.user.github_username ||
                task.user_id === this.user.id ||
                (!task.assigned_to && task.user_id === this.user.id)
            );
            
            if (this.settings.statusFilter) {
                const statuses = this.settings.statusFilter.split(',');
                filtered = filtered.filter(task => statuses.includes(task.status));
            }
            
            if (!this.settings.showCompleted) {
                filtered = filtered.filter(task => task.status !== 'completed');
            }
            
            const today = new Date().toISOString().split('T')[0];
            filtered.sort((a, b) => {
                const aOverdue = a.due_date && a.due_date < today && a.status !== 'completed';
                const bOverdue = b.due_date && b.due_date < today && b.status !== 'completed';
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                if (a.due_date) return -1;
                if (b.due_date) return 1;
                return 0;
            });
            
            if (this.settings.limit > 0) {
                filtered = filtered.slice(0, this.settings.limit);
            }
            
            this.tasks = filtered;
            console.log(`[my-tasks-widget] Загружено ${filtered.length} задач из ${allTasks.length}`);
            return this.tasks;
            
        } catch (error) {
            console.error('[my-tasks-widget] Ошибка загрузки задач:', error);
            this.tasks = [];
            return [];
        }
    }
    
    // Полностью переопределяем render - НИКАКОГО super.render()
    async render() {
        console.log('[my-tasks-widget] Рендер...');
        
        if (!this.container) return;
        
        // Загружаем задачи с обработкой ошибок
        await this.loadTasks();
        
        const today = new Date().toISOString().split('T')[0];
        
        const html = `
            <div class="my-tasks-widget" style="height: 100%; display: flex; flex-direction: column; background: var(--card-bg); border-radius: 16px;">
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tasks" style="color: var(--accent);"></i>
                        <span style="font-weight: 600;">Мои задачи</span>
                        ${this.tasks.length > 0 ? `<span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px;">${this.tasks.length}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="refresh-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Обновить">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="settings-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Настройки">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="expand-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Все задачи">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>
                <div style="flex: 1; padding: 16px; overflow-y: auto;">
                    ${this.renderTasks(today)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.attachEvents();
    }
    
    renderTasks(today) {
        if (!this.user) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); text-align: center;">
                    <i class="fas fa-user-lock" style="font-size: 32px;"></i>
                    <div>Не удалось загрузить пользователя</div>
                    <button class="retry-auth-btn" style="margin-top: 8px; padding: 6px 12px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer;">Повторить</button>
                </div>
            `;
        }
        
        if (this.tasks.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 32px;"></i>
                    <div>Нет активных задач</div>
                    <small>Отличная работа! 🎉</small>
                </div>
            `;
        }
        
        return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${this.tasks.map(task => {
                    const isOverdue = task.due_date && task.due_date < today && task.status !== 'completed';
                    
                    return `
                        <div class="task-item" data-task-id="${task.id}" style="padding: 10px; background: var(--hover-bg); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                            <div style="display: flex; align-items: flex-start; gap: 8px;">
                                <input type="checkbox" 
                                       class="task-checkbox" 
                                       data-task-id="${task.id}"
                                       ${task.status === 'completed' ? 'checked' : ''}
                                       onclick="event.stopPropagation()"
                                       style="margin-top: 2px; cursor: pointer;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                                        <span style="${task.status === 'completed' ? 'text-decoration: line-through; opacity: 0.7;' : ''} font-weight: 500;">
                                            ${window.escapeHtml ? window.escapeHtml(task.title) : task.title}
                                        </span>
                                        ${task.priority === 'high' ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,107,107,0.2); color: #ff6b6b;">Высокий</span>' : ''}
                                        ${task.priority === 'medium' ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,193,7,0.2); color: #ffc107;">Средний</span>' : ''}
                                        ${isOverdue ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,107,107,0.2); color: #ff6b6b;">Просрочена</span>' : ''}
                                    </div>
                                    <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted);">
                                        ${task.due_date ? `<span><i class="far fa-calendar-alt"></i> ${task.due_date}</span>` : ''}
                                        <span><i class="fas fa-tag"></i> ${task.status === 'completed' ? '✅ Завершена' : task.status === 'in_progress' ? '🔄 В работе' : '⏳ Ожидает'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${this.tasks.length >= this.settings.limit ? `
                <div style="margin-top: 12px; text-align: center; padding-top: 8px;">
                    <a href="tasks-supabase.html" style="color: var(--accent); font-size: 12px; text-decoration: none;">
                        Показать все задачи → 
                    </a>
                </div>
            ` : ''}
        `;
    }
    
    attachEvents() {
        // Кнопка обновления
        const refreshBtn = this.container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refresh();
        }
        
        // Кнопка настроек
        const settingsBtn = this.container.querySelector('.settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = () => {
                const val = prompt('Количество задач (0 - все):', this.settings.limit);
                if (val !== null) {
                    const limit = parseInt(val);
                    if (!isNaN(limit)) {
                        this.settings.limit = limit;
                        this.render();
                    }
                }
            };
        }
        
        // Кнопка развернуть
        const expandBtn = this.container.querySelector('.expand-btn');
        if (expandBtn) {
            expandBtn.onclick = () => {
                window.location.href = 'tasks-supabase.html';
            };
        }
        
        // Кнопка повторной авторизации
        const retryAuthBtn = this.container.querySelector('.retry-auth-btn');
        if (retryAuthBtn) {
            retryAuthBtn.onclick = () => this.refresh();
        }
        
        // Чекбоксы задач
        const checkboxes = this.container.querySelectorAll('.task-checkbox');
        checkboxes.forEach(cb => {
            cb.onchange = async (e) => {
                e.stopPropagation();
                const taskId = cb.dataset.taskId;
                const isChecked = cb.checked;
                
                try {
                    await updateTask(taskId, {
                        status: isChecked ? 'completed' : 'pending',
                        completed_at: isChecked ? new Date().toISOString() : null
                    });
                    await this.render();
                } catch (error) {
                    console.error('[my-tasks-widget] Ошибка обновления:', error);
                    cb.checked = !isChecked;
                }
            };
        });
        
        // Клик по задаче
        const items = this.container.querySelectorAll('.task-item');
        items.forEach(item => {
            item.onclick = (e) => {
                if (e.target.classList?.contains('task-checkbox')) return;
                const taskId = item.dataset.taskId;
                console.log('[my-tasks-widget] Открыть задачу:', taskId);
                // TODO: открыть модалку
            };
        });
    }
    
    async refresh() {
        console.log('[my-tasks-widget] Обновление...');
        await this.render();
    }
}

// Регистрируем
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
    console.log('[my-tasks-widget] ✅ Зарегистрирован');
}

export default MyTasksWidget;
