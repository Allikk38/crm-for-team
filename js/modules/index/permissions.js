/**
 * ============================================
 * ФАЙЛ: js/modules/index/permissions.js
 * РОЛЬ: Определение прав доступа для модуля дашборда
 * 
 * ОПИСАНИЕ:
 *   - Определяет права для просмотра дашборда и виджетов
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля дашборда
export const INDEX_PERMISSIONS = {
    VIEW_DASHBOARD: 'view_dashboard',
    VIEW_STATISTICS: 'view_statistics',
    VIEW_WIDGETS: 'view_widgets'
};

// Проверка доступа к дашборду
export function canAccessDashboard(currentUser) {
    if (!currentUser) return false;
    
    // Все авторизованные пользователи имеют доступ к дашборду
    return true;
}

// Проверка, может ли пользователь видеть статистику
export function canViewStatistics(currentUser) {
    if (!currentUser) return false;
    
    // Все авторизованные пользователи видят свою статистику
    // Администратор и менеджер видят общую
    return true;
}
