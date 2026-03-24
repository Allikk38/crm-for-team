// tasks.js - логика доски задач

let tasks = [];
let users = [];
let draggedTask = null;

// Загрузка задач
async function loadTasks() {
    tasks = await loadCSV('data/tasks.csv');
    // Преобразуем строковые ID в числа для корректного сравнения
    tasks = tasks.map(task => ({
        ...task,
        id: parseInt(task.id)
    }));
    renderKanban();
}

// Загрузка пользователей для выпадающего списка
async function loadUsersForSelect() {
    users = await loadCSV('data/users.csv');
    const assigneeSelect = document.getElementById('taskAssignee');
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Назначить исполнителя</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.github_username;
            option.textContent = `${user.name} (${user.role})`;
            assigneeSelect.appendChild(option);
        });
    }
}

// Рендер Kanban-доски
function renderKanban() {
    const todoContainer = document.getElementById('todoTasks');
    const progressContainer = document.getElementById('progressTasks');
    const doneContainer = document.getElementById('doneTasks');
    
    if (!todoContainer) return;
    
    // Очищаем контейнеры
    todoContainer.innerHTML = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML = '';
    
    let todoCount = 0, progressCount = 0, doneCount = 0;
    
    tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        
        switch(task.status) {
            case 'todo':
                todoContainer.appendChild(taskCard);
                todoCount++;
                break;
            case 'in_progress':
                progressContainer.appendChild(taskCard);
                progressCount++;
                break;
            case 'done':
                doneContainer.appendChild(taskCard);
                doneCount++;
                break;
        }
    });
    
    // Обновляем счетчики
    document.getElementById('todoCount').textContent = todoCount;
    document.getElementById('progressCount').textContent = progressCount;
    document.getElementById('doneCount').textContent = doneCount;
}

// Создание карточки задачи
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.setAttribute('data-task-id', task.id);
    
    // Цвет边框 в зависимости от приоритета
    const priorityColors = {
        high: '#ff6b6b',
        medium: '#ffc107',
        low: '#4caf50'
    };
    card.style.borderLeftColor = priorityColors[task.priority];
    
    // Находим имя исполнителя
    const assignee = users.find(u => u.github_username === task.assigned_to);
    const assigneeName = assignee ? assignee.name : 'Не назначен';
    
    card.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-description">${escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}">
                ${getPriorityText(task.priority)}
            </span>
            <span class="task-assignee">
                👤 ${assigneeName}
            </span>
        </div>
        <div class="task-meta">
            <span>📅 ${task.due_date || 'без срока'}</span>
            <button class="delete-task" onclick="deleteTask(${task.id})">🗑️</button>
        </div>
    `;
    
    // Обработчики drag-and-drop
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-task')) {
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
    const columns = document.querySelectorAll('.tasks-container');
    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = column.parentElement.getAttribute('data-status');
            
            if (taskId && newStatus) {
                await updateTaskStatus(parseInt(taskId), newStatus);
            }
        });
    });
}

// Обновление статуса задачи
async function updateTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
        task.status = newStatus;
        task.updated_at = new Date().toISOString().split('T')[0];
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Создание новой задачи
async function createTask(taskData) {
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    const newTask = {
        id: newId,
        title: taskData.title,
        description: taskData.description,
        assigned_to: taskData.assigned_to,
        created_by: auth.getCurrentUser()?.github_username || 'system',
        status: taskData.status,
        priority: taskData.priority,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0],
        due_date: taskData.due_date
    };
    
    tasks.push(newTask);
    await saveTasksToGitHub();
    renderKanban();
}

// Редактирование задачи
async function updateTask(taskId, taskData) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        tasks[taskIndex] = {
            ...tasks[taskIndex],
            ...taskData,
            updated_at: new Date().toISOString().split('T')[0]
        };
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Удаление задачи
async function deleteTask(taskId) {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        tasks = tasks.filter(t => t.id !== taskId);
        await saveTasksToGitHub();
        renderKanban();
    }
}

// Сохранение задач в GitHub
async function saveTasksToGitHub() {
    const currentUser = auth.getCurrentUser();
    if (!currentUser || !auth.hasPermission('edit')) {
        alert('У вас нет прав на редактирование задач');
        return false;
    }
    
    // Подготавливаем данные для сохранения (убираем лишние поля)
    const tasksToSave = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to || '',
        created_by: task.created_by,
        status: task.status,
        priority: task.priority,
        created_at: task.created_at,
        updated_at: task.updated_at,
        due_date: task.due_date || ''
    }));
    
    return await window.utils.saveCSVToGitHub(
        'data/tasks.csv',
        tasksToSave,
        `Update tasks by ${currentUser.name}`
    );
}

// Вспомогательные функции
function getPriorityText(priority) {
    const priorities = {
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий'
    };
    return priorities[priority] || priority;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Модальное окно
function openModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (taskId) {
        modalTitle.textContent = 'Редактировать задачу';
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskAssignee').value = task.assigned_to || '';
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
    const taskId = document.getElementById('taskId').value;
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assigned_to: document.getElementById('taskAssignee').value,
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
    } else {
        await createTask(taskData);
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
    await loadTasks();
    setupDropZones();
    
    // Добавляем обработчики для кнопок "Добавить задачу"
    document.querySelectorAll('.add-task-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            document.getElementById('taskStatus').value = status;
            openModal();
        });
    });
    
    document.getElementById('addTaskBtn')?.addEventListener('click', () => openModal());
}

// Запускаем инициализацию
document.addEventListener('DOMContentLoaded', init);
// Изменение приоритета перетаскиванием
function setupPriorityDragAndDrop() {
    const prioritySlots = document.querySelectorAll('.priority-slot');
    
    prioritySlots.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', async (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newPriority = slot.getAttribute('data-priority');
            
            if (taskId && newPriority) {
                const task = tasks.find(t => t.id === parseInt(taskId));
                if (task && task.priority !== newPriority) {
                    task.priority = newPriority;
                    task.updated_at = new Date().toISOString().split('T')[0];
                    await saveTasksToGitHub();
                    renderKanban();
                    showToast('success', `Приоритет задачи "${task.title}" изменён на ${getPriorityText(newPriority)}`);
                }
            }
        });
    });
}

// Обновляем createTaskCard — добавляем индикатор для drag-and-drop
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.setAttribute('data-task-id', task.id);
    
    const priorityColors = {
        high: '#ff6b6b',
        medium: '#ffc107',
        low: '#4caf50'
    };
    card.style.borderLeftColor = priorityColors[task.priority];
    
    const assignee = users.find(u => u.github_username === task.assigned_to);
    const assigneeName = assignee ? assignee.name : 'Не назначен';
    
    card.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-description">${escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}" data-priority="${task.priority}">
                <i class="fas fa-${task.priority === 'high' ? 'arrow-up' : task.priority === 'medium' ? 'minus' : 'arrow-down'}"></i>
                ${getPriorityText(task.priority)}
            </span>
            <span class="task-assignee">
                <i class="fas fa-user"></i> ${assigneeName}
            </span>
        </div>
        <div class="task-meta">
            <span><i class="fas fa-calendar"></i> ${task.due_date || 'без срока'}</span>
            <button class="delete-task" onclick="deleteTask(${task.id})"><i class="fas fa-trash"></i></button>
        </div>
    `;
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-task') && !e.target.closest('.delete-task')) {
            editTask(task.id);
        }
    });
    
    return card;
}

