/**
 * ============================================
 * ФАЙЛ: js/modules/counterparties/permissions.js
 * РОЛЬ: Определение прав доступа для модуля контрагентов
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для различных операций с контрагентами
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля контрагентов
export const COUNTERPARTY_PERMISSIONS = {
    VIEW_COUNTERPARTIES: 'view_counterparties',
    CREATE_COUNTERPARTIES: 'create_counterparties',
    EDIT_OWN_COUNTERPARTIES: 'edit_own_counterparties',
    EDIT_ALL_COUNTERPARTIES: 'edit_all_counterparties',
    DELETE_COUNTERPARTIES: 'delete_counterparties',
    EXPORT_COUNTERPARTIES: 'export_counterparties'
};

// Проверка прав для контрагентов
export function canViewCounterparty(counterparty, currentUser) {
    if (!currentUser) return false;
    
    // Администратор и менеджер видят все
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return true;
    }
    
    // Агент видит контрагентов, связанных с его сделками
    // Права проверяются на уровне страницы
    return true;
}

export function canEditCounterparty(counterparty, currentUser) {
    if (!currentUser) return false;
    
    // Администратор может редактировать всё
    if (currentUser.role === 'admin') return true;
    
    // Менеджер может редактировать все
    if (currentUser.role === 'manager') return true;
    
    // Агент не может редактировать
    return false;
}

export function canDeleteCounterparty(counterparty, currentUser) {
    if (!currentUser) return false;
    
    // Только администратор может удалять
    return currentUser.role === 'admin';
}
