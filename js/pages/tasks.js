/**
 * ============================================
 * ФАЙЛ: js/pages/tasks.js
 * РОЛЬ: Логика страницы доски задач (Kanban)
 * 
 * ОСОБЕННОСТИ:
 *   - Kanban-доска с 3 статусами (pending, in_progress, completed)
 *   - Drag-and-drop для изменения статуса
 *   - Создание/редактирование задач
 *   - Комментарии к задачам
 *   - Приватные задачи
 *   - Привязка к объектам недвижимости
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/tasks-supabase.js
 *   - js/components/kanban.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из tasks-supabase.html
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

// ========== ФУНКЦИИ КОММЕНТАРИЕВ ==========

async function loadComments(taskId) {
    if (!taskId) return;
    
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('task_id', parseInt(taskId))
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
    
    container.innerHTML = currentTaskComments.map(comment => `
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
            <div class="comment-text">${escapeHtml(comment.text || '')}</div>
        </div>
    `).join('');
}

function canDeleteComment(comment) {
    if (!currentUser) return false;
    return comment.author === currentUser.name || currentUser.role === 'admin';
}

// ========== КОММЕНТАРИИ (ГЛОБАЛЬНЫЕ) ==========

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
    
    try {
        const { data, error } = await supabase
            .from('comments')
            .insert([{
                task_id: parseInt(taskId),
                user_id: currentUser?.id,
                author: currentUser?.name || currentUser?.email,
                text: commentText,
                mentions: []
            }])
            .select();
        
        if (error) throw error;
        
        document.getElementById('newComment').value = '';
        await loadComments(taskId);
        
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
    
    for (const task of tasks) {
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
    
    console.log('[tasks] Канбан отрисован, задач:', tasks.length);
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

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
            users = data;
            console.log('[tasks] Загружено пользователей:', users.length);
        }
    } catch (e) {
        console.error('Ошибка загрузки пользователей:', e);
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
            
            // Загружаем комментарии
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
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initTasksPage() {
    console.log('[tasks] Инициализация страницы...');
    
    // Ждем авторизацию
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    // Получаем пользователя
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[tasks] Текущий пользователь:', currentUser?.name);
    
    // Ждем загрузку данных (задачи загружаются в loadTasksData)
    await loadTasksData();
    setupDropZones();
    
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
    
    if (window.CRM?.ui?.animations) {
        console.log('[tasks] Анимации инициализированы');
    }
    
    console.log('[tasks] Инициализация завершена');
}