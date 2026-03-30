/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/permissions.js
 * РОЛЬ: Определение прав доступа для модуля задач
 * 
 * ОПИСАНИЕ:
 *   - Определяет, какие права нужны для различных операций с задачами
 *   - Интегрируется с основной системой прав (permissions.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 * ============================================
 */

// Права для модуля задач
export const TASK_PERMISSIONS = {
    VIEW_TASKS: 'view_tasks',
    CREATE_TASKS: 'create_tasks',
    EDIT_OWN_TASKS: 'edit_own_tasks',
    EDIT_ANY_TASK: 'edit_any_task',
    DELETE_OWN_TASKS: 'delete_own_tasks',
    DELETE_ANY_TASK: 'delete_any_task',
    ASSIGN_TASKS: 'assign_tasks',
    COMMENT_ON_TASKS: 'add_comments'
};

// Проверка прав для задач
export function canViewTask(task, currentUser) {
    if (!currentUser) return false;
    
    // Администратор и менеджер видят все
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return true;
    }
    
    // Если задача приватная, только исполнитель и создатель видят
    if (task.is_private) {
        return task.assigned_to === currentUser.github_username || 
               task.created_by === currentUser.email;
    }
    
    // Агент видит только свои задачи
    return task.assigned_to === currentUser.github_username;
}

export function canEditTask(task, currentUser) {
    if (!currentUser) return false;
    
    // Администратор может редактировать всё
    if (currentUser.role === 'admin') return true;
    
    // Менеджер может редактировать любые задачи
    if (currentUser.role === 'manager') return true;
    
    // Агент редактирует только свои
    return task.assigned_to === currentUser.github_username;
}

export function canDeleteTask(task, currentUser) {
    if (!currentUser) return false;
    
    // Администратор может удалять всё
    if (currentUser.role === 'admin') return true;
    
    // Менеджер может удалять любые
    if (currentUser.role === 'manager') return true;
    
    // Агент удаляет только свои
    return task.assigned_to === currentUser.github_username;
}
