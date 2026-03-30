/**
 * ============================================
 * ФАЙЛ: js/modules/admin/permissions.js
 * РОЛЬ: Определение прав доступа для модуля администратора
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для администрирования
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля администратора
export const ADMIN_PERMISSIONS = {
    MANAGE_USERS: 'manage_users',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_PERMISSIONS: 'manage_permissions',
    MANAGE_PLANS: 'manage_plans',
    SYSTEM_SETTINGS: 'system_settings',
    VIEW_ALL_DATA: 'view_all_data',
    DELETE_ANY_DATA: 'delete_any_data'
};

// Проверка доступа к админ-панели
export function canAccessAdminPanel(currentUser) {
    if (!currentUser) return false;
    
    // Только администратор имеет доступ
    return currentUser.role === 'admin';
}

// Проверка, может ли пользователь управлять другим пользователем
export function canManageUser(targetUser, currentUser) {
    if (!currentUser) return false;
    
    // Только администратор может управлять пользователями
    if (currentUser.role !== 'admin') return false;
    
    // Нельзя удалить самого себя
    if (targetUser.id === currentUser.id) return false;
    
    return true;
}

// Проверка, может ли пользователь изменять роль другого пользователя
export function canChangeRole(targetUser, currentUser, newRole) {
    if (!currentUser) return false;
    
    // Только администратор может менять роли
    if (currentUser.role !== 'admin') return false;
    
    // Нельзя изменить роль администратора (кроме самого себя)
    if (targetUser.role === 'admin' && targetUser.id !== currentUser.id) return false;
    
    return true;
}
