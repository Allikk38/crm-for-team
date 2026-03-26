/**
 * ФАЙЛ: constants.js
 * РОЛЬ: Централизованное хранение констант
 */

// Роли пользователей
export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    AGENT: 'agent',
    VIEWER: 'viewer'
};

// Права доступа
export const PERMISSIONS = {
    VIEW_ALL: 'view_all',
    EDIT_ALL: 'edit_all',
    DELETE_ALL: 'delete_all',
    MANAGE_USERS: 'manage_users',
    VIEW_MANAGER_PANEL: 'view_manager_panel'
};

// Статусы задач
export const TASK_STATUSES = {
    TODO: 'todo',
    IN_PROGRESS: 'in_progress',
    DONE: 'done'
};

// Статусы заявок
export const DEAL_STATUSES = [
    { id: 'new', name: 'Новая', icon: 'N', color: '#9e9e9e' },
    { id: 'showing', name: 'Показ', icon: 'V', color: '#2196f3' },
    { id: 'negotiation', name: 'Торг', icon: 'R', color: '#ffc107' },
    { id: 'deposit', name: 'Задаток', icon: 'D', color: '#9c27b0' },
    { id: 'documents', name: 'Документы', icon: 'P', color: '#ff9800' },
    { id: 'contract', name: 'Договор', icon: 'S', color: '#f44336' },
    { id: 'payment', name: 'Расчёт', icon: 'M', color: '#4caf50' },
    { id: 'closed', name: 'Закрыта', icon: 'C', color: '#607d8b' },
    { id: 'cancelled', name: 'Отказ', icon: 'X', color: '#9e9e9e' }
];

// Типы сделок
export const DEAL_TYPES = {
    primary: { name: 'Первичка', icon: 'P', class: 'type-primary' },
    secondary: { name: 'Вторичка', icon: 'S', class: 'type-secondary' },
    exchange: { name: 'Альтернатива', icon: 'A', class: 'type-exchange' },
    urgent: { name: 'Срочный выкуп', icon: 'U', class: 'type-urgent' }
};

// Типы контрагентов
export const COUNTERPARTY_TYPES = {
    seller: { name: 'Продавец', icon: 'S', class: 'type-seller' },
    buyer: { name: 'Покупатель', icon: 'B', class: 'type-buyer' },
    developer: { name: 'Застройщик', icon: 'D', class: 'type-developer' },
    investor: { name: 'Инвестор', icon: 'I', class: 'type-investor' }
};

// Приоритеты задач
export const TASK_PRIORITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

// Навигация
export const NAVIGATION_ITEMS = [
    { path: 'index.html', icon: 'fas fa-chart-line', name: 'Дашборд', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { path: 'tasks.html', icon: 'fas fa-tasks', name: 'Доска задач', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { path: 'complexes.html', icon: 'fas fa-building', name: 'Объекты', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { path: 'deals.html', icon: 'fas fa-handshake', name: 'Заявки', roles: ['admin', 'manager', 'agent'] },
    { path: 'counterparties.html', icon: 'fas fa-users', name: 'Контрагенты', roles: ['admin', 'manager', 'agent'] },
    { path: 'calendar.html', icon: 'fas fa-calendar-alt', name: 'Календарь', roles: ['admin', 'manager', 'agent', 'viewer'] },
    { path: 'calendar-integration.html', icon: 'fas fa-plug', name: 'Подключить календарь', roles: ['admin', 'manager', 'agent'] },
    { path: 'manager.html', icon: 'fas fa-chart-simple', name: 'Панель менеджера', roles: ['admin', 'manager'] },
    { path: 'admin.html', icon: 'fas fa-user-cog', name: 'Управление', roles: ['admin'] }
];
