/**
 * ============================================
 * ФАЙЛ: calendar-integration.js
 * РОЛЬ: Логика интеграции с внешними календарями (Google, Apple, Outlook)
 * СВЯЗИ:
 *   - core.js: loadCSV(), window.utils.saveCSVToGitHub()
 *   - auth.js: auth.getCurrentUser()
 *   - Данные: data/tasks.csv, data/user_settings.csv
 * МЕХАНИКА:
 *   1. Генерация iCal-ссылки для подписки на задачи
 *   2. Экспорт задач в .ics файл (для импорта в календарь)
 *   3. Сохранение настроек уведомлений
 *   4. Генерация тестового события для проверки
 * ============================================
 */

let currentUserTasks = [];
let allTasks = [];

// Генерация iCal-ссылки (в реальной реализации нужен бэкенд)
function generateIcalUrl() {
    const user = auth.getCurrentUser();
    if (!user) return '';
    
    // Для демонстрации генерируем локальную ссылку
    // В реальной CRM нужен бэкенд, который будет отдавать .ics файл
    const baseUrl = window.location.origin + window.location.pathname.replace('calendar-integration.html', '');
    const token = btoa(user.github_username + ':' + Date.now());
    
    // Сохраняем токен для "бэкенда"
    localStorage.setItem('ical_token_' + token, user.github_username);
    
    return baseUrl + 'ical.ics?token=' + token;
}

// Копирование iCal-ссылки
function copyIcalUrl() {
    const url = generateIcalUrl();
    navigator.clipboard.writeText(url).then(() => {
        showToast('success', 'Ссылка скопирована! Вставьте её в Google Календарь');
    }).catch(() => {
        showToast('info', 'Скопируйте ссылку вручную: ' + url);
    });
}

// Генерация .ics файла для экспорта
function generateIcsFile(tasks, title) {
    let ics = 'BEGIN:VCALENDAR\n';
    ics += 'VERSION:2.0\n';
    ics += 'PRODID:-//CRM Team//Task Calendar//RU\n';
    ics += 'CALSCALE:GREGORIAN\n';
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (!task.due_date) continue;
        
        const dueDate = new Date(task.due_date);
        const dueDateStr = dueDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        ics += 'BEGIN:VEVENT\n';
        ics += 'UID:' + task.id + '-' + Date.now() + '@crm-team\n';
        ics += 'DTSTAMP:' + dueDateStr + '\n';
        ics += 'DTSTART:' + dueDateStr + '\n';
        ics += 'DTEND:' + dueDateStr + '\n';
        ics += 'SUMMARY:' + escapeIcs(task.title) + '\n';
        if (task.description) {
            ics += 'DESCRIPTION:' + escapeIcs(task.description) + '\n';
        }
        if (task.complex_id) {
            ics += 'LOCATION:' + escapeIcs('Объект: ' + (task.complex_title || 'ID ' + task.complex_id)) + '\n';
        }
        ics += 'PRIORITY:' + (task.priority === 'high' ? 1 : task.priority === 'medium' ? 3 : 5) + '\n';
        ics += 'END:VEVENT\n';
    }
    
    ics += 'END:VCALENDAR';
    return ics;
}

function escapeIcs(text) {
    if (!text) return '';
    return text.replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
}

// Экспорт задач в файл
function downloadIcsFile(tasks, filename) {
    const ics = generateIcsFile(tasks, filename);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename + '.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Файл ' + filename + '.ics скачан. Импортируйте его в календарь');
}

// Экспорт всех задач
async function exportAllTasks() {
    const tasks = await loadCSV('data/tasks.csv');
    const tasksWithDueDate = tasks.filter(t => t.due_date);
    downloadIcsFile(tasksWithDueDate, 'crm_all_tasks');
}

// Экспорт моих задач
async function exportMyTasks() {
    const user = auth.getCurrentUser();
    if (!user) return;
    
    const tasks = await loadCSV('data/tasks.csv');
    const myTasks = tasks.filter(t => t.assigned_to === user.github_username && t.due_date);
    downloadIcsFile(myTasks, 'crm_my_tasks');
}

// Экспорт задач на текущий месяц
async function exportCurrentMonth() {
    const tasks = await loadCSV('data/tasks.csv');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthTasks = tasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
    });
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    downloadIcsFile(monthTasks, 'crm_' + monthNames[currentMonth] + '_' + currentYear);
}

