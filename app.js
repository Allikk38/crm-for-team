// app.js - логика главной страницы

// Загрузка и отображение статистики
async function loadDashboardStats() {
    try {
        // Загружаем пользователей
        const users = await loadCSV('data/users.csv');
        document.getElementById('usersCount').textContent = users.length;
        
        // Загружаем задачи (пока заглушка)
        // TODO: после создания tasks.csv
        document.getElementById('tasksCount').textContent = '0';
        
        // Загружаем ЖК (пока заглушка)
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
