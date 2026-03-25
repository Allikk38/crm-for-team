// tasks.js - логика доски задач

let tasks = [];
let users = [];
let complexes = [];
let draggedTask = null;

// Загрузка объектов для выпадающего списка
async function loadComplexesForSelect() {
    try {
        complexes = await loadCSV('data/complexes.csv');
        const complexSelect = document.getElementById('taskComplex');
        if (complexSelect) {
            complexSelect.innerHTML = '<option value="">Привязать к объекту</option>';
            for (var i = 0; i < complexes.length; i++) {
                var complex = complexes[i];
                var option = document.createElement('option');
                option.value = complex.id;
                option.textContent = complex.title + ' (' + complex.address + ')';
                complexSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки объектов:', error);
    }
}

// Загрузка задач
async function loadTasks() {
    var tasksData = await loadCSV('data/tasks.csv');
    tasks = [];
    for (var i = 0; i < tasksData.length; i++) {
        var task = tasksData[i];
        tasks.push({
            id: parseInt(task.id),
            title: task.title || '',
            description: task.description || '',
            assigned_to: task.assigned_to || '',
            created_by: task.created_by || '',
            status: task.status || 'todo',
            priority: task.priority || 'medium',
            created_at: task.created_at || '',
            updated_at: task.updated_at || '',
            due_date: task.due_date || '',
            complex_id: task.complex_id || ''
        });
    }
    renderKanban();
}

// Загрузка пользователей для выпадающего списка
async function loadUsersForSelect() {
    users = await loadCSV('data/users.csv');
    var assigneeSelect = document.getElementById('taskAssignee');
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Назначить исполнителя</option>';
        for (var i = 0; i < users.length; i++) {
            var user = users[i];
            var option = document.createElement('option');
            option.value = user.github_username;
            option.textContent = user.name + ' (' + user.role + ')';
            assigneeSelect.appendChild(option);
        }
    }
}

// Рендер Kanban-доски
function renderKanban() {
    var todoContainer = document.getElementById('todoTasks');
    var progressContainer = document.getElementById('progressTasks');
    var doneContainer = document.getElementById('doneTasks');
    
    if (!todoContainer) return;
    
    todoContainer.innerHTML = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML = '';
    
    var todoCount = 0, progressCount = 0, doneCount = 0;
    
    for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        var taskCard = createTaskCard(task);
        
        if (task.status === 'todo') {
            todoContainer.appendChild(taskCard);
            todoCount++;
        } else if (task.status === 'in_progress') {
            progressContainer.appendChild(taskCard);
            progressCount++;
        } else if (task.status === 'done') {
            doneContainer.appendChild(taskCard);
            doneCount++;
        }
    }
    
    document.getElementById('todoCount').textContent = todoCount;
    document.getElementById('progressCount').textContent = progressCount;
    document.getElementById('doneCount').textContent = doneCount;
}

// Создание карточки задачи
function createTaskCard(task) {
    var card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.setAttribute('data-task-id', task.id);
    
    var priorityColors = {
        high: '#ff6b6b',
        medium: '#ffc107',
        low: '#4caf50'
    };
    card.style.borderLeftColor = priorityColors[task.priority];
    
    var assignee = null;
    for (var u = 0; u < users.length; u++) {
        if (users[u].github_username === task.assigned_to) {
            assignee = users[u];
            break;
        }
    }
    var assigneeName = assignee ? assignee.name : 'Не назначен';
    
    // Находим объект, если привязан
    var complexName = '';
    if (task.complex_id) {
        for (var c = 0; c < complexes.length; c++) {
            if (complexes[c].id == task.complex_id) {
                complexName = '<i class="fas fa-building"></i> ' + escapeHtml(complexes[c].title);
                break;
            }
        }
    }
    
    card.innerHTML = 
        '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="task-description">' + escapeHtml(task.description || '') + '</div>' +
        '<div class="task-meta">' +
            '<span class="task-priority priority-' + task.priority + '">' +
                getPriorityText(task.priority) +
            '</span>' +
            '<span class="task-assignee">' +
                '<i class="fas fa-user"></i> ' + assigneeName +
            '</span>' +
        '</div>' +
        '<div class="task-meta">' +
            '<span><i class="fas fa-calendar"></i> ' + (task.due_date || 'без срока') + '</span>' +
            '<button class="delete-task" onclick="deleteTask(' + task.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
        (complexName ? '<div class="task-meta"><span>' + complexName + '</span></div>' : '');
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('click', function(e) {
        if (!e.target.classList.contains('delete-task') && !e.target.closest('.delete-task')) {
            editTask(task.id);
        }
    });
    
    return card;
}

// Обработка drag-and-drop
function handleDragStart(e) {
    draggedTask = e.target.closest('.task-card');
    if (draggedTask) {
        draggedTask.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedTask.getAttribute('data-task-id'));
    }
}

function handleDragEnd(e) {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        draggedTask = null;
    }
}

// Настройка drop-зон
function setupDropZones() {
    var columns = document.querySelectorAll('.tasks-container');
    for (var i = 0; i < columns.length; i++) {
        var column = columns[i];
        column.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        
        column.addEventListener('drop', async function(e) {
            e.preventDefault();
            var taskId = e.dataTransfer.getData('text/plain');
            var newStatus = this.parentElement.getAttribute('data-status');
            
            if (taskId && newStatus) {
                await updateTaskStatus(parseInt(taskId), newStatus);
            }
        });
    }
}

