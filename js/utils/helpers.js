/**
 * ============================================
 * ФАЙЛ: helpers.js
 * РОЛЬ: Вспомогательные функции
 * СТАТУС: НОВЫЙ МОДУЛЬ
 * ВЕРСИЯ: 1.0
 * ============================================
 */

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Получение инициалов
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Проверка просрочки
function isOverdue(dateString) {
    if (!dateString) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateString < today;
}

// Форматирование цены
function formatPrice(price) {
    if (!price) return '0 RUB';
    return price.toLocaleString() + ' RUB';
}

// Показ уведомления (toast)
function showToast(type, message) {
    console.log('[helpers.js] Показ уведомления:', type, message);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Дебаунс для фильтров
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Генерация уникального ID
function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Глубокое клонирование объекта
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Экспортируем в глобальный объект
window.CRM = window.CRM || {};
window.CRM.helpers = {
    escapeHtml,
    formatDate,
    getInitials,
    isOverdue,
    formatPrice,
    showToast,
    debounce,
    generateId,
    deepClone
};

console.log('[helpers.js] Вспомогательные функции загружены');