// Загрузка задач для быстрого экспорта
async function loadTasksForExport() {
    const container = document.getElementById('recentTasksExport');
    if (!container) return;
    
    const user = auth.getCurrentUser();
    if (!user) return;
    
    const tasks = await loadCSV('data/tasks.csv');
    const myTasks = tasks.filter(t => t.assigned_to === user.github_username && t.due_date);
    myTasks.sort((a, b) => (a.due_date > b.due_date) ? 1 : -1);
    const recentTasks = myTasks.slice(0, 5);
    
    if (recentTasks.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Нет задач с дедлайнами</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < recentTasks.length; i++) {
        const task = recentTasks[i];
        const dueDate = task.due_date.split('-').reverse().join('.');
        html += '<div class="calendar-item">' +
            '<div class="calendar-item-info">' +
                '<i class="fas fa-tasks"></i>' +
                '<div>' +
                    '<div><strong>' + escapeHtml(task.title) + '</strong></div>' +
                    '<div style="font-size: 0.7rem; color: var(--text-muted);">Дедлайн: ' + dueDate + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="calendar-item-actions">' +
                '<button onclick="exportSingleTask(' + task.id + ')"><i class="fas fa-download"></i></button>' +
            '</div>' +
        '</div>';
    }
    
    container.innerHTML = html;
}

// Экспорт одной задачи
async function exportSingleTask(taskId) {
    const tasks = await loadCSV('data/tasks.csv');
    const task = tasks.find(t => parseInt(t.id) === taskId);
    if (task && task.due_date) {
        downloadIcsFile([task], 'task_' + task.id);
    }
}

// Тестовое событие для Google Календаря
async function testGoogleCalendar() {
    const user = auth.getCurrentUser();
    if (!user) return;
    
    const testEvent = [{
        id: 999999,
        title: 'Тестовое событие CRM',
        description: 'Проверка интеграции с календарём. Если вы видите это событие — интеграция работает!',
        due_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        complex_id: null
    }];
    
    downloadIcsFile(testEvent, 'crm_test_event');
    showToast('success', 'Тестовое событие создано. Импортируйте .ics файл в календарь');
}

// Сохранение настроек уведомлений
function saveNotificationSettings() {
    const settings = {
        remind1day: document.getElementById('remind1day')?.checked || false,
        remind3days: document.getElementById('remind3days')?.checked || false,
        remindToday: document.getElementById('remindToday')?.checked || false,
        emailReminders: document.getElementById('emailReminders')?.checked || false
    };
    
    localStorage.setItem('crm_calendar_settings', JSON.stringify(settings));
    showToast('success', 'Настройки сохранены');
}

// Загрузка настроек уведомлений
function loadNotificationSettings() {
    const saved = localStorage.getItem('crm_calendar_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (document.getElementById('remind1day')) document.getElementById('remind1day').checked = settings.remind1day || false;
            if (document.getElementById('remind3days')) document.getElementById('remind3days').checked = settings.remind3days || false;
            if (document.getElementById('remindToday')) document.getElementById('remindToday').checked = settings.remindToday || false;
            if (document.getElementById('emailReminders')) document.getElementById('emailReminders').checked = settings.emailReminders || false;
        } catch(e) {}
    }
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle') + '"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function init() {
    await auth.initAuth();
    
    const user = auth.getCurrentUser();
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        const roleLabel = user.role === 'admin' ? 'Администратор' : user.role === 'manager' ? 'Менеджер' : user.role === 'agent' ? 'Агент' : 'Наблюдатель';
        userNameSpan.innerHTML = '<i class="fas fa-user-circle"></i> ' + escapeHtml(user.name) + ' (' + roleLabel + ')';
    }
    
    // Обновляем iCal-ссылку на странице
    const icalUrlSpan = document.getElementById('icalUrl');
    if (icalUrlSpan) {
        icalUrlSpan.textContent = generateIcalUrl();
    }
    
    await loadTasksForExport();
    loadNotificationSettings();
    
    if (window.theme) window.theme.initTheme();
}

window.copyIcalUrl = copyIcalUrl;
window.exportAllTasks = exportAllTasks;
window.exportMyTasks = exportMyTasks;
window.exportCurrentMonth = exportCurrentMonth;
window.exportSingleTask = exportSingleTask;
window.testGoogleCalendar = testGoogleCalendar;
window.saveNotificationSettings = saveNotificationSettings;

document.addEventListener('DOMContentLoaded', init);
