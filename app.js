// app.js - логика главной страницы

async function loadDashboardStats() {
    try {
        const users = await loadCSV('data/users.csv');
        document.getElementById('usersCount').textContent = users.length;
        
        const tasks = await loadCSV('data/tasks.csv');
        const activeTasks = tasks.filter(task => task.status !== 'done').length;
        document.getElementById('tasksCount').textContent = activeTasks;
        
        // Прогресс проекта
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.status === 'done').length;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('totalTasksCount').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('progressPercent').textContent = `${progressPercent}%`;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        
        document.getElementById('complexesCount').textContent = '0';
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function init() {
    await auth.initAuth();
    await loadDashboardStats();
    window.theme?.initTheme();
}

document.addEventListener('DOMContentLoaded', init);
