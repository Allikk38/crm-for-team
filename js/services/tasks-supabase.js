/**
 * ============================================
 * ФАЙЛ: js/services/tasks-supabase.js
 * РОЛЬ: Сервис для работы с задачами через Supabase
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла
 *   - 08.04.2026: Добавлены поля category и is_important
 *   - 08.04.2026: Упрощена структура для личного планировщика
 * ============================================
 */

import { supabase } from '../core/supabase.js';

// Категории задач
export const TASK_CATEGORIES = {
    work: { label: '💼 Работа', icon: 'fa-briefcase' },
    home: { label: '🏠 Дом', icon: 'fa-home' },
    health: { label: '💪 Здоровье', icon: 'fa-heart' },
    study: { label: '📚 Обучение', icon: 'fa-graduation-cap' },
    finance: { label: '💰 Финансы', icon: 'fa-dollar-sign' },
    other: { label: '📋 Другое', icon: 'fa-list' }
};

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
            .order('is_important', { ascending: false })
            .order('due_date', { ascending: true, nullsLast: true })
            .order('created_at', { ascending: false });
        
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
                status: taskData.status || 'pending',
                priority: taskData.priority || 'medium',
                due_date: taskData.due_date || null,
                category: taskData.category || 'other',
                is_important: taskData.is_important || false,
                is_private: taskData.is_private !== false, // По умолчанию приватные
                created_by: user.email
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
 * Переключить "Важное"
 */
export async function toggleImportant(id, currentValue) {
    return await updateTask(id, { is_important: !currentValue });
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
