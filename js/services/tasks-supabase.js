/**
 * ============================================
 * ФАЙЛ: js/services/tasks-supabase.js
 * РОЛЬ: Сервис для работы с задачами через Supabase
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * ============================================
 * 
 * ВНИМАНИЕ: Этот файл НЕ заменяет существующий tasks.js
 * Он создан как альтернативный слой для будущего перехода.
 * Существующая функциональность на CSV НЕ нарушается.
 * 
 * Использование: импортировать функции отсюда в новые модули
 * ============================================
 */

import { supabase } from '../core/supabase.js';

/**
 * Получить все задачи текущего пользователя
 * @returns {Promise<Array>} Массив задач
 */
export async function getTasks() {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true, nullsLast: true });
    
    if (error) {
        console.error('[tasks-supabase] Ошибка загрузки задач:', error);
        return [];
    }
    return data || [];
}

/**
 * Получить задачу по ID
 * @param {string|number} id - ID задачи
 * @returns {Promise<Object|null>} Задача или null
 */
export async function getTaskById(id) {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('[tasks-supabase] Ошибка загрузки задачи:', error);
        return null;
    }
    return data;
}

/**
 * Создать новую задачу
 * @param {Object} taskData - Данные задачи
 * @returns {Promise<Object|null>} Созданная задача или null
 */
export async function createTask(taskData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        console.error('[tasks-supabase] Пользователь не авторизован');
        return null;
    }
    
    const { data, error } = await supabase
        .from('tasks')
        .insert([{
            title: taskData.title,
            description: taskData.description || '',
            assigned_to: taskData.assigned_to,
            created_by: user.id,
            status: taskData.status || 'pending',
            priority: taskData.priority || 'medium',
            deadline: taskData.due_date || null,
            complex_id: taskData.complex_id || null,
            is_private: taskData.is_private || false
        }])
        .select();
    
    if (error) {
        console.error('[tasks-supabase] Ошибка создания задачи:', error);
        return null;
    }
    return data[0];
}

/**
 * Обновить задачу
 * @param {string|number} id - ID задачи
 * @param {Object} updates - Данные для обновления
 * @returns {Promise<Object|null>} Обновленная задача или null
 */
export async function updateTask(id, updates) {
    const { data, error } = await supabase
        .from('tasks')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();
    
    if (error) {
        console.error('[tasks-supabase] Ошибка обновления задачи:', error);
        return null;
    }
    return data[0];
}

/**
 * Удалить задачу
 * @param {string|number} id - ID задачи
 * @returns {Promise<boolean>} Успех операции
 */
export async function deleteTask(id) {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('[tasks-supabase] Ошибка удаления задачи:', error);
        return false;
    }
    return true;
}

/**
 * Обновить статус задачи
 * @param {string|number} id - ID задачи
 * @param {string} status - Новый статус (pending, in_progress, completed)
 * @returns {Promise<Object|null>} Обновленная задача
 */
export async function updateTaskStatus(id, status) {
    const updates = { status };
    
    if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
    }
    
    return await updateTask(id, updates);
}

/**
 * Получить просроченные задачи
 * @returns {Promise<Array>} Массив просроченных задач
 */
export async function getOverdueTasks() {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .lt('deadline', today)
        .eq('status', 'pending');
    
    if (error) {
        console.error('[tasks-supabase] Ошибка загрузки просроченных задач:', error);
        return [];
    }
    return data || [];
}

/**
 * Получить задачи на сегодня
 * @returns {Promise<Array>} Массив задач на сегодня
 */
export async function getTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('deadline', today);
    
    if (error) {
        console.error('[tasks-supabase] Ошибка загрузки задач на сегодня:', error);
        return [];
    }
    return data || [];
}
