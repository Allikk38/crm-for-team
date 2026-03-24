// calendar.js - календарь задач

let tasks = [];
let currentDate = new Date();

async function loadTasksForCalendar() {
    tasks = await loadCSV('data/tasks.csv');
    tasks = tasks.map(task => ({
        ...task,
        id: parseInt(task.id),
        due_date: task.due_date || null
    }));
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay() || 7; // Понедельник = 1
    
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
    
    dayDiv.innerHTML = `
        <div class="day-number">${date.getDate()}</div>
        <div class="day-tasks">
            ${dayTasks.slice(0, 3).map(task => `
                <div class="day-task ${task.priority}" title="${escapeHtml(task.title)}">
                    ${escapeHtml(task.title.length > 20 ? task.title.slice(0, 18) + '...' : task.title)}
                </div>
            `).join('')}
            ${dayTasks.length > 3 ? `<div class="day-task">+${dayTasks.length - 3} ещё</div>` : ''}
        </div>
    `;
    
    if (dayTasks.length > 0) {
        dayDiv.style.cursor = 'pointer';
        dayDiv.addEventListener('click', () => {
            window.location.href = `tasks.html?date=${dateStr}`;
        });
    }
    
    container.appendChild(dayDiv);
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
    await loadTasksForCalendar();
    window.theme.initTheme();
    
    document.getElementById('prevMonth').addEventListener('click', prevMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);
    document.getElementById('todayBtn').addEventListener('click', goToToday);
}

document.addEventListener('DOMContentLoaded', init);