// Обновление статуса задачи
async function updateTaskStatus(taskId, newStatus) {
    var task = null;
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
            task = tasks[i];
            break;
        }
    }
    if (task && task.status !== newStatus) {
        task.status = newStatus;
        task.updated_at = new Date().toISOString().split('T')[0];
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Создание новой задачи
async function createTask(taskData) {
    var maxId = 0;
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id > maxId) maxId = tasks[i].id;
    }
    var newId = maxId + 1;
    
    var newTask = {
        id: newId,
        title: taskData.title,
        description: taskData.description,
        assigned_to: taskData.assigned_to,
        created_by: auth.getCurrentUser() ? auth.getCurrentUser().github_username : 'system',
        status: taskData.status,
        priority: taskData.priority,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0],
        due_date: taskData.due_date,
        complex_id: taskData.complex_id || ''
    };
    
    tasks.push(newTask);
    await saveTasksToGitHub();
    renderKanban();
}

// Редактирование задачи
async function updateTask(taskId, taskData) {
    var taskIndex = -1;
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
            taskIndex = i;
            break;
        }
    }
    if (taskIndex !== -1) {
        tasks[taskIndex] = {
            ...tasks[taskIndex],
            title: taskData.title,
            description: taskData.description,
            assigned_to: taskData.assigned_to,
            priority: taskData.priority,
            due_date: taskData.due_date,
            status: taskData.status,
            complex_id: taskData.complex_id || '',
            updated_at: new Date().toISOString().split('T')[0]
        };
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Удаление задачи
async function deleteTask(taskId) {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        var newTasks = [];
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id !== taskId) newTasks.push(tasks[i]);
        }
        tasks = newTasks;
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Сохранение задач в GitHub
async function saveTasksToGitHub() {
    var currentUser = auth.getCurrentUser();
    if (!currentUser || !auth.hasPermission('edit')) {
        alert('У вас нет прав на редактирование задач');
        return false;
    }
    
    var tasksToSave = [];
    for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        tasksToSave.push({
            id: task.id,
            title: task.title,
            description: task.description || '',
            assigned_to: task.assigned_to || '',
            created_by: task.created_by,
            status: task.status,
            priority: task.priority,
            created_at: task.created_at,
            updated_at: task.updated_at,
            due_date: task.due_date || '',
            complex_id: task.complex_id || ''
        });
    }
    
    return await window.utils.saveCSVToGitHub(
        'data/tasks.csv',
        tasksToSave,
        'Update tasks by ' + currentUser.name
    );
}

// Вспомогательные функции
function getPriorityText(priority) {
    var priorities = {
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий'
    };
    return priorities[priority] || priority;
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle') + '"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// Модальное окно
function openModal(taskId) {
    var modal = document.getElementById('taskModal');
    var modalTitle = document.getElementById('modalTitle');
    
    if (taskId) {
        modalTitle.textContent = 'Редактировать задачу';
        var task = null;
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                task = tasks[i];
                break;
            }
        }
        if (task) {
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskAssignee').value = task.assigned_to || '';
            document.getElementById('taskComplex').value = task.complex_id || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDueDate').value = task.due_date || '';
            document.getElementById('taskStatus').value = task.status;
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
        document.getElementById('taskStatus').value = 'todo';
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
}

async function saveTask() {
    var taskId = document.getElementById('taskId').value;
    var taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assigned_to: document.getElementById('taskAssignee').value,
        complex_id: document.getElementById('taskComplex').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value,
        status: document.getElementById('taskStatus').value
    };
    
    if (!taskData.title) {
        alert('Введите название задачи');
        return;
    }
    
    if (taskId) {
        await updateTask(parseInt(taskId), taskData);
        showToast('success', 'Задача обновлена');
    } else {
        await createTask(taskData);
        showToast('success', 'Задача создана');
    }
    
    closeModal();
}

function editTask(taskId) {
    openModal(taskId);
}

// Инициализация
async function init() {
    await auth.initAuth();
    await loadUsersForSelect();
    await loadComplexesForSelect();
    await loadTasks();
    setupDropZones();
    
    var currentUser = auth.getCurrentUser();
    if (currentUser) {
        var userNameSpan = document.getElementById('userName');
        if (userNameSpan) {
            var roleLabel = '';
            if (currentUser.role === 'admin') roleLabel = 'Администратор';
            else if (currentUser.role === 'manager') roleLabel = 'Менеджер';
            else if (currentUser.role === 'agent') roleLabel = 'Агент';
            else roleLabel = 'Наблюдатель';
            userNameSpan.innerHTML = '<i class="fab fa-github"></i> ' + escapeHtml(currentUser.name) + ' (' + roleLabel + ')';
        }
    }
    
    var addBtns = document.querySelectorAll('.add-task-btn');
    for (var i = 0; i < addBtns.length; i++) {
        var btn = addBtns[i];
        btn.addEventListener('click', function() {
            var status = this.getAttribute('data-status');
            document.getElementById('taskStatus').value = status;
            openModal();
        });
    }
    
    var addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', function() { openModal(); });
}

document.addEventListener('DOMContentLoaded', init);
