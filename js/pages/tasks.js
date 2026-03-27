/**
 * ============================================
 * ФАЙЛ: js/pages/tasks.js
 * РОЛЬ: Логика страницы доски задач (Kanban)
 * 
 * ОСОБЕННОСТИ:
 *   - Kanban-доска с 3 статусами (pending, in_progress, completed)
 *   - Drag-and-drop для изменения статуса
 *   - Создание/редактирование задач
 *   - Комментарии к задачам с @упоминаниями
 *   - Приватные задачи
 *   - Привязка к объектам недвижимости
 *   - Фильтры: поиск, исполнитель, приоритет, объект
 *   - Статистика задач
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/tasks-supabase.js
 *   - js/components/kanban.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из tasks-supabase.html
 *   - 28.03.2026: Добавлен автокомплит для @упоминаний в комментариях
 *   - 28.03.2026: Исправлена загрузка пользователей и комментариев
 *   - 28.03.2026: Добавлена панель фильтров и статистика
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { 
    getTasks as getTasksFromDB, 
    createTask as createTaskInDB, 
    updateTask as updateTaskInDB, 
    updateTaskStatus as updateTaskStatusInDB, 
    deleteTask as deleteTaskFromDB 
} from '../services/tasks-supabase.js';

// Состояние страницы
let tasks = [];
let users = [];
let complexes = [];
let currentUser = null;
let currentTaskComments = [];

// Состояние для автокомплита
let mentionSuggestions = [];
let activeSuggestionIndex = -1;

// Состояние для фильтров
let filters = {
    search: '',
    assignee: 'all',
    priority: 'all',
    complex: 'all',
    quick: 'all'
};

console.log('[tasks.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========== ФИЛЬТРАЦИЯ ЗАДАЧ ==========

function getFilteredTasks() {
    let filtered = [...tasks];
    
    // Поиск по названию
    if (filters.search) {
        filtered = filtered.filter(t => 
            t.title.toLowerCase().includes(filters.search.toLowerCase())
        );
    }
    
    // Фильтр по исполнителю
    if (filters.assignee !== 'all') {
        filtered = filtered.filter(t => t.assigned_to === filters.assignee);
    }
    
    // Фильтр по приоритету
    if (filters.priority !== 'all') {
        filtered = filtered.filter(t => t.priority === filters.priority);
    }
    
    // Фильтр по объекту
    if (filters.complex !== 'all') {
        filtered = filtered.filter(t => t.complex_id === filters.complex);
    }
    
    // Быстрые фильтры
    if (filters.quick !== 'all') {
        const today = new Date().toISOString().split('T')[0];
        switch (filters.quick) {
            case 'my':
                filtered = filtered.filter(t => t.assigned_to === currentUser?.github_username);
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

function updateStats() {
    const filteredTasks = getFilteredTasks();
    const total = filteredTasks.length;
    const pending = filteredTasks.filter(t => t.status === 'pending').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statProgress').textContent = inProgress;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statCompletion').textContent = completionPercent + '%';
    document.getElementById('statProgressFill').style.width = completionPercent + '%';
}

// ========== АВТОКОМПЛИТ ДЛЯ @УПОМИНАНИЙ ==========

function getMentionableUsers() {
    return users.filter(u => u.github_username !== currentUser?.github_username);
}

function showMentionSuggestions(text, cursorPos) {
    const beforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
        hideMentionSuggestions();
        return;
    }
    
    const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : '';
    if (/[\wа-яё]/i.test(charBeforeAt)) {
        hideMentionSuggestions();
        return;
    }
    
    const searchQuery = beforeCursor.substring(lastAtIndex + 1);
    
    if (searchQuery.includes(' ')) {
        hideMentionSuggestions();
        return;
    }
    
    const filteredUsers = getMentionableUsers().filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.github_username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filteredUsers.length === 0) {
        hideMentionSuggestions();
        return;
    }
    
    mentionSuggestions = filteredUsers;
    activeSuggestionIndex = -1;
    renderMentionSuggestions(searchQuery);
}

function renderMentionSuggestions(searchQuery) {
    const container = document.getElementById('mentionSuggestions');
    if (!container) return;
    
    if (mentionSuggestions.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    for (let i = 0; i < mentionSuggestions.length; i++) {
        const user = mentionSuggestions[i];
        const isActive = i === activeSuggestionIndex;
        const nameHighlight = user.name.toLowerCase().includes(searchQuery.toLowerCase())
            ? user.name.replace(new RegExp(`(${searchQuery})`, 'gi'), '<mark>$1</mark>')
            : user.name;
        const usernameHighlight = user.github_username.toLowerCase().includes(searchQuery.toLowerCase())
            ? user.github_username.replace(new RegExp(`(${searchQuery})`, 'gi'), '<mark>$1</mark>')
            : user.github_username;
        
        html += `
            <div class="mention-suggestion-item ${isActive ? 'active' : ''}" 
                 data-username="${user.github_username}" 
                 data-name="${escapeHtml(user.name)}"
                 onclick="window.insertMentionFromSuggestion('${user.github_username}', '${escapeHtml(user.name)}')">
                <div class="mention-suggestion-avatar">
                    ${user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div class="mention-suggestion-info">
                    <div class="mention-suggestion-name">${nameHighlight}</div>
                    <div class="mention-suggestion-username">@${usernameHighlight}</div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    const textarea = document.getElementById('newComment');
    if (textarea) {
        const rect = textarea.getBoundingClientRect();
        container.style.position = 'fixed';
        container.style.left = rect.left + 'px';
        container.style.top = (rect.bottom + 5) + 'px';
        container.style.width = Math.max(rect.width, 280) + 'px';
    }
}

function hideMentionSuggestions() {
    const container = document.getElementById('mentionSuggestions');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
    mentionSuggestions = [];
    activeSuggestionIndex = -1;
}

function insertMention(user) {
    const textarea = document.getElementById('newComment');
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
    
    hideMentionSuggestions();
}

window.insertMentionFromSuggestion = function(username, name) {
    const textarea = document.getElementById('newComment');
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    
    const beforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
        const beforeAt = text.substring(0, lastAtIndex);
        const afterCursor = text.substring(cursorPos);
        const mentionText = `@${username} `;
        const newValue = beforeAt + mentionText + afterCursor;
        
        textarea.value = newValue;
        
        const newCursorPos = lastAtIndex + mentionText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
    }
    
    hideMentionSuggestions();
};

function handleMentionKeydown(e) {
    if (mentionSuggestions.length === 0) return false;
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % mentionSuggestions.length;
            renderMentionSuggestions(document.getElementById('newComment')?.value.split('@').pop()?.split(' ')[0] || '');
            break;
        case 'ArrowUp':
            e.preventDefault();
            activeSuggestionIndex = activeSuggestionIndex <= 0 
                ? mentionSuggestions.length - 1 
                : activeSuggestionIndex - 1;
            renderMentionSuggestions(document.getElementById('newComment')?.value.split('@').pop()?.split(' ')[0] || '');
            break;
        case 'Enter':
        case 'Tab':
            if (activeSuggestionIndex >= 0 && mentionSuggestions[activeSuggestionIndex]) {
                e.preventDefault();
                insertMention(mentionSuggestions[activeSuggestionIndex]);
                return true;
            }
            break;
        case 'Escape':
            hideMentionSuggestions();
            break;
        default:
            return false;
    }
    return true;
}

// ========== ФУНКЦИИ КОММЕНТАРИЕВ ==========

async function loadComments(taskId) {
    if (!taskId) return;
    
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        currentTaskComments = data || [];
        renderComments();
    } catch (error) {
        console.error('[tasks] Ошибка загрузки комментариев:', error);
        currentTaskComments = [];
        renderComments();
    }
}

function renderComments() {
    const container = document.getElementById('commentsList');
    const countSpan = document.getElementById('commentsCount');
    
    if (!container) return;
    
    if (!currentTaskComments || currentTaskComments.length === 0) {
        container.innerHTML = '<div class="comment-empty">Нет комментариев</div>';
        if (countSpan) countSpan.textContent = '0';
        return;
    }
    
    if (countSpan) countSpan.textContent = currentTaskComments.length;
    
    container.innerHTML = currentTaskComments.map(comment => {
        let processedText = escapeHtml(comment.text || '');
        processedText = processedText.replace(/@(\w+)/g, (match, username) => {
            const mentionedUser = users.find(u => u.github_username === username);
            if (mentionedUser) {
                return `<span class="mention-link" onclick="window.goToProfileByUsername('${username}')" title="${escapeHtml(mentionedUser.name)}">@${escapeHtml(username)}</span>`;
            }
            return match;
        });
        
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">
                        <i class="fas fa-user-circle"></i> ${escapeHtml(comment.author || 'Пользователь')}
                    </span>
                    <span class="comment-date">
                        ${formatDate(comment.created_at)}
                        ${canDeleteComment(comment) ? `<i class="fas fa-trash-alt delete-comment" onclick="window.deleteComment(${comment.id})"></i>` : ''}
                    </span>
                </div>
                <div class="comment-text">${processedText}</div>
            </div>
        `;
    }).join('');
}

function canDeleteComment(comment) {
    if (!currentUser) return false;
    return comment.author === currentUser.name || currentUser.role === 'admin';
}

// ========== КОММЕНТАРИИ (ГЛОБАЛЬНЫЕ) ==========

window.goToProfileByUsername = function(username) {
    window.location.href = `profile-supabase.html?user=${username}`;
};

window.addComment = async function() {
    const taskId = document.getElementById('taskId').value;
    if (!taskId) {
        alert('Сначала сохраните задачу');
        return;
    }
    
    const commentText = document.getElementById('newComment').value.trim();
    if (!commentText) {
        alert('Введите комментарий');
        return;
    }
    
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(commentText)) !== null) {
        const username = match[1];
        const mentionedUser = users.find(u => u.github_username === username);
        if (mentionedUser && mentionedUser.id !== currentUser?.id) {
            mentions.push(username);
        }
    }
    
    try {
        const { data, error } = await supabase
            .from('comments')
            .insert([{
                task_id: taskId,
                user_id: currentUser?.id,
                author: currentUser?.name || currentUser?.email,
                text: commentText,
                mentions: mentions
            }])
            .select();
        
        if (error) throw error;
        
        document.getElementById('newComment').value = '';
        await loadComments(taskId);
        hideMentionSuggestions();
        
        for (const username of mentions) {
            const mentionedUser = users.find(u => u.github_username === username);
            if (mentionedUser && window.createNotification) {
                await window.createNotification({
                    user_id: mentionedUser.id,
                    type: 'mention',
                    title: 'Упоминание в комментарии',
                    message: `${currentUser?.name} упомянул вас в комментарии к задаче "${tasks.find(t => t.id == taskId)?.title}"`,
                    task_id: taskId
                });
            }
        }
        
        if (window.showToast) {
            window.showToast('success', 'Комментарий добавлен');
        }
    } catch (error) {
        console.error('[tasks] Ошибка добавления комментария:', error);
        alert('Ошибка добавления комментария');
    }
};

window.deleteComment = async function(commentId) {
    if (!confirm('Удалить комментарий?')) return;
    
    try {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);
        
        if (error) throw error;
        
        const taskId = document.getElementById('taskId').value;
        await loadComments(taskId);
        
        if (window.showToast) {
            window.showToast('success', 'Комментарий удален');
        }
    } catch (error) {
        console.error('[tasks] Ошибка удаления комментария:', error);
        alert('Ошибка удаления комментария');
    }
};

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========

window.closeModal = function() {
    document.getElementById('taskModal').classList.remove('active');
    currentTaskComments = [];
    hideMentionSuggestions();
};

window.saveTask = async function() {
    const taskId = document.getElementById('taskId').value;
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assigned_to: document.getElementById('taskAssignee').value || null,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value || null,
        status: document.getElementById('taskStatus').value,
        is_private: document.getElementById('taskPrivate').checked
    };
    
    if (!taskData.title) {
        alert('Введите название задачи');
        return;
    }
    
    let result;
    if (taskId) {
        result = await updateTaskInDB(taskId, taskData);
    } else {
        result = await createTaskInDB(taskData);
    }
    
    if (result) {
        window.closeModal();
        await loadTasksData();
        if (window.showToast) {
            window.showToast('success', taskId ? 'Задача обновлена' : 'Задача создана');
        }
    } else {
        alert('Ошибка сохранения задачи');
    }
};

window.editTask = function(taskId) {
    openModal(taskId);
};

window.deleteTask = async function(taskId) {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        const success = await deleteTaskFromDB(taskId);
        if (success) {
            tasks = tasks.filter(t => t.id != taskId);
            renderKanbanBoard();
            if (window.showToast) {
                window.showToast('success', 'Задача удалена');
            }
        } else {
            alert('Ошибка удаления задачи');
        }
    }
};

// ========== РЕНДЕРИНГ КАНБАНА ==========

function renderKanbanBoard() {
    const todoContainer = document.getElementById('todoTasks');
    const progressContainer = document.getElementById('progressTasks');
    const doneContainer = document.getElementById('doneTasks');
    
    if (!todoContainer) return;
    
    todoContainer.innerHTML = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML = '';
    
    let todoCount = 0, progressCount = 0, doneCount = 0;
    
    if (!window.CRM || !window.CRM.Kanban) {
        console.error('Kanban компонент не загружен!');
        return;
    }
    
    const filteredTasks = getFilteredTasks();
    
    for (const task of filteredTasks) {
        const card = window.CRM.Kanban.createTaskCard(task, {
            showDelete: true
        });
        
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-task') && 
                !e.target.closest('.delete-task')) {
                openModal(task.id);
            }
        });
        
        const deleteBtn = card.querySelector('.delete-task');
        if (deleteBtn) {
            const taskId = task.id;
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                window.deleteTask(taskId);
            };
        }
        
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
    
    document.getElementById('todoCount').textContent = todoCount;
    document.getElementById('progressCount').textContent = progressCount;
    document.getElementById('doneCount').textContent = doneCount;
    
    updateStats();
    console.log('[tasks] Канбан отрисован, задач:', filteredTasks.length);
}

async function handleDrop(e, newStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
        const task = tasks.find(t => t.id == taskId);
        if (task && task.status !== newStatus) {
            console.log('[tasks] Изменение статуса:', taskId, '→', newStatus);
            await updateTaskStatusInDB(taskId, newStatus);
            await loadTasksData();
        }
    }
}

function setupDropZones() {
    const containers = document.querySelectorAll('.tasks-container');
    containers.forEach(container => {
        container.addEventListener('dragover', (e) => e.preventDefault());
        container.addEventListener('drop', async (e) => {
            const newStatus = container.parentElement.getAttribute('data-status');
            await handleDrop(e, newStatus);
        });
    });
    console.log('[tasks] Drop зоны настроены');
}

// ========== НАСТРОЙКА ФИЛЬТРОВ ==========

function setupFilters() {
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filters.search = searchInput.value;
            renderKanbanBoard();
        }, 300));
    }
    
    // Быстрые фильтры
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filters.quick = btn.dataset.quick;
            renderKanbanBoard();
        });
    });
    
    // Фильтр по исполнителю (динамически обновляется после загрузки пользователей)
    updateAssigneeFilters();
    
    // Фильтр по приоритету
    document.querySelectorAll('.priority-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.priority-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filters.priority = btn.dataset.priority;
            renderKanbanBoard();
        });
    });
    
    // Фильтр по объекту
    const complexFilter = document.getElementById('complexFilter');
    if (complexFilter) {
        complexFilter.addEventListener('click', () => {
            // TODO: выпадающий список объектов
            console.log('[tasks] Фильтр по объекту пока в разработке');
        });
    }
}

function updateAssigneeFilters() {
    const container = document.getElementById('assigneeFilters');
    if (!container) return;
    
    // Очищаем, оставляя только "Все"
    container.innerHTML = `
        <div class="assignee-filter ${filters.assignee === 'all' ? 'active' : ''}" data-assignee="all">
            <div class="assignee-avatar">👥</div>
            <span class="assignee-name">Все</span>
        </div>
    `;
    
    for (const user of users) {
        if (user.github_username === currentUser?.github_username) continue;
        const isActive = filters.assignee === user.github_username;
        container.innerHTML += `
            <div class="assignee-filter ${isActive ? 'active' : ''}" data-assignee="${user.github_username}">
                <div class="assignee-avatar">${user.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>
                <span class="assignee-name">${escapeHtml(user.name.split(' ')[0])}</span>
            </div>
        `;
    }
    
    // Добавляем обработчики
    container.querySelectorAll('.assignee-filter').forEach(el => {
        el.addEventListener('click', () => {
            container.querySelectorAll('.assignee-filter').forEach(e => e.classList.remove('active'));
            el.classList.add('active');
            filters.assignee = el.dataset.assignee;
            renderKanbanBoard();
        });
    });
}

// Дебаунс для поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
            users = data;
            console.log('[tasks] Загружено пользователей:', users.length);
            console.log('[tasks] Пользователи:', users.map(u => ({ 
                name: u.name, 
                github: u.github_username, 
                role: u.role,
                id: u.id
            })));
            updateAssigneeFilters();
        } else {
            console.error('[tasks] Ошибка загрузки пользователей:', error);
            users = [];
        }
    } catch (e) {
        console.error('Ошибка загрузки пользователей:', e);
        users = [];
    }
}

async function loadComplexes() {
    try {
        const { data, error } = await supabase.from('complexes').select('*').eq('user_id', currentUser?.id);
        if (!error && data) {
            complexes = data;
            console.log('[tasks] Загружено объектов:', complexes.length);
        }
    } catch (e) {
        console.error('Ошибка загрузки объектов:', e);
        complexes = [];
    }
}

async function loadTasksData() {
    tasks = await getTasksFromDB();
    renderKanbanBoard();
    console.log(`[tasks] Загружено ${tasks.length} задач`);
}

async function openModal(taskId) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const privateCheckbox = document.getElementById('taskPrivate');
    
    await loadUsers();
    await loadComplexes();
    
    const assigneeSelect = document.getElementById('taskAssignee');
    if (assigneeSelect && users.length) {
        assigneeSelect.innerHTML = '<option value="">Назначить исполнителя</option>';
        for (const user of users) {
            assigneeSelect.innerHTML += `<option value="${user.github_username}">${escapeHtml(user.name)}</option>`;
        }
    }
    
    const complexSelect = document.getElementById('taskComplex');
    if (complexSelect && complexes.length) {
        complexSelect.innerHTML = '<option value="">Привязать к объекту</option>';
        for (const complex of complexes) {
            complexSelect.innerHTML += `<option value="${complex.id}">${escapeHtml(complex.name)}</option>`;
        }
    }
    
    if (taskId) {
        modalTitle.textContent = 'Редактировать задачу';
        const task = tasks.find(t => t.id == taskId);
        if (task) {
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskAssignee').value = task.assigned_to || '';
            document.getElementById('taskComplex').value = task.complex_id || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDueDate').value = task.due_date || '';
            document.getElementById('taskStatus').value = task.status;
            if (privateCheckbox) privateCheckbox.checked = task.is_private;
            
            await loadComments(task.id);
        }
    } else {
        modalTitle.textContent = 'Создать задачу';
        document.getElementById('taskId').value = '';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskAssignee').value = '';
        document.getElementById('taskComplex').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskDueDate').value = '';
        document.getElementById('taskStatus').value = 'pending';
        if (privateCheckbox) privateCheckbox.checked = false;
        currentTaskComments = [];
        renderComments();
    }
    
    modal.classList.add('active');
    console.log('[tasks] Модальное окно открыто, taskId:', taskId || 'новая');
    
    setTimeout(() => {
        const commentTextarea = document.getElementById('newComment');
        if (commentTextarea) {
            commentTextarea.removeEventListener('input', handleCommentInput);
            commentTextarea.removeEventListener('keydown', handleCommentKeydown);
            commentTextarea.removeEventListener('blur', handleCommentBlur);
            
            commentTextarea.addEventListener('input', handleCommentInput);
            commentTextarea.addEventListener('keydown', handleCommentKeydown);
            commentTextarea.addEventListener('blur', handleCommentBlur);
        }
    }, 100);
}

// ========== ОБРАБОТЧИКИ АВТОКОМПЛИТА ==========

function handleCommentInput(e) {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    showMentionSuggestions(textarea.value, cursorPos);
}

function handleCommentKeydown(e) {
    const handled = handleMentionKeydown(e);
    if (handled) return;
    
    if (e.key === 'Enter' && mentionSuggestions.length > 0 && activeSuggestionIndex >= 0) {
        e.preventDefault();
        insertMention(mentionSuggestions[activeSuggestionIndex]);
    }
}

function handleCommentBlur() {
    setTimeout(() => {
        hideMentionSuggestions();
    }, 200);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initTasksPage() {
    console.log('[tasks] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[tasks] Текущий пользователь:', currentUser?.name);
    
    await loadUsers();
    await loadComplexes();
    await loadTasksData();
    setupDropZones();
    setupFilters();
    
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => openModal());
    
    const addBtns = document.querySelectorAll('.add-task-btn');
    addBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            document.getElementById('taskStatus').value = status;
            openModal();
        });
    });
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    // Глобальный обработчик скролла для скрытия подсказок
    window.addEventListener('scroll', function() {
        hideMentionSuggestions();
    }, true);
    
    if (window.CRM?.ui?.animations) {
        console.log('[tasks] Анимации инициализированы');
    }
    
    console.log('[tasks] Инициализация завершена');
}