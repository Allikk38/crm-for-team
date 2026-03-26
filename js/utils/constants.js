/**
 * ============================================
 * ФАЙЛ: js/utils/constants.js
 * РОЛЬ: Глобальные константы приложения
 * ЗАВИСИМОСТИ: нет
 * ИСПОЛЬЗУЕТСЯ В: всех модулях
 * ============================================
 */

// Роли пользователей
window.CRM_CONSTANTS = window.CRM_CONSTANTS || {};

// Статусы задач
window.CRM_CONSTANTS.TASK_STATUSES = {
    TODO: 'todo',
    IN_PROGRESS: 'in_progress',
    DONE: 'done'
};

window.CRM_CONSTANTS.TASK_STATUS_LABELS = {
    'todo': '📋 To Do',
    'in_progress': '⚙️ В работе',
    'done': '✅ Готово'
};

// Приоритеты задач
window.CRM_CONSTANTS.TASK_PRIORITIES = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

window.CRM_CONSTANTS.TASK_PRIORITY_LABELS = {
    'high': 'Высокий 🔴',
    'medium': 'Средний 🟡',
    'low': 'Низкий 🟢'
};

// Статусы сделок
window.CRM_CONSTANTS.DEAL_STATUSES = {
    NEW: 'new',
    CONTACTED: 'contacted',
    NEGOTIATION: 'negotiation',
    CONTRACT: 'contract',
    CLOSED: 'closed',
    LOST: 'lost'
};

window.CRM_CONSTANTS.DEAL_STATUS_LABELS = {
    'new': '🆕 Новая',
    'contacted': '📞 Связались',
    'negotiation': '🤝 Переговоры',
    'contract': '📄 Договор',
    'closed': '✅ Закрыта',
    'lost': '❌ Потеряна'
};

// Типы контрагентов
window.CRM_CONSTANTS.COUNTERPARTY_TYPES = {
    BUYER: 'buyer',
    SELLER: 'seller',
    TENANT: 'tenant',
    LANDLORD: 'landlord',
    PARTNER: 'partner'
};

window.CRM_CONSTANTS.COUNTERPARTY_TYPE_LABELS = {
    'buyer': '🏠 Покупатель',
    'seller': '💰 Продавец',
    'tenant': '🏢 Арендатор',
    'landlord': '🏛️ Арендодатель',
    'partner': '🤝 Партнёр'
};

// Роли пользователей
window.CRM_CONSTANTS.USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    AGENT: 'agent',
    VIEWER: 'viewer'
};

window.CRM_CONSTANTS.USER_ROLE_LABELS = {
    'admin': '👑 Администратор',
    'manager': '📊 Менеджер',
    'agent': '🤵 Агент',
    'viewer': '👁️ Наблюдатель'
};

// Навигация
window.CRM_CONSTANTS.NAVIGATION_ITEMS = [
    { id: 'dashboard', title: 'Дашборд', icon: 'fa-chart-line', url: 'index.html', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { id: 'deals', title: 'Сделки', icon: 'fa-handshake', url: 'deals.html', roles: ['admin', 'manager', 'agent'] },
    { id: 'counterparties', title: 'Контрагенты', icon: 'fa-users', url: 'counterparties.html', roles: ['admin', 'manager', 'agent'] },
    { id: 'tasks', title: 'Задачи', icon: 'fa-tasks', url: 'tasks.html', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { id: 'calendar', title: 'Календарь', icon: 'fa-calendar-alt', url: 'calendar.html', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { id: 'complexes', title: 'Объекты', icon: 'fa-building', url: 'complexes.html', roles: ['admin', 'manager', 'agent'] },
    { id: 'manager', title: 'Панель менеджера', icon: 'fa-chalkboard-user', url: 'manager.html', roles: ['admin', 'manager'] },
    { id: 'profile', title: 'Профиль', icon: 'fa-user', url: 'profile.html', roles: ['admin', 'manager', 'agent', 'viewer'] }
];

// Типы уведомлений
window.CRM_CONSTANTS.NOTIFICATION_TYPES = {
    TASK_ASSIGNED: 'task_assigned',
    TASK_STATUS_CHANGE: 'task_status_change',
    MENTION: 'mention',
    DEAL_UPDATE: 'deal_update',
    DEADLINE: 'deadline'
};

console.log('[constants.js] Загружены константы');
