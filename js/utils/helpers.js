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
 *   - 02.04.2026: Добавлены функции isValidEmail и formatSupabaseError
 *   - 10.04.2026: УДАЛЁНЫ ГЛОБАЛЬНЫЕ ОБЪЕКТЫ window.CRM.helpers, window.isValidEmail, window.formatSupabaseError (правило №5)
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

// ========== ФУНКЦИИ ВАЛИДАЦИИ ==========

/**
 * Проверка корректности формата email
 * @param {string} email - email для проверки
 * @returns {boolean} - true если формат корректный
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Стандартный regex для валидации email
    // Допускает: латиницу, цифры, точки, дефисы, плюсы в локальной части
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
}

/**
 * Преобразование ошибки Supabase в понятное пользовательское сообщение
 * @param {Error|Object} error - ошибка от Supabase
 * @returns {string} - понятное сообщение для пользователя
 */
export function formatSupabaseError(error) {
    if (!error) return 'Неизвестная ошибка';
    
    const message = error.message || '';
    const status = error.status;
    
    // Обработка по кодам и тексту ошибки
    if (message.includes('User already registered') || 
        message.includes('already registered') ||
        message.includes('email already exists')) {
        return 'Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.';
    }
    
    if (message.includes('invalid email') || 
        message.includes('Invalid email')) {
        return 'Введите корректный email (например, name@domain.com)';
    }
    
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        status === 429) {
        return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
    }
    
    if (message.includes('password') && message.includes('6')) {
        return 'Пароль должен содержать не менее 6 символов.';
    }
    
    if (message.includes('validation') || 
        message.includes('Invalid')) {
        return 'Проверьте правильность заполнения формы.';
    }
    
    // Для остальных ошибок возвращаем стандартное сообщение
    return message || 'Ошибка при выполнении запроса. Попробуйте позже.';
}
