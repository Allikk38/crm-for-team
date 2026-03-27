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
 * 
 * ИСПРАВЛЕНИЯ:
 *   - Используется поле due_date вместо deadline
 *   - Добавлена фильтрация по user_id
 *   - Статусы: pending, in_progress, completed
 * ============================================
 */

import { supabase } from '../core/supabase.js';

/**
 * Получить все задачи текущего пользователя
 * @returns {Promise<Array>} Массив задач
 */
export async function getTasks() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('[tasks-supabase] Пользователь не авторизован');
            return [];
        }
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('due_date', { ascending: true, nullsLast: true });
        
        if (error) {
            console.error('[tasks-supabase] Ошибка загрузки задач:', error);
            return [];
        }
        
        console.log(`[tasks-supabase] Загружено ${data?.length || 0} задач для пользователя ${user.email}`);
        return data || [];
    } catch (error) {
        console.error('[tasks-supabase] Ошибка:', error);
        return [];
    }
}

/**
 * Получить задачу по ID
 */
export async function getTaskById(id) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[tasks-supabase] Ошибка загрузки задачи:', error);
        return null;
    }
}

/**
 * Создать новую задачу
 */
export async function createTask(taskData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error('Пользователь не авторизован');
        }
        
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                user_id: user.id,
                title: taskData.title,
                description: taskData.description || '',
                assigned_to: taskData.assigned_to || null,
                created_by: taskData.created_by || user.email,
                status: taskData.status || 'pending',
                priority: taskData.priority || 'medium',
                due_date: taskData.due_date || null,
                complex_id: taskData.complex_id || null,
                is_private: taskData.is_private || false
            }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('[tasks-supabase] Ошибка создания задачи:', error);
        return null;
    }
}

/**
 * Обновить задачу
 */
export async function updateTask(id, updates) {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('[tasks-supabase] Ошибка обновления задачи:', error);
        return null;
    }
}

/**
 * Удалить задачу
 */
export async function deleteTask(id) {
    try {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[tasks-supabase] Ошибка удаления задачи:', error);
        return false;
    }
}

/**
 * Обновить статус задачи
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
 */
export async function getOverdueTasks() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .lt('due_date', today)
            .neq('status', 'completed');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[tasks-supabase] Ошибка загрузки просроченных задач:', error);
        return [];
    }
}

/**
 * Получить задачи на сегодня
 */
export async function getTodayTasks() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('due_date', today);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[tasks-supabase] Ошибка загрузки задач на сегодня:', error);
        return [];
    }
}
