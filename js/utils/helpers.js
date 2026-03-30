/**
 * ============================================
 * ФАЙЛ: js/utils/helpers.js
 * РОЛЬ: Общие вспомогательные функции
 * ЗАВИСИМОСТИ:
 *   - js/utils/constants.js (опционально)
 * ИСПОЛЬЗУЕТСЯ В: всех модулях
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Добавлены экспорты для модульной архитектуры
 *   - 30.03.2026: Полный переход на модульную загрузку
 * ============================================
 */

// Экранирование HTML
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование даты
export function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    
    let d;
    if (typeof date === 'string') {
        d = new Date(date);
    } else {
        d = date;
    }
    
    if (isNaN(d.getTime())) return date;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    if (format === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
    } else if (format === 'DD.MM.YYYY') {
        return `${day}.${month}.${year}`;
    } else if (format === 'DD.MM.YYYY HH:MM') {
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    
    return `${year}-${month}-${day}`;
}

// Отображение уведомлений (тосты)
export function showToast(type, message, duration = 3000) {
    // Удаляем существующие тосты
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    else icon = 'fa-info-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Получение текста статуса задачи
export function getTaskStatusText(status) {
    const labels = window.CRM_CONSTANTS?.TASK_STATUS_LABELS || {
        'todo': '📋 To Do',
        'in_progress': '⚙️ В работе',
        'done': '✅ Готово'
    };
    return labels[status] || status;
}

// Получение текста приоритета
export function getTaskPriorityText(priority) {
    const labels = window.CRM_CONSTANTS?.TASK_PRIORITY_LABELS || {
        'high': 'Высокий 🔴',
        'medium': 'Средний 🟡',
        'low': 'Низкий 🟢'
    };
    return labels[priority] || priority;
}

// Получение текста роли
export function getUserRoleText(role) {
    const labels = window.CRM_CONSTANTS?.USER_ROLE_LABELS || {
        'admin': '👑 Администратор',
        'manager': '📊 Менеджер',
        'agent': '🤵 Агент',
        'viewer': '👁️ Наблюдатель'
    };
    return labels[role] || role;
}

// Получение текста статуса сделки
export function getDealStatusText(status) {
    const labels = window.CRM_CONSTANTS?.DEAL_STATUS_LABELS || {
        'new': '🆕 Новая',
        'contacted': '📞 Связались',
        'negotiation': '🤝 Переговоры',
        'contract': '📄 Договор',
        'closed': '✅ Закрыта',
        'lost': '❌ Потеряна'
    };
    return labels[status] || status;
}

// Генерация уникального ID
export function generateId(prefix = '') {
    return prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Дебаунс для оптимизации
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== ГЛОБАЛЬНАЯ РЕГИСТРАЦИЯ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========
// Это нужно для скриптов, которые еще не переведены на модули
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.helpers = {
        escapeHtml,
        formatDate,
        showToast,
        getTaskStatusText,
        getTaskPriorityText,
        getUserRoleText,
        getDealStatusText,
        generateId,
        debounce
    };
    
    // Для обратной совместимости со старым кодом
    window.escapeHtml = escapeHtml;
    window.formatDate = formatDate;
    window.showToast = showToast;
}

console.log('[helpers.js] Загружены вспомогательные функции (модульная версия)');