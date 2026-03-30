/**
 * ============================================
 * ФАЙЛ: js/modules/complexes/permissions.js
 * РОЛЬ: Определение прав доступа для модуля объектов
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для различных операций с объектами
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля объектов
export const COMPLEX_PERMISSIONS = {
    // Базовые права
    VIEW_COMPLEXES: 'view_complexes',           // Просмотр объектов
    CREATE_COMPLEXES: 'create_complexes',       // Создание объектов
    EDIT_OWN_COMPLEXES: 'edit_own_complexes',   // Редактирование своих объектов
    EDIT_ALL_COMPLEXES: 'edit_all_complexes',   // Редактирование любых объектов
    DELETE_COMPLEXES: 'delete_complexes',       // Удаление объектов
    VIEW_TASKS_BY_COMPLEX: 'view_tasks_by_complex' // Просмотр задач по объекту
};

// Проверка прав для объектов
export function canViewComplex(complex, currentUser) {
    if (!currentUser) return false;
    
    // Администратор и менеджер видят все
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return true;
    }
    
    // Публичный объект видят все
    if (complex.is_public) {
        return true;
    }
    
    // Приватный объект видят только назначенные агенты
    return complex.assigned_to === currentUser.github_username;
}

export function canEditComplex(complex, currentUser) {
    if (!currentUser) return false;
    
    // Администратор может редактировать всё
    if (currentUser.role === 'admin') return true;
    
    // Менеджер может редактировать любые
    if (currentUser.role === 'manager') return true;
    
    // Агент редактирует только назначенные ему
    return complex.assigned_to === currentUser.github_username;
}

export function canDeleteComplex(complex, currentUser) {
    if (!currentUser) return false;
    
    // Только администратор может удалять объекты
    if (currentUser.role === 'admin') return true;
    
    return false;
}
