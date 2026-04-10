
/**
 * ============================================
 * ФАЙЛ: js/components/task-kanban.js
 * РОЛЬ: Компонент канбан-доски задач
 * 
 * ОСОБЕННОСТИ:
 *   - Полностью независимый компонент
 *   - Фильтрация по поиску, исполнителю, приоритету, объекту
 *   - Drag-and-drop для изменения статуса
 *   - Статистика задач
 *   - Коллбэки для внешнего взаимодействия (edit, delete)
 *   - Чистые ES6, без глобальных функций
 * 
 * ЗАВИСИМОСТИ:
 *   - js/services/tasks-supabase.js (getTasks, updateTaskStatus)
 *   - js/components/kanban.js (createTaskCard)
 *   - js/utils/helpers.js (escapeHtml)
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из tasks.js в отдельный компонент
 * ============================================
 */

import { getTasks, updateTaskStatus, TASK_CATEGORIES } from '../services/tasks-supabase.js';
import { createTaskCard } from './kanban.js';
import { escapeHtml } from '../utils/helpers.js';

export class TaskKanban {
    // Приватные поля
    #tasks = [];
    #users = [];
    #currentUser = null;
    #filters = {
        search: '',
        assignee: 'all',
        priority: 'all',
        complex: 'all',
        quick: 'all'
    };
    
    // Коллбэки
    #callbacks = {
        onEdit: null,      // (taskId) => void
        onDelete: null,    // (taskId) => void
        onAdd: null        // (status) => void
    };
    
    // DOM элементы
    #elements = {};
    
    // Флаг инициализации
    #initialized = false;

    /**
     * @param {Object} callbacks - Коллбэки для внешнего взаимодействия
     * @param {Function} callbacks.onEdit - Вызывается при клике на редактирование задачи
     * @param {Function} callbacks.onDelete - Вызывается при клике на удаление задачи
     * @param {Function} callbacks.onAdd - Вызывается при клике на "Добавить задачу" в колонке
     */
    constructor(callbacks = {}) {
        this.#callbacks = { ...this.#callbacks, ...callbacks };
    }

    /**
     * Инициализация компонента
     * @param {Object} currentUser - Текущий пользователь
     * @param {Array} users - Список пользователей (для фильтров)
     */
    async init(currentUser, users = []) {
        if (this.#initialized) {
            console.warn('[task-kanban] Уже инициализирован');
            return;
        }
        
        this.#currentUser = currentUser;
        this.#users = users;
        
        this.#cacheDomElements();
        this.#bindEvents();
        
        await this.refresh();
        
        this.#initialized = true;
        console.log('[task-kanban] Инициализирован');
    }

    /**
     * Кэширование DOM элементов
     */
    #cacheDomElements() {
        this.#elements = {
            // Контейнеры колонок
            todoContainer: document.getElementById('todoTasks'),
            progressContainer: document.getElementById('progressTasks'),
            doneContainer: document.getElementById('doneTasks'),
            
            // Счётчики
            todoCount: document.getElementById('todoCount'),
            progressCount: document.getElementById('progressCount'),
            doneCount: document.getElementById('doneCount'),
            
            // Статистика
            statTotal: document.getElementById('statTotal'),
            statPending: document.getElementById('statPending'),
            statProgress: document.getElementById('statProgress'),
            statCompleted: document.getElementById('statCompleted'),
            statCompletion: document.getElementById('statCompletion'),
            statProgressFill: document.getElementById('statProgressFill'),
            
            // Фильтры
            searchInput: document.getElementById('searchInput'),
            assigneeFilters: document.getElementById('assigneeFilters'),
            priorityFilters: document.querySelectorAll('.priority-filter'),
            quickFilterBtns: document.querySelectorAll('.quick-filter-btn'),
            complexFilter: document.getElementById('complexFilter'),
            
            // Кнопки добавления в колонках
            addTaskBtns: document.querySelectorAll('.add-task-btn')
        };
    }

    /**
     * Привязка событий
     */
    #bindEvents() {
        // Поиск с debounce
        if (this.#elements.searchInput) {
            this.#elements.searchInput.addEventListener('input', this.#debounce(() => {
                this.#filters.search = this.#elements.searchInput.value;
                this.#renderKanbanBoard();
            }, 300));
        }
        
        // Быстрые фильтры
        this.#elements.quickFilterBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.#elements.quickFilterBtns?.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.#filters.quick = btn.dataset.quick;
                this.#renderKanbanBoard();
            });
        });
        
        // Приоритет (toggle)
        this.#elements.priorityFilters?.forEach(btn => {
            btn.addEventListener('click', () => {
                const priority = btn.dataset.priority;
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    this.#filters.priority = 'all';
                } else {
                    this.#elements.priorityFilters?.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.#filters.priority = priority;
                }
                this.#renderKanbanBoard();
            });
        });
        
        // Кнопки "Добавить задачу" в колонках
        this.#elements.addTaskBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.dataset.status;
                if (this.#callbacks.onAdd) {
                    this.#callbacks.onAdd(status);
                }
            });
        });
        
        // Drag-and-drop колонки
        this.#setupDropZones();
        
        // Обновление фильтра по исполнителю (вызывается снаружи при изменении users)
        this.#renderAssigneeFilters();
    }

    /**
     * Обновить фильтр по исполнителю
     */
    #renderAssigneeFilters() {
        const container = this.#elements.assigneeFilters;
        if (!container) return;
        
        let html = `
            <div class="assignee-filter ${this.#filters.assignee === 'all' ? 'active' : ''}" data-assignee="all">
                <div class="assignee-avatar">👥</div>
                <span class="assignee-name">Все</span>
            </div>
        `;
        
        for (const user of this.#users) {
            if (user.github_username === this.#currentUser?.github_username) continue;
            const isActive = this.#filters.assignee === user.github_username;
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            
            html += `
                <div class="assignee-filter ${isActive ? 'active' : ''}" data-assignee="${user.github_username}">
                    <div class="assignee-avatar">${initials}</div>
                    <span class="assignee-name">${escapeHtml(user.name.split(' ')[0])}</span>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Навешиваем обработчики
        container.querySelectorAll('.assignee-filter').forEach(el => {
            el.addEventListener('click', () => {
                container.querySelectorAll('.assignee-filter').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                this.#filters.assignee = el.dataset.assignee;
                this.#renderKanbanBoard();
            });
        });
    }

    /**
     * Настройка зон для drag-and-drop
     */
    #setupDropZones() {
        const columns = document.querySelectorAll('.kanban-column');
        
        columns.forEach(column => {
            const status = column.dataset.status;
            if (!status) return;
            
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', (e) => {
                const related = e.relatedTarget;
                if (!related || !column.contains(related)) {
                    column.classList.remove('drag-over');
                }
            });
            
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                column.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                if (!taskId) return;
                
                const task = this.#tasks.find(t => t.id == taskId);
                if (!task || task.status === status) return;
                
                const updated = await updateTaskStatus(taskId, status);
                if (updated) {
                    await this.refresh();
                    this.#showToast('success', 'Задача перемещена');
                }
            });
        });
    }

    /**
     * Получить отфильтрованные задачи
     */
    #getFilteredTasks() {
        let filtered = [...this.#tasks];
        
        // Поиск
        if (this.#filters.search) {
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(this.#filters.search.toLowerCase())
            );
        }
        
        // Исполнитель
        if (this.#filters.assignee !== 'all') {
            filtered = filtered.filter(t => t.assigned_to === this.#filters.assignee);
        }
        
        // Приоритет
        if (this.#filters.priority !== 'all') {
            filtered = filtered.filter(t => t.priority === this.#filters.priority);
        }
        
        // Быстрые фильтры
        if (this.#filters.quick !== 'all') {
            const today = new Date().toISOString().split('T')[0];
            switch (this.#filters.quick) {
                case 'my':
                    filtered = filtered.filter(t => t.assigned_to === this.#currentUser?.github_username);
                    break;
                case 'overdue':
                    filtered = filtered.filter(t => {
                        if (t.status === 'completed') return false;
                        if (!t.due_date) return false;
                        return t.due_date < today;
                    });
                    break;
                case 'today':
                    filtered = filtered.filter(t => t.due_date === today);
                    break;
                case 'high':
                    filtered = filtered.filter(t => t.priority === 'high');
                    break;
            }
        }
        
        return filtered;
    }

    /**
     * Рендеринг канбан-доски
     */
    #renderKanbanBoard() {
        const { todoContainer, progressContainer, doneContainer } = this.#elements;
        
        if (!todoContainer || !progressContainer || !doneContainer) return;
        
        // Очистка
        todoContainer.innerHTML = '';
        progressContainer.innerHTML = '';
        doneContainer.innerHTML = '';
        
        const filteredTasks = this.#getFilteredTasks();
        
        let todoCount = 0, progressCount = 0, doneCount = 0;
        
        for (const task of filteredTasks) {
            const card = createTaskCard(task, {
                showDelete: true,
                showEdit: true
            });
            
            // Клик на карточку = редактирование
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.task-btn')) {
                    if (this.#callbacks.onEdit) {
                        this.#callbacks.onEdit(task.id);
                    }
                }
            });
            
            // Кнопка редактирования
            const editBtn = card.querySelector('.task-edit-btn');
            if (editBtn) {
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.#callbacks.onEdit) {
                        this.#callbacks.onEdit(task.id);
                    }
                };
            }
            
            // Кнопка удаления
            const deleteBtn = card.querySelector('.task-delete-btn');
            if (deleteBtn) {
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.#callbacks.onDelete) {
                        this.#callbacks.onDelete(task.id);
                    }
                };
            }
            
            // Добавление в колонку
            if (task.status === 'pending') {
                todoContainer.appendChild(card);
                todoCount++;
            } else if (task.status === 'in_progress') {
                progressContainer.appendChild(card);
                progressCount++;
            } else if (task.status === 'completed') {
                doneContainer.appendChild(card);
                doneCount++;
            }
        }
        
        // Обновление счётчиков
        if (this.#elements.todoCount) this.#elements.todoCount.textContent = todoCount;
        if (this.#elements.progressCount) this.#elements.progressCount.textContent = progressCount;
        if (this.#elements.doneCount) this.#elements.doneCount.textContent = doneCount;
        
        this.#updateStats(filteredTasks);
    }

    /**
     * Обновление статистики
     */
    #updateStats(filteredTasks) {
        const total = filteredTasks.length;
        const pending = filteredTasks.filter(t => t.status === 'pending').length;
        const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
        const completed = filteredTasks.filter(t => t.status === 'completed').length;
        const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const { statTotal, statPending, statProgress, statCompleted, statCompletion, statProgressFill } = this.#elements;
        
        if (statTotal) statTotal.textContent = total;
        if (statPending) statPending.textContent = pending;
        if (statProgress) statProgress.textContent = inProgress;
        if (statCompleted) statCompleted.textContent = completed;
        if (statCompletion) statCompletion.textContent = completionPercent + '%';
        if (statProgressFill) statProgressFill.style.width = completionPercent + '%';
    }

    /**
     * Показать уведомление
     */
    #showToast(type, message) {
        // Используем глобальную функцию, если есть, или создаём свою
        if (window.CRM?.helpers?.showToast) {
            window.CRM.helpers.showToast(type, message);
        } else {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    /**
     * Debounce для поиска
     */
    #debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

    /**
     * Обновить данные и перерисовать доску
     */
    async refresh() {
        this.#tasks = await getTasks();
        this.#renderKanbanBoard();
        console.log(`[task-kanban] Обновлено, задач: ${this.#tasks.length}`);
    }

    /**
     * Обновить список пользователей (для фильтров)
     */
    updateUsers(users) {
        this.#users = users;
        this.#renderAssigneeFilters();
    }

    /**
     * Получить текущие задачи
     */
    getTasks() {
        return [...this.#tasks];
    }

    /**
     * Получить задачу по ID
     */
    getTaskById(id) {
        return this.#tasks.find(t => t.id == id);
    }

    /**
     * Уничтожить компонент (очистка)
     */
    destroy() {
        // Очистка слушателей, если нужно
        console.log('[task-kanban] Уничтожен');
        this.#initialized = false;
    }
}

export default TaskKanban;