// Добавляем панель для сброса приоритета
function addPriorityPanel() {
    const kanbanBoard = document.querySelector('.kanban-board');
    if (!kanbanBoard || document.querySelector('.priority-panel')) return;
    
    const panel = document.createElement('div');
    panel.className = 'priority-panel';
    panel.innerHTML = `
        <div class="priority-panel-title">
            <i class="fas fa-tag"></i> Перетащите задачу для изменения приоритета
        </div>
        <div class="priority-slots">
            <div class="priority-slot" data-priority="high">
                <i class="fas fa-arrow-up"></i> Высокий
            </div>
            <div class="priority-slot" data-priority="medium">
                <i class="fas fa-minus"></i> Средний
            </div>
            <div class="priority-slot" data-priority="low">
                <i class="fas fa-arrow-down"></i> Низкий
            </div>
        </div>
    `;
    
    kanbanBoard.parentNode.insertBefore(panel, kanbanBoard);
    
    // Добавляем стили для панели
    const style = document.createElement('style');
    style.textContent = `
        .priority-panel {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 16px 24px;
            margin-bottom: 24px;
            border: 1px solid var(--card-border);
        }
        .priority-panel-title {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-bottom: 12px;
        }
        .priority-slots {
            display: flex;
            gap: 16px;
        }
        .priority-slot {
            flex: 1;
            padding: 10px;
            text-align: center;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px dashed transparent;
        }
        .priority-slot[data-priority="high"] { border-left-color: #ff6b6b; }
        .priority-slot[data-priority="medium"] { border-left-color: #ffc107; }
        .priority-slot[data-priority="low"] { border-left-color: #4caf50; }
        .priority-slot.drag-over {
            border-color: var(--accent);
            background: var(--card-hover);
            transform: scale(1.02);
        }
        body.theme-light .priority-slot {
            background: rgba(0, 0, 0, 0.05);
        }
    `;
    document.head.appendChild(style);
}

// В init() добавим вызов
async function init() {
    await auth.initAuth();
    await loadUsersForSelect();
    await loadTasks();
    setupDropZones();
    setupPriorityDragAndDrop();
    addPriorityPanel();
    
    document.querySelectorAll('.add-task-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            document.getElementById('taskStatus').value = status;
            openModal();
        });
    });
    
    document.getElementById('addTaskBtn')?.addEventListener('click', () => openModal());
}
