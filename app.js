// app.js - логика главной страницы

async function loadDashboardStats() {
    try {
        // Загружаем пользователей
        var users = await loadCSV('data/users.csv');
        var usersCountEl = document.getElementById('usersCount');
        if (usersCountEl) usersCountEl.textContent = users.length;
        
        // Загружаем задачи
        var tasks = await loadCSV('data/tasks.csv');
        var activeTasks = 0;
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].status !== 'done') activeTasks++;
        }
        var tasksCountEl = document.getElementById('tasksCount');
        if (tasksCountEl) tasksCountEl.textContent = activeTasks;
        
        // Прогресс проекта
        var totalTasks = tasks.length;
        var completedTasks = 0;
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].status === 'done') completedTasks++;
        }
        var progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        var totalTasksCountEl = document.getElementById('totalTasksCount');
        var completedTasksEl = document.getElementById('completedTasks');
        var progressPercentEl = document.getElementById('progressPercent');
        var progressFillEl = document.getElementById('progressFill');
        
        if (totalTasksCountEl) totalTasksCountEl.textContent = totalTasks;
        if (completedTasksEl) completedTasksEl.textContent = completedTasks;
        if (progressPercentEl) progressPercentEl.textContent = progressPercent + '%';
        if (progressFillEl) progressFillEl.style.width = progressPercent + '%';
        
        // Загружаем объекты
        var complexes = await loadCSV('data/complexes.csv');
        var complexesCount = complexes ? complexes.length : 0;
        var complexesCountEl = document.getElementById('complexesCount');
        if (complexesCountEl) complexesCountEl.textContent = complexesCount;
        
        console.log('Статистика загружена:', {
            users: users.length,
            activeTasks: activeTasks,
            totalTasks: totalTasks,
            complexes: complexesCount
        });
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function init() {
    await auth.initAuth();
    
    var currentUser = auth.getCurrentUser();
    if (currentUser) {
        var userNameSpan = document.getElementById('userName');
        var welcomeMessage = document.getElementById('welcomeMessage');
        
        if (userNameSpan) {
            var roleLabel = '';
            if (currentUser.role === 'admin') roleLabel = 'Администратор';
            else if (currentUser.role === 'manager') roleLabel = 'Менеджер';
            else if (currentUser.role === 'agent') roleLabel = 'Агент';
            else roleLabel = 'Наблюдатель';
            userNameSpan.innerHTML = '<i class="fab fa-github"></i> ' + escapeHtml(currentUser.name) + ' (' + roleLabel + ')';
        }
        
        if (welcomeMessage) {
            welcomeMessage.textContent = 'Добро пожаловать, ' + currentUser.name + '! Ваша роль: ' + 
                (currentUser.role === 'admin' ? 'Администратор' : 
                 currentUser.role === 'manager' ? 'Менеджер' : 
                 currentUser.role === 'agent' ? 'Агент' : 'Наблюдатель');
        }
    }
    
    await loadDashboardStats();
    
    if (window.theme) window.theme.initTheme();
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
