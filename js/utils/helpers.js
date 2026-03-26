/**
 * ============================================
 * ФАЙЛ: js/utils/helpers.js
 * РОЛЬ: Общие вспомогательные функции
 * ЗАВИСИМОСТИ:
 *   - js/utils/constants.js (опционально)
 * ИСПОЛЬЗУЕТСЯ В: всех модулях
 * ============================================
 */

window.CRM = window.CRM || {};
window.CRM.helpers = {};

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.CRM.helpers.escapeHtml = escapeHtml;
window.escapeHtml = escapeHtml; // Для обратной совместимости

// Форматирование даты
function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    
    var d;
    if (typeof date === 'string') {
        d = new Date(date);
    } else {
        d = date;
    }
    
    if (isNaN(d.getTime())) return date;
    
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    
    if (format === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
    } else if (format === 'DD.MM.YYYY') {
        return `${day}.${month}.${year}`;
    } else if (format === 'DD.MM.YYYY HH:MM') {
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    
    return `${year}-${month}-${day}`;
}
window.CRM.helpers.formatDate = formatDate;
window.formatDate = formatDate; // Для обратной совместимости

// Отображение уведомлений (тосты)
function showToast(type, message, duration = 3000) {
    // Удаляем существующие тосты
    var existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    
    var icon = '';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    else icon = 'fa-info-circle';
    
    toast.innerHTML = '<i class="fas ' + icon + '"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, duration);
}
window.CRM.helpers.showToast = showToast;
window.showToast = showToast; // Для обратной совместимости

// Получение текста статуса задачи
function getTaskStatusText(status) {
    var labels = window.CRM_CONSTANTS?.TASK_STATUS_LABELS || {
        'todo': '📋 To Do',
        'in_progress': '⚙️ В работе',
        'done': '✅ Готово'
    };
    return labels[status] || status;
}
window.CRM.helpers.getTaskStatusText = getTaskStatusText;

// Получение текста приоритета
function getTaskPriorityText(priority) {
    var labels = window.CRM_CONSTANTS?.TASK_PRIORITY_LABELS || {
        'high': 'Высокий 🔴',
        'medium': 'Средний 🟡',
        'low': 'Низкий 🟢'
    };
    return labels[priority] || priority;
}
window.CRM.helpers.getTaskPriorityText = getTaskPriorityText;

// Получение текста роли
function getUserRoleText(role) {
    var labels = window.CRM_CONSTANTS?.USER_ROLE_LABELS || {
        'admin': '👑 Администратор',
        'manager': '📊 Менеджер',
        'agent': '🤵 Агент',
        'viewer': '👁️ Наблюдатель'
    };
    return labels[role] || role;
}
window.CRM.helpers.getUserRoleText = getUserRoleText;

// Получение текста статуса сделки
function getDealStatusText(status) {
    var labels = window.CRM_CONSTANTS?.DEAL_STATUS_LABELS || {
        'new': '🆕 Новая',
        'contacted': '📞 Связались',
        'negotiation': '🤝 Переговоры',
        'contract': '📄 Договор',
        'closed': '✅ Закрыта',
        'lost': '❌ Потеряна'
    };
    return labels[status] || status;
}
window.CRM.helpers.getDealStatusText = getDealStatusText;

// Генерация уникального ID
function generateId(prefix = '') {
    return prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}
window.CRM.helpers.generateId = generateId;

// Дебаунс для оптимизации
function debounce(func, wait) {
    var timeout;
    return function executedFunction() {
        var context = this;
        var args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
window.CRM.helpers.debounce = debounce;

console.log('[helpers.js] Загружены вспомогательные функции');
