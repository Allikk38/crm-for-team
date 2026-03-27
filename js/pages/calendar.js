/**
 * ============================================
 * ФАЙЛ: js/pages/calendar.js
 * РОЛЬ: Логика страницы календаря задач (Supabase версия)
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение задач на календаре
 *   - Drag-and-drop для изменения дедлайнов
 *   - Навигация по месяцам
 *   - Удаление дедлайнов
 *   - Равномерная сетка 7x6
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из calendar-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

// Состояние страницы
let tasks = [];
let users = [];
let currentUser = null;
let currentDate = new Date();

console.log('[calendar.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
        users = data;
        console.log(`[calendar] Загружено ${users.length} пользователей`);
    }
}

async function loadTasks() {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id);
    
    if (!error && data) {
        tasks = data;
        console.log(`[calendar] Загружено ${tasks.length} задач`);
        renderCalendar();
    } else {
        console.error('[calendar] Ошибка загрузки задач:', error);
        tasks = [];
    }
}

// ========== СОХРАНЕНИЕ ==========

async function updateTaskDueDate(taskId, newDueDate) {
    const task = tasks.find(t => t.id == taskId);
    if (!task) return;
    
    const { error } = await supabase
        .from('tasks')
        .update({ 
            due_date: newDueDate, 
            updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
    
    if (!error) {
        task.due_date = newDueDate;
        renderCalendar();
        if (newDueDate) {
            showToast('success', `Дедлайн задачи "${task.title}" изменён на ${formatDate(newDueDate)}`);
        } else {
            showToast('info', `Дедлайн задачи "${task.title}" удалён`);
        }
    } else {
        showToast('error', 'Ошибка сохранения');
    }
}

// ========== РЕНДЕРИНГ КАЛЕНДАРЯ ==========

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let startDayOfWeek = firstDayOfMonth.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 7 : startDayOfWeek;
    
    const daysInMonth = lastDayOfMonth.getDate();
    const daysFromPrevMonth = startDayOfWeek - 1;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    const currentMonthEl = document.getElementById('currentMonth');
    if (currentMonthEl) currentMonthEl.textContent = monthNames[month] + ' ' + year;
    
    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';
    
    // Группируем задачи по датам
    const tasksByDate = {};
    tasks.forEach(task => {
        if (task.due_date && task.due_date !== '') {
            if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
            tasksByDate[task.due_date].push(task);
        }
    });
    
    // Всегда 42 ячейки (6 недель)
    const totalCells = 42;
    const cells = [];
    
    // Предыдущий месяц
    for (let i = daysFromPrevMonth; i > 0; i--) {
        const date = new Date(year, month, -i + 1);
        cells.push({ date, isOtherMonth: true });
    }
    
    // Текущий месяц
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        cells.push({ date, isOtherMonth: false });
    }
    
    // Следующий месяц
    const remainingDays = totalCells - cells.length;
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        cells.push({ date, isOtherMonth: true });
    }
    
    // Отрисовка ячеек
    for (const cell of cells) {
        const { date, isOtherMonth } = cell;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        if (date.toDateString() === today.toDateString()) {
            dayDiv.classList.add('today');
        }
        
        if (isOtherMonth) {
            dayDiv.classList.add('other-month');
        }
        
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayTasks = tasksByDate[dateStr] || [];
        
        let tasksHtml = '';
        for (const task of dayTasks) {
            const assignee = users.find(u => u.github_username === task.assigned_to);
            const assigneeName = assignee ? assignee.name.split(' ')[0] : '?';
            let shortTitle = task.title;
            if (task.title.length > 20) {
                shortTitle = task.title.slice(0, 17) + '…';
            }
            
            const overdueClass = (dateStr < today.toISOString().split('T')[0] && task.status !== 'completed') ? 'overdue' : '';
            const completedClass = task.status === 'completed' ? 'completed' : '';
            
            tasksHtml += `
                <div class="day-task ${overdueClass} ${completedClass}" 
                     draggable="true" 
                     data-task-id="${task.id}" 
                     data-task-title="${escapeHtml(task.title)}">
                    <span class="task-title-small" title="${escapeHtml(task.title)} (${assigneeName})">
                        ${escapeHtml(shortTitle)}
                    </span>
                    <i class="fas fa-times remove-date" data-task-id="${task.id}" data-date="${dateStr}" title="Удалить дедлайн"></i>
                </div>
            `;
        }
        
        const countHtml = dayTasks.length > 0 ? `<span class="task-count">${dayTasks.length}</span>` : '';
        
        dayDiv.innerHTML = `
            <div class="day-number">
                <span>${date.getDate()}</span>
                ${countHtml}
            </div>
            <div class="day-tasks">${tasksHtml}</div>
        `;
        
        // Drag-and-drop для ячейки (только для текущего месяца)
        if (!isOtherMonth) {
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
                    await updateTaskDueDate(taskId, dateStr);
                }
            });
        }
        
        calendarDays.appendChild(dayDiv);
    }
    
    // Навешиваем обработчики на задачи
    document.querySelectorAll('.day-task').forEach(taskEl => {
        taskEl.addEventListener('dragstart', (e) => {
            taskEl.classList.add('dragging');
            const taskId = taskEl.getAttribute('data-task-id');
            e.dataTransfer.setData('text/plain', taskId);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        taskEl.addEventListener('dragend', () => {
            taskEl.classList.remove('dragging');
        });
        
        const removeBtn = taskEl.querySelector('.remove-date');
        if (removeBtn) {
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = removeBtn.getAttribute('data-task-id');
                await updateTaskDueDate(taskId, null);
            });
        }
    });
}

// ========== НАВИГАЦИЯ ПО МЕСЯЦАМ ==========

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    const container = document.querySelector('.calendar-container');
    if (container) container.classList.add('month-changing');
    renderCalendar();
    setTimeout(() => {
        if (container) container.classList.remove('month-changing');
    }, 300);
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    const container = document.querySelector('.calendar-container');
    if (container) container.classList.add('month-changing');
    renderCalendar();
    setTimeout(() => {
        if (container) container.classList.remove('month-changing');
    }, 300);
}

function goToToday() {
    currentDate = new Date();
    const container = document.querySelector('.calendar-container');
    if (container) container.classList.add('month-changing');
    renderCalendar();
    setTimeout(() => {
        if (container) container.classList.remove('month-changing');
    }, 300);
    showToast('info', 'Переход к текущей дате');
}

// ========== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ДЛЯ HTML ==========

window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.goToToday = goToToday;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initCalendarPage() {
    console.log('[calendar] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[calendar] Текущий пользователь:', currentUser?.name);
    
    await loadUsers();
    await loadTasks();
    
    document.getElementById('prevMonth')?.addEventListener('click', prevMonth);
    document.getElementById('nextMonth')?.addEventListener('click', nextMonth);
    document.getElementById('todayBtn')?.addEventListener('click', goToToday);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[calendar] Анимации инициализированы');
    }
    
    console.log('[calendar] Инициализация завершена');
}