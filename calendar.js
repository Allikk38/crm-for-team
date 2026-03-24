// calendar.js - календарь с drag-and-drop

let tasks = [];
let users = [];
let currentDate = new Date();
let draggedTask = null;

async function loadCalendarData() {
    tasks = await loadCSV('data/tasks.csv');
    tasks = tasks.map(task => ({
        ...task,
        id: parseInt(task.id),
        due_date: task.due_date || null
    }));
    
    users = await loadCSV('data/users.csv');
    
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay() || 7;
    
    const daysInMonth = lastDayOfMonth.getDate();
    const daysFromPrevMonth = startDayOfWeek - 1;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    // Группируем задачи по датам
    const tasksByDate = {};
    tasks.forEach(task => {
        if (task.due_date) {
            if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
            tasksByDate[task.due_date].push(task);
        }
    });
    
    // Дни предыдущего месяца
    for (let i = daysFromPrevMonth; i > 0; i--) {
        const date = new Date(year, month, -i + 1);
        addCalendarDay(calendarDays, date, tasksByDate, true);
    }
    
    // Дни текущего месяца
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        addCalendarDay(calendarDays, date, tasksByDate, false);
    }
    
    // Дни следующего месяца
    const remainingDays = 42 - (daysFromPrevMonth + daysInMonth);
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        addCalendarDay(calendarDays, date, tasksByDate, true);
    }
}

function addCalendarDay(container, date, tasksByDate, isEmpty) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date.toDateString() === today.toDateString()) {
        dayDiv.classList.add('today');
    }
    
    if (isEmpty) {
        dayDiv.classList.add('empty');
    }
    
    const dateStr = date.toISOString().split('T')[0];
    const dayTasks = tasksByDate[dateStr] || [];
    
    // Создаём HTML для задач дня
    let tasksHtml = '';
    dayTasks.forEach(task => {
        const assignee = users.find(u => u.github_username === task.assigned_to);
        const assigneeName = assignee ? assignee.name.split(' ')[0] : '?';
        
        tasksHtml += `
            <div class="day-task ${task.priority}" draggable="true" data-task-id="${task.id}" data-task-title="${escapeHtml(task.title)}">
                <span class="task-title-small" title="${escapeHtml(task.title)} (${assigneeName})">
                    ${escapeHtml(task.title.length > 20 ? task.title.slice(0, 18) + '…' : task.title)}
                </span>
                <i class="fas fa-times remove-date" data-task-id="${task.id}" data-date="${dateStr}" title="Удалить дедлайн"></i>
            </div>
        `;
    });
    
    dayDiv.innerHTML = `
        <div class="day-number">
            <span>${date.getDate()}</span>
            ${dayTasks.length > 0 ? `<span style="font-size: 0.7rem; background: var(--accent); padding: 2px 6px; border-radius: 20px;">${dayTasks.length}</span>` : ''}
        </div>
        <div class="day-tasks">
            ${tasksHtml}
        </div>
    `;
    
    // Настройка drop-зоны
    if (!isEmpty) {
        dayDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            dayDiv.classList.add('drag-over');
        });
        
        dayDiv.addEventListener('dragleave', () => {
            dayDiv.classList.remove('drag-over');
        });
        
        dayDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            dayDiv.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) {
                await updateTaskDueDate(parseInt(taskId), dateStr);
            }
        });
    }
    
    container.appendChild(dayDiv);
    
    // Добавляем обработчики для перетаскивания задач
    dayDiv.querySelectorAll('.day-task').forEach(taskEl => {
        taskEl.addEventListener('dragstart', handleTaskDragStart);
        taskEl.addEventListener('dragend', handleTaskDragEnd);
        
        // Обработчик для удаления дедлайна
        const removeBtn = taskEl.querySelector('.remove-date');
        if (removeBtn) {
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = parseInt(removeBtn.dataset.taskId);
                await updateTaskDueDate(taskId, null);
            });
        }
    });
}

function handleTaskDragStart(e) {
    draggedTask = e.target.closest('.day-task');
    if (draggedTask) {
        draggedTask.classList.add('dragging');
        const taskId = draggedTask.getAttribute('data-task-id');
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleTaskDragEnd(e) {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        draggedTask = null;
    }
}

async function updateTaskDueDate(taskId, newDueDate) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const oldDate = task.due_date;
    task.due_date = newDueDate;
    task.updated_at = new Date().toISOString().split('T')[0];
    
    const saved = await saveTasksToGitHub();
    
    if (saved) {
        renderCalendar();
        showToast(
            newDueDate ? 'success' : 'info',
            newDueDate 
                ? `Дедлайн задачи "${task.title}" изменён на ${formatDate(newDueDate)}`
                : `Дедлайн задачи "${task.title}" удалён`
        );
    } else {
        // Откат при ошибке
        task.due_date = oldDate;
        alert('Ошибка сохранения. Попробуйте ещё раз.');
    }
}

async function saveTasksToGitHub() {
    const currentUser = auth.getCurrentUser();
    if (!currentUser || !auth.hasPermission('edit')) {
        alert('У вас нет прав на редактирование задач');
        return false;
    }
    
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
        `Update task due date by ${currentUser.name}`
    );
}

function showToast(type, message) {
    // Создаём toast-уведомление
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Стили для toast
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--card-bg);
        backdrop-filter: blur(10px);
        border: 1px solid var(--accent);
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        color: var(--text-primary);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
}

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

async function init() {
    await auth.initAuth();
    await loadCalendarData();
    window.theme.initTheme();
    
    // Добавляем стили для анимаций toast
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('prevMonth').addEventListener('click', prevMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);
    document.getElementById('todayBtn').addEventListener('click', goToToday);
}

document.addEventListener('DOMContentLoaded', init);
