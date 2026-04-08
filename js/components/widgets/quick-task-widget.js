/**
 * ============================================
 * ФАЙЛ: js/components/widgets/quick-task-widget.js
 * РОЛЬ: Виджет быстрого создания задачи
 * ТАРИФ: FREE
 * 
 * ФУНКЦИОНАЛ:
 *   - Поле для ввода названия задачи
 *   - Выбор приоритета (низкий/средний/высокий)
 *   - Быстрое создание задачи
 *   - Отображение статуса создания
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Создание виджета
 * ============================================
 */

import { supabase } from '../../core/supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';
import BaseWidget from './base-widget.js';

console.log('[quick-task-widget] Загрузка...');

class QuickTaskWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.currentUser = null;
        this.isCreating = false;
    }
    
    async render() {
        try {
            this.showLoading();
            this.currentUser = getCurrentSupabaseUser();
            
            if (!this.currentUser) {
                this.showError('Пользователь не авторизован');
                return;
            }
            
            this.renderContent();
        } catch (error) {
            console.error('[quick-task-widget] Ошибка рендеринга:', error);
            this.showError('Ошибка загрузки виджета');
        }
    }
    
    renderContent() {
        this.container.innerHTML = `
            <div class="quick-task-widget" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="quick-task-input-group">
                    <input 
                        type="text" 
                        id="quickTaskInput" 
                        placeholder="Введите название задачи..." 
                        style="width: 100%; padding: 12px; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 12px; color: var(--text-primary); font-size: 14px; transition: all 0.2s;"
                        autocomplete="off"
                    >
                </div>
                
                <div class="quick-task-priority" style="display: flex; gap: 8px;">
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="radio" name="quickTaskPriority" value="low" style="display: none;">
                        <span class="priority-badge priority-low" data-priority="low" style="padding: 6px 12px; border-radius: 20px; background: rgba(76, 175, 80, 0.2); color: #4caf50; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-flag"></i> Низкий
                        </span>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="radio" name="quickTaskPriority" value="medium" checked style="display: none;">
                        <span class="priority-badge priority-medium active" data-priority="medium" style="padding: 6px 12px; border-radius: 20px; background: rgba(255, 193, 7, 0.2); color: #ffc107; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-flag"></i> Средний
                        </span>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="radio" name="quickTaskPriority" value="high" style="display: none;">
                        <span class="priority-badge priority-high" data-priority="high" style="padding: 6px 12px; border-radius: 20px; background: rgba(255, 107, 107, 0.2); color: #ff6b6b; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-flag"></i> Высокий
                        </span>
                    </label>
                </div>
                
                <button id="quickTaskCreateBtn" class="quick-task-create-btn" style="padding: 12px; background: var(--accent); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    <i class="fas fa-plus"></i> Создать задачу
                </button>
                
                <div id="quickTaskStatus" class="quick-task-status" style="min-height: 24px; font-size: 13px;"></div>
                
                <div id="quickTaskLastCreated" class="quick-task-last-created" style="display: none; padding: 12px; background: var(--hover-bg); border-radius: 12px; border-left: 3px solid var(--accent);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Последняя созданная задача:</div>
                    <div id="lastTaskTitle" style="font-weight: 500; margin-bottom: 4px;"></div>
                    <div id="lastTaskMeta" style="font-size: 11px; color: var(--text-muted);"></div>
                </div>
            </div>
        `;
        
        this.bindEvents();
        this.loadLastCreatedTask();
    }
    
    bindEvents() {
        const input = this.container.querySelector('#quickTaskInput');
        const createBtn = this.container.querySelector('#quickTaskCreateBtn');
        const priorityBadges = this.container.querySelectorAll('.priority-badge');
        const radioInputs = this.container.querySelectorAll('input[name="quickTaskPriority"]');
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !this.isCreating) {
                    this.createTask();
                }
            });
            
            input.focus();
        }
        
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (!this.isCreating) {
                    this.createTask();
                }
            });
        }
        
        priorityBadges.forEach(badge => {
            badge.addEventListener('click', () => {
                const priority = badge.dataset.priority;
                const radio = this.container.querySelector(`input[value="${priority}"]`);
                if (radio) {
                    radio.checked = true;
                    
                    priorityBadges.forEach(b => {
                        b.classList.remove('active');
                        b.style.boxShadow = 'none';
                        b.style.transform = 'scale(1)';
                    });
                    
                    badge.classList.add('active');
                    badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    badge.style.transform = 'scale(1.02)';
                }
            });
        });
    }
    
    async createTask() {
        const input = this.container.querySelector('#quickTaskInput');
        const title = input?.value?.trim();
        
        if (!title) {
            this.showStatus('Введите название задачи', 'error');
            input?.focus();
            return;
        }
        
        const selectedPriority = this.container.querySelector('input[name="quickTaskPriority"]:checked');
        const priority = selectedPriority?.value || 'medium';
        
        this.isCreating = true;
        const createBtn = this.container.querySelector('#quickTaskCreateBtn');
        
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        }
        
        this.showStatus('Создание задачи...', 'info');
        
        try {
            const taskData = {
                user_id: this.currentUser.id,
                title: title,
                description: null,
                status: 'pending',
                priority: priority,
                due_date: null,
                category: 'general',
                is_important: priority === 'high',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single();
            
            if (error) throw error;
            
            this.showStatus('Задача создана успешно', 'success');
            
            if (input) {
                input.value = '';
            }
            
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.emit('task:created', data);
            }
            
            this.showLastCreatedTask(data);
            
            setTimeout(() => {
                this.showStatus('', '');
                if (input) input.focus();
            }, 2000);
            
        } catch (error) {
            console.error('[quick-task-widget] Ошибка создания задачи:', error);
            this.showStatus('Ошибка создания задачи', 'error');
        } finally {
            this.isCreating = false;
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.innerHTML = '<i class="fas fa-plus"></i> Создать задачу';
            }
        }
    }
    
    showStatus(message, type) {
        const statusEl = this.container.querySelector('#quickTaskStatus');
        if (!statusEl) return;
        
        if (!message) {
            statusEl.innerHTML = '';
            return;
        }
        
        const colors = {
            'info': 'var(--text-muted)',
            'success': '#4caf50',
            'error': '#ff6b6b'
        };
        
        const icons = {
            'info': '<i class="fas fa-info-circle"></i>',
            'success': '<i class="fas fa-check-circle"></i>',
            'error': '<i class="fas fa-exclamation-circle"></i>'
        };
        
        statusEl.innerHTML = `
            <span style="color: ${colors[type]}; display: flex; align-items: center; gap: 6px;">
                ${icons[type]} ${message}
            </span>
        `;
    }
    
    showLastCreatedTask(task) {
        const container = this.container.querySelector('#quickTaskLastCreated');
        const titleEl = this.container.querySelector('#lastTaskTitle');
        const metaEl = this.container.querySelector('#lastTaskMeta');
        
        if (!container || !titleEl || !metaEl) return;
        
        const priorityNames = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий'
        };
        
        const priorityColors = {
            'low': '#4caf50',
            'medium': '#ffc107',
            'high': '#ff6b6b'
        };
        
        titleEl.textContent = task.title;
        metaEl.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span style="display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-flag" style="color: ${priorityColors[task.priority]};"></i>
                    ${priorityNames[task.priority]}
                </span>
                <span style="display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-clock"></i>
                    ${new Date(task.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </span>
        `;
        
        container.style.display = 'block';
    }
    
    async loadLastCreatedTask() {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('[quick-task-widget] Ошибка загрузки последней задачи:', error);
                }
                return;
            }
            
            if (data) {
                this.showLastCreatedTask(data);
            }
        } catch (error) {
            console.error('[quick-task-widget] Ошибка загрузки последней задачи:', error);
        }
    }
    
    async refresh() {
        await this.loadLastCreatedTask();
    }
    
    destroy() {
        console.log('[quick-task-widget] Уничтожение виджета');
    }
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.QuickTaskWidget = QuickTaskWidget;
}

export default QuickTaskWidget;
