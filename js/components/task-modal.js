/**
 * ============================================
 * ФАЙЛ: js/components/task-modal.js
 * РОЛЬ: Компонент модального окна задачи
 * 
 * ОСОБЕННОСТИ:
 *   - Создание и редактирование задач
 *   - Комментарии с @упоминаниями
 *   - Автокомплит для @упоминаний
 *   - Приватные задачи, категории, важное
 *   - Полностью независимый компонент
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/tasks-supabase.js
 *   - js/utils/helpers.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из tasks.js в отдельный компонент
 *   - 10.04.2026: ИСПРАВЛЕНО: убраны приватные методы из bind()
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getTaskById, 
    createTask, 
    updateTask, 
    TASK_CATEGORIES 
} from '../services/tasks-supabase.js';
import { escapeHtml, formatDate, showToast } from '../utils/helpers.js';

export class TaskModal {
    // Приватные поля
    #currentUser = null;
    #users = [];
    #currentTaskId = null;
    #currentTaskComments = [];
    #onSaved = null;
    
    // Состояние автокомплита
    #mentionSuggestions = [];
    #activeSuggestionIndex = -1;
    
    // DOM элементы
    #elements = {};
    #modal = null;
    
    // Флаг инициализации
    #initialized = false;

    /**
     * @param {Function} onSaved - Коллбэк, вызываемый после успешного сохранения задачи
     */
    constructor(onSaved = null) {
        this.#onSaved = onSaved;
        console.log('[task-modal] Конструктор');
    }

    /**
     * Инициализация компонента
     * @param {Object} currentUser - Текущий пользователь
     * @param {Array} users - Список пользователей (для @упоминаний)
     */
    init(currentUser, users = []) {
        if (this.#initialized) {
            console.warn('[task-modal] Уже инициализирован');
            return;
        }
        
        this.#currentUser = currentUser;
        this.#users = users;
        
        this.#cacheDomElements();
        this.#bindEvents();
        
        this.#initialized = true;
        console.log('[task-modal] Инициализирован');
    }

    /**
     * Кэширование DOM элементов
     */
    #cacheDomElements() {
        this.#modal = document.getElementById('taskModal');
        if (!this.#modal) {
            console.error('[task-modal] Модальное окно #taskModal не найдено');
            return;
        }
        
        this.#elements = {
            title: document.getElementById('modalTitleText'),
            taskId: document.getElementById('taskId'),
            taskTitle: document.getElementById('taskTitle'),
            taskDescription: document.getElementById('taskDescription'),
            taskCategory: document.getElementById('taskCategory'),
            taskDueDate: document.getElementById('taskDueDate'),
            taskImportant: document.getElementById('taskImportant'),
            taskStatus: document.getElementById('taskStatus'),
            taskPrivate: document.getElementById('taskPrivate'),
            dynamicFields: document.getElementById('dynamicFields'),
            commentsSection: document.getElementById('commentsSection'),
            commentsCount: document.getElementById('commentsCount'),
            commentsList: document.getElementById('commentsList'),
            newComment: document.getElementById('newComment'),
            commentsToggleIcon: document.getElementById('commentsToggleIcon'),
            commentsBody: document.getElementById('commentsBody'),
            mentionSuggestions: document.getElementById('mentionSuggestions'),
            closeBtn: this.#modal.querySelector('.modal-close'),
            cancelBtn: this.#modal.querySelector('#cancelModalBtn, .secondary'),
            saveBtn: this.#modal.querySelector('#saveTaskBtn, .primary'),
            addCommentBtn: document.getElementById('addCommentBtn'),
            commentsHeader: document.getElementById('commentsHeader')
        };
        
        console.log('[task-modal] DOM элементы закэшированы');
    }

    /**
     * Привязка событий
     */
    #bindEvents() {
        // Закрытие модалки
        if (this.#elements.closeBtn) {
            this.#elements.closeBtn.addEventListener('click', () => this.#close());
        }
        if (this.#elements.cancelBtn) {
            this.#elements.cancelBtn.addEventListener('click', () => this.#close());
        }
        
        // Сохранение
        if (this.#elements.saveBtn) {
            this.#elements.saveBtn.addEventListener('click', () => this.#save());
        }
        
        // Закрытие по клику вне модалки
        this.#modal?.addEventListener('click', (e) => {
            if (e.target === this.#modal) this.#close();
        });
        
        // Поле комментария
        const newComment = this.#elements.newComment;
        if (newComment) {
            newComment.addEventListener('input', (e) => this.#handleCommentInput(e));
            newComment.addEventListener('keydown', (e) => this.#handleCommentKeydown(e));
            newComment.addEventListener('blur', () => this.#handleCommentBlur());
        }
        
        // Кнопка отправки комментария
        if (this.#elements.addCommentBtn) {
            this.#elements.addCommentBtn.addEventListener('click', () => this.#addComment());
        }
        
        // Аккордеон комментариев
        if (this.#elements.commentsHeader) {
            this.#elements.commentsHeader.addEventListener('click', () => this.#toggleComments());
        }
        
        // Скрытие подсказок при скролле
        window.addEventListener('scroll', () => this.#hideMentionSuggestions(), true);
        
        console.log('[task-modal] События привязаны');
    }

    // ========== УПРАВЛЕНИЕ МОДАЛКОЙ ==========

    /**
     * Открыть модальное окно
     */
    async open(taskId = null, presets = {}) {
        if (!this.#initialized) {
            console.error('[task-modal] Не инициализирован');
            return;
        }
        
        console.log('[task-modal] Открытие, taskId:', taskId);
        
        this.#currentTaskId = taskId;
        this.#currentTaskComments = [];
        this.#hideMentionSuggestions();
        
        await this.#renderAssigneeField();
        
        if (taskId) {
            this.#elements.title.textContent = 'Редактировать задачу';
            
            const task = await getTaskById(taskId);
            if (task) {
                this.#elements.taskId.value = task.id;
                this.#elements.taskTitle.value = task.title || '';
                this.#elements.taskDescription.value = task.description || '';
                this.#elements.taskCategory.value = task.category || 'other';
                this.#elements.taskDueDate.value = task.due_date || '';
                this.#elements.taskImportant.checked = task.is_important || false;
                this.#elements.taskStatus.value = task.status || 'pending';
                this.#elements.taskPrivate.checked = task.is_private || false;
                
                setTimeout(() => {
                    const assigneeSelect = document.getElementById('taskAssignee');
                    if (assigneeSelect) assigneeSelect.value = task.assigned_to || '';
                }, 50);
                
                await this.#loadComments(task.id);
            }
        } else {
            this.#elements.title.textContent = 'Создать задачу';
            
            this.#elements.taskId.value = '';
            this.#elements.taskTitle.value = '';
            this.#elements.taskDescription.value = '';
            this.#elements.taskCategory.value = 'other';
            this.#elements.taskDueDate.value = '';
            this.#elements.taskImportant.checked = false;
            this.#elements.taskStatus.value = presets.status || 'pending';
            this.#elements.taskPrivate.checked = false;
            
            this.#renderComments();
        }
        
        const commentsSection = this.#elements.commentsSection;
        if (commentsSection) {
            commentsSection.classList.remove('collapsed');
        }
        const body = this.#elements.commentsBody;
        if (body) body.style.display = 'block';
        const icon = this.#elements.commentsToggleIcon;
        if (icon) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        }
        
        this.#modal.classList.add('active');
        this.#modal.style.display = 'flex';
        
        setTimeout(() => this.#elements.taskTitle?.focus(), 100);
    }

    /**
     * Закрыть модальное окно
     */
    #close() {
        console.log('[task-modal] Закрытие');
        this.#modal.classList.remove('active');
        this.#modal.style.display = 'none';
        this.#currentTaskId = null;
        this.#currentTaskComments = [];
        this.#hideMentionSuggestions();
    }

    // ========== РЕНДЕРИНГ ==========

    async #renderAssigneeField() {
        const container = this.#elements.dynamicFields;
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!this.#currentUser) return;
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', this.#currentUser.id)
            .single();
        
        const hasCompany = profile?.company_id;
        
        if (hasCompany && this.#users.length > 1) {
            const assigneeHtml = `
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Исполнитель</label>
                    <select id="taskAssignee">
                        <option value="">Не назначен</option>
                        ${this.#users.map(u => 
                            `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            container.innerHTML = assigneeHtml;
        }
    }

    async #loadComments(taskId) {
        try {
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            this.#currentTaskComments = data || [];
        } catch (error) {
            console.error('[task-modal] Ошибка загрузки комментариев:', error);
            this.#currentTaskComments = [];
        }
        
        this.#renderComments();
    }

    #renderComments() {
        const container = this.#elements.commentsList;
        const countSpan = this.#elements.commentsCount;
        
        if (!container) return;
        
        const comments = this.#currentTaskComments;
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="comment-empty">Нет комментариев</div>';
            if (countSpan) countSpan.textContent = '0';
            return;
        }
        
        if (countSpan) countSpan.textContent = comments.length;
        
        container.innerHTML = comments.map(comment => {
            let processedText = escapeHtml(comment.text || '');
            processedText = processedText.replace(/@(\w+)/g, (match, username) => {
                const mentionedUser = this.#users.find(u => u.github_username === username);
                if (mentionedUser) {
                    return `<span class="mention-link" data-username="${username}" title="${escapeHtml(mentionedUser.name)}">@${escapeHtml(username)}</span>`;
                }
                return match;
            });
            
            const canDelete = comment.author === this.#currentUser?.name || 
                              this.#currentUser?.role === 'admin';
            
            return `
                <div class="comment-item" data-comment-id="${comment.id}">
                    <div class="comment-header">
                        <span class="comment-author">
                            <i class="fas fa-user-circle"></i> ${escapeHtml(comment.author || 'Пользователь')}
                        </span>
                        <span class="comment-date">
                            ${formatDate(comment.created_at, 'DD.MM.YYYY HH:MM')}
                            ${canDelete ? 
                                `<i class="fas fa-trash-alt delete-comment" data-comment-id="${comment.id}"></i>` : 
                                ''}
                        </span>
                    </div>
                    <div class="comment-text">${processedText}</div>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.mention-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = link.dataset.username;
                if (username) {
                    window.location.href = `profile.html?user=${username}`;
                }
            });
        });
        
        container.querySelectorAll('.delete-comment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;
                await this.#deleteComment(commentId);
            });
        });
    }

    // ========== CRUD ОПЕРАЦИИ ==========

    async #save() {
        console.log('[task-modal] Сохранение задачи');
        
        const taskId = this.#elements.taskId.value;
        const assigneeSelect = document.getElementById('taskAssignee');
        
        const taskData = {
            title: this.#elements.taskTitle.value.trim(),
            description: this.#elements.taskDescription.value.trim(),
            category: this.#elements.taskCategory.value,
            due_date: this.#elements.taskDueDate.value || null,
            is_important: this.#elements.taskImportant.checked,
            status: this.#elements.taskStatus.value,
            is_private: this.#elements.taskPrivate.checked,
            assigned_to: assigneeSelect?.value || null
        };
        
        if (!taskData.title) {
            alert('Введите название задачи');
            return;
        }
        
        let result;
        if (taskId) {
            result = await updateTask(taskId, taskData);
        } else {
            result = await createTask(taskData);
        }
        
        if (result) {
            this.#close();
            showToast('success', taskId ? 'Задача обновлена' : 'Задача создана');
            
            if (this.#onSaved) {
                await this.#onSaved();
            }
        } else {
            alert('Ошибка сохранения задачи');
        }
    }

    async #addComment() {
        const taskId = this.#currentTaskId || this.#elements.taskId.value;
        if (!taskId) {
            alert('Сначала сохраните задачу');
            return;
        }
        
        const commentText = this.#elements.newComment.value.trim();
        if (!commentText) {
            alert('Введите комментарий');
            return;
        }
        
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(commentText)) !== null) {
            const username = match[1];
            const mentionedUser = this.#users.find(u => u.github_username === username);
            if (mentionedUser && mentionedUser.id !== this.#currentUser?.id) {
                mentions.push(username);
            }
        }
        
        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    task_id: taskId,
                    user_id: this.#currentUser?.id,
                    author: this.#currentUser?.name || this.#currentUser?.email,
                    text: commentText,
                    mentions: mentions
                }]);
            
            if (error) throw error;
            
            this.#elements.newComment.value = '';
            await this.#loadComments(taskId);
            this.#hideMentionSuggestions();
            
            for (const username of mentions) {
                const mentionedUser = this.#users.find(u => u.github_username === username);
                if (mentionedUser) {
                    try {
                        await supabase.from('notifications').insert([{
                            user_id: mentionedUser.id,
                            type: 'mention',
                            title: 'Упоминание в комментарии',
                            message: `${this.#currentUser?.name} упомянул вас в комментарии к задаче`,
                            task_id: taskId
                        }]);
                    } catch (e) {
                        console.warn('[task-modal] Не удалось создать уведомление:', e);
                    }
                }
            }
            
            showToast('success', 'Комментарий добавлен');
        } catch (error) {
            console.error('[task-modal] Ошибка добавления комментария:', error);
            alert('Ошибка добавления комментария');
        }
    }

    async #deleteComment(commentId) {
        if (!confirm('Удалить комментарий?')) return;
        
        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);
            
            if (error) throw error;
            
            const taskId = this.#currentTaskId || this.#elements.taskId.value;
            await this.#loadComments(taskId);
            showToast('success', 'Комментарий удалён');
        } catch (error) {
            console.error('[task-modal] Ошибка удаления комментария:', error);
            alert('Ошибка удаления комментария');
        }
    }

    // ========== АККОРДЕОН КОММЕНТАРИЕВ ==========

    #toggleComments() {
        const section = this.#elements.commentsSection;
        const body = this.#elements.commentsBody;
        const icon = this.#elements.commentsToggleIcon;
        
        if (!section || !body || !icon) return;
        
        if (section.classList.contains('collapsed')) {
            section.classList.remove('collapsed');
            body.style.display = 'block';
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        } else {
            section.classList.add('collapsed');
            body.style.display = 'none';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        }
    }

    // ========== АВТОКОМПЛИТ @УПОМИНАНИЙ ==========

    #getMentionableUsers() {
        return this.#users.filter(u => u.github_username !== this.#currentUser?.github_username);
    }

    #handleCommentInput(e) {
        const textarea = e.target;
        const cursorPos = textarea.selectionStart;
        this.#showMentionSuggestions(textarea.value, cursorPos);
    }

    #showMentionSuggestions(text, cursorPos) {
        const beforeCursor = text.substring(0, cursorPos);
        const lastAtIndex = beforeCursor.lastIndexOf('@');
        
        if (lastAtIndex === -1) {
            this.#hideMentionSuggestions();
            return;
        }
        
        const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : '';
        if (/[\wа-яё]/i.test(charBeforeAt)) {
            this.#hideMentionSuggestions();
            return;
        }
        
        const searchQuery = beforeCursor.substring(lastAtIndex + 1);
        if (searchQuery.includes(' ')) {
            this.#hideMentionSuggestions();
            return;
        }
        
        const filteredUsers = this.#getMentionableUsers().filter(user => 
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.github_username.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (filteredUsers.length === 0) {
            this.#hideMentionSuggestions();
            return;
        }
        
        this.#mentionSuggestions = filteredUsers;
        this.#activeSuggestionIndex = -1;
        this.#renderMentionSuggestions(searchQuery);
    }

    #renderMentionSuggestions(searchQuery) {
        const container = this.#elements.mentionSuggestions;
        if (!container) return;
        
        const suggestions = this.#mentionSuggestions;
        
        if (suggestions.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        for (let i = 0; i < suggestions.length; i++) {
            const user = suggestions[i];
            const isActive = i === this.#activeSuggestionIndex;
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            
            let nameHighlight = user.name;
            let usernameHighlight = user.github_username;
            
            if (searchQuery) {
                const regex = new RegExp(`(${searchQuery})`, 'gi');
                nameHighlight = user.name.replace(regex, '<mark>$1</mark>');
                usernameHighlight = user.github_username.replace(regex, '<mark>$1</mark>');
            }
            
            html += `
                <div class="mention-suggestion-item ${isActive ? 'active' : ''}" 
                     data-username="${user.github_username}">
                    <div class="mention-suggestion-avatar">${initials}</div>
                    <div class="mention-suggestion-info">
                        <div class="mention-suggestion-name">${nameHighlight}</div>
                        <div class="mention-suggestion-username">@${usernameHighlight}</div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        container.style.display = 'block';
        
        const textarea = this.#elements.newComment;
        if (textarea) {
            const rect = textarea.getBoundingClientRect();
            container.style.position = 'fixed';
            container.style.left = rect.left + 'px';
            container.style.top = (rect.bottom + 5) + 'px';
            container.style.width = Math.max(rect.width, 280) + 'px';
        }
        
        container.querySelectorAll('.mention-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const username = item.dataset.username;
                const user = suggestions.find(u => u.github_username === username);
                if (user) this.#insertMention(user);
            });
        });
    }

    #handleCommentKeydown(e) {
        const suggestions = this.#mentionSuggestions;
        
        if (suggestions.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.#activeSuggestionIndex = (this.#activeSuggestionIndex + 1) % suggestions.length;
                    this.#renderMentionSuggestions(
                        this.#elements.newComment?.value.split('@').pop()?.split(' ')[0] || ''
                    );
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    this.#activeSuggestionIndex = this.#activeSuggestionIndex <= 0 
                        ? suggestions.length - 1 
                        : this.#activeSuggestionIndex - 1;
                    this.#renderMentionSuggestions(
                        this.#elements.newComment?.value.split('@').pop()?.split(' ')[0] || ''
                    );
                    break;
                    
                case 'Enter':
                case 'Tab':
                    if (this.#activeSuggestionIndex >= 0 && suggestions[this.#activeSuggestionIndex]) {
                        e.preventDefault();
                        this.#insertMention(suggestions[this.#activeSuggestionIndex]);
                    }
                    break;
                    
                case 'Escape':
                    this.#hideMentionSuggestions();
                    break;
            }
        }
        
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            this.#addComment();
        }
    }

    #handleCommentBlur() {
        setTimeout(() => this.#hideMentionSuggestions(), 200);
    }

    #insertMention(user) {
        const textarea = this.#elements.newComment;
        if (!textarea) return;
        
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;
        
        const beforeCursor = text.substring(0, cursorPos);
        const lastAtIndex = beforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            const beforeAt = text.substring(0, lastAtIndex);
            const afterCursor = text.substring(cursorPos);
            const mentionText = `@${user.github_username} `;
            const newValue = beforeAt + mentionText + afterCursor;
            
            textarea.value = newValue;
            
            const newCursorPos = lastAtIndex + mentionText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }
        
        this.#hideMentionSuggestions();
    }

    #hideMentionSuggestions() {
        const container = this.#elements.mentionSuggestions;
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        this.#mentionSuggestions = [];
        this.#activeSuggestionIndex = -1;
    }

    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

    updateUsers(users) {
        this.#users = users;
    }

    isOpen() {
        return this.#modal?.classList.contains('active') || false;
    }

    destroy() {
        this.#close();
        if (this.#elements.closeBtn) {
            this.#elements.closeBtn.removeEventListener('click', this.#close);
        }
        if (this.#elements.cancelBtn) {
            this.#elements.cancelBtn.removeEventListener('click', this.#close);
        }
        if (this.#elements.saveBtn) {
            this.#elements.saveBtn.removeEventListener('click', this.#save);
        }
        window.removeEventListener('scroll', () => this.#hideMentionSuggestions());
        console.log('[task-modal] Уничтожен');
        this.#initialized = false;
    }
}

export default TaskModal;
