/**
 * ============================================
 * ФАЙЛ: js/modules/deals/permissions.js
 * РОЛЬ: Определение прав доступа для модуля сделок
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для различных операций со сделками
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля сделок
export const DEAL_PERMISSIONS = {
    // Базовые права
    VIEW_OWN_DEALS: 'view_own_deals',
    VIEW_TEAM_DEALS: 'view_team_deals',
    CREATE_DEALS: 'create_deals',
    EDIT_OWN_DEALS: 'edit_own_deals',
    EDIT_ANY_DEAL: 'edit_any_deal',
    UPDATE_DEAL_STATUS: 'update_deal_status',
    DELETE_DEALS: 'delete_deals'
};

// Проверка прав для сделок
export function canViewDeal(deal, currentUser) {
    if (!currentUser) return false;
    
    // Администратор и менеджер видят все
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return true;
    }
    
    // Агент видит только свои сделки
    return deal.agent_id === currentUser.github_username;
}

export function canEditDeal(deal, currentUser) {
    if (!currentUser) return false;
    
    // Администратор может редактировать всё
    if (currentUser.role === 'admin') return true;
    
    // Менеджер может редактировать любые
    if (currentUser.role === 'manager') return true;
    
    // Агент редактирует только свои
    return deal.agent_id === currentUser.github_username;
}
