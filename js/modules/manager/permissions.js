/**
 * ============================================
 * ФАЙЛ: js/modules/manager/permissions.js
 * РОЛЬ: Определение прав доступа для модуля панели менеджера
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для доступа к панели менеджера
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля менеджера
export const MANAGER_PERMISSIONS = {
    VIEW_MANAGER_PANEL: 'view_team_kpi',
    VIEW_TEAM_TASKS: 'view_team_tasks',
    VIEW_TEAM_DEALS: 'view_team_deals',
    MANAGE_TEAM: 'manage_team',
    ASSIGN_TASKS: 'assign_tasks'
};

// Проверка доступа к панели менеджера
export function canAccessManagerPanel(currentUser) {
    if (!currentUser) return false;
    
    // Администратор всегда имеет доступ
    if (currentUser.role === 'admin') return true;
    
    // Менеджер имеет доступ
    if (currentUser.role === 'manager') return true;
    
    return false;
}

// Проверка, может ли пользователь видеть данные агента
export function canViewAgentData(agent, currentUser) {
    if (!currentUser) return false;
    
    // Администратор видит всех
    if (currentUser.role === 'admin') return true;
    
    // Менеджер видит всех агентов
    if (currentUser.role === 'manager') return true;
    
    // Агент видит только свои данные
    return agent.github_username === currentUser.github_username;
}
