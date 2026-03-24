// app.js - логика главной страницы

// Загрузка и отображение статистики
async function loadDashboardStats() {
    try {
        // Загружаем пользователей
        const users = await loadCSV('data/users.csv');
        document.getElementById('usersCount').textContent = users.length;
        
        // Загружаем задачи и считаем активные (не выполненные)
        const tasks = await loadCSV('data/tasks.csv');
        const activeTasks = tasks.filter(task => task.status !== 'done').length;
        document.getElementById('tasksCount').textContent = activeTasks;
        
        // Загружаем объекты (пока заглушка, будет из realty-search)
        // TODO: после импорта complexes.csv
        document.getElementById('complexesCount').textContent = '0';
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Инициализация приложения
async function init() {
    // Инициализируем авторизацию
    await auth.initAuth();
    
    // Загружаем статистику
    await loadDashboardStats();
}

// Запускаем приложение после загрузки страницы
document.addEventListener('DOMContentLoaded', init);
