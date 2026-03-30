/**
 * ============================================
 * ФАЙЛ: js/components/widgets/my-tasks-widget.js
 * РОЛЬ: Виджет "Мои задачи" для дашборда
 * 
 * ОСОБЕННОСТИ:
 *   - Отображает задачи текущего пользователя
 *   - Быстрое изменение статуса задачи (чекбокс)
 *   - Автообновление при создании/изменении задач
 * 
 * ЗАВИСИМОСТИ:
 *   - js/components/widget.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание виджета
 *   - 30.03.2026: Исправлен рендер
 * ============================================
 */

import Widget from '../widget.js';
import { getTasks, updateTask } from '../../services/tasks-supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

console.log('[my-tasks-widget] Загрузка виджета...');

class MyTasksWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.settings = {
            limit: options.settings?.limit || 10,
            showCompleted: options.settings?.showCompleted || false,
            statusFilter: options.settings?.statusFilter || 'pending,in_progress',
            ...options.settings
        };
        
        this.user = null;
        this.tasks = [];
        
        console.log('[my-tasks-widget] Виджет создан');
    }
    
    async fetchData() {
        const cached = this.getCachedData();
        if (cached && !this.options.forceRefresh) {
            this.tasks = cached;
            return cached;
        }
        
        this.user = getCurrentSupabaseUser();
        if (!this.user) {
            throw new Error('Пользователь не авторизован');
        }
        
        const allTasks = await getTasks();
        
        let filteredTasks = allTasks.filter(task => 
            task.assigned_to === this.user.github_username
        );
        
        if (this.settings.statusFilter) {
            const allowedStatuses = this.settings.statusFilter.split(',');
            filteredTasks = filteredTasks.filter(task => 
                allowedStatuses.includes(task.status)
            );
        }
        
        if (!this.settings.showCompleted) {
            filteredTasks = filteredTasks.filter(task => 
                task.status !== 'completed'
            );
        }
        
        const today = new Date().toISOString().split('T')[0];
        filteredTasks.sort((a, b) => {
            const aOverdue = a.due_date && a.due_date < today && a.status !== 'completed';
            const bOverdue = b.due_date && b.due_date < today && b.status !== 'completed';
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            if (a.due_date && b.due_date) {
                return a.due_date.localeCompare(b.due_date);
            }
            if (a.due_date) return -1;
            if (b.due_date) return 1;
            
            return 0;
        });
        
        if (this.settings.limit > 0) {
            filteredTasks = filteredTasks.slice(0, this.settings.limit);
        }
        
        this.tasks = filteredTasks;
        this.cacheData(this.tasks, 2 * 60 * 1000);
        
        return this.tasks;
    }
    
    // Полностью переопределяем render - НЕ вызываем super.render()
    async render() {
        if (!this.container) return;
        
        // Загружаем данные если их нет
        if (this.tasks.length === 0) {
            await this.fetchData();
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        // Создаем HTML напрямую
        const html = `
            <div style="height: 100%; display: flex; flex-direction: background: var(--card-bg); border-radius: 16px;">
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tasks" style="color: var(--accent);"></i>
                        <span style="font-weight: 600;">Мои задачи</span>
                        ${this.tasks.length > 0 ? `<span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px;">${this.tasks.length}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="widget-refresh-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="widget-settings-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="widget-expand-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>
                <div style="flex: 1; padding: 16px; overflow-y: auto;">
                    ${this.renderTasksList(today)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.bindEvents();
        this.setupEventListeners();
    }
    
    renderTasksList(today) {
        if (this.tasks.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 32px; opacity: 0.5;"></i>
                    <span>Нет задач</span>
                    <small>Отличная работа! 🎉</small>
                </div>
            `;
        }
        
        return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${this.tasks.map(task => {
                    const isOverdue = task.due_date && task.due_date < today && task.status !== 'completed';
                    
                    return `
                        <div data-task-id="${task.id}" style="padding: 10px; background: var(--hover-bg); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
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
                                ${task.priority === 'high' ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,107,107,0.2); color: #ff6b6b;">Высокий</span>' : ''}
                                ${task.priority === 'medium' ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,193,7,0.2); color: #ffc107;">Средний</span>' : ''}
                                ${isOverdue ? '<span style="font-size: 10px; padding: 2px 6px; border-radius: 12px; background: rgba(255,107,107,0.2); color: #ff6b6b;">Просрочена</span>' : ''}
                            </div>
                            <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-left: 28px;">
                                ${task.due_date ? `<span><i class="far fa-calendar-alt"></i> ${task.due_date}</span>` : ''}
                                <span><i class="fas fa-tag"></i> ${task.status === 'completed' ? 'Завершена' : task.status === 'in_progress' ? 'В работе' : 'Ожидает'}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${this.tasks.length >= this.settings.limit ? `
                <div style="margin-top: 12px; text-align: center; padding-top: 8px;">
                    <a href="tasks-supabase.html" style="color: var(--accent); font-size: 12px; text-decoration: none;">
                        Все задачи <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            ` : ''}
        `;
    }
    
    bindEvents() {
        const refreshBtn = this.container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refresh();
        }
        
        const settingsBtn = this.container.querySelector('.widget-settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = () => {
                const newLimit = prompt('Количество задач:', this.settings.limit);
                if (newLimit && !isNaN(parseInt(newLimit))) {
                    this.settings.limit = parseInt(newLimit);
                    this.clearCache();
                    this.refresh();
                }
            };
        }
        
        const expandBtn = this.container.querySelector('.widget-expand-btn');
        if (expandBtn) {
            expandBtn.onclick = () => window.location.href = 'tasks-supabase.html';
        }
        
        const items = this.container.querySelectorAll('[data-task-id]');
        items.forEach(item => {
            item.onclick = (e) => {
                if (e.target.classList?.contains('task-checkbox')) return;
                const taskId = item.dataset.taskId;
                if (taskId) {
                    console.log('Открыть задачу:', taskId);
                }
            };
        });
        
        const checkboxes = this.container.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.onchange = async (e) => {
                e.stopPropagation();
                const taskId = checkbox.dataset.taskId;
                const isChecked = checkbox.checked;
                
                try {
                    await updateTask(taskId, {
                        status: isChecked ? 'completed' : 'pending',
                        completed_at: isChecked ? new Date().toISOString() : null
                    });
                    await this.refresh();
                } catch (error) {
                    console.error('Ошибка:', error);
                    checkbox.checked = !isChecked;
                }
            };
        });
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
        
        this.setAutoRefresh(5 * 60 * 1000);
    }
    
    async refresh() {
        this.clearCache();
        this.loading = true;
        try {
            await this.fetchData();
            await this.render();
            this.loading = false;
        } catch (error) {
            console.error(error);
            this.loading = false;
        }
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
