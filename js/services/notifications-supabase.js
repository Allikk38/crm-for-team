/**
 * ============================================
 * ФАЙЛ: js/services/notifications-supabase.js
 * РОЛЬ: Сервис для работы с уведомлениями через Supabase
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * ============================================
 */

import { supabase } from '../core/supabase.js';

/**
 * Получить все уведомления текущего пользователя
 * @returns {Promise<Array>} Массив уведомлений
 */
export async function getNotifications() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('[notifications] Пользователь не авторизован');
            return [];
        }
        
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[notifications] Ошибка загрузки:', error);
        return [];
    }
}

/**
 * Получить количество непрочитанных уведомлений
 * @returns {Promise<number>}
 */
export async function getUnreadCount() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
        
        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('[notifications] Ошибка подсчета:', error);
        return 0;
    }
}

/**
 * Создать уведомление
 * @param {Object} data - Данные уведомления
 * @returns {Promise<Object|null>}
 */
export async function createNotification(data) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: result, error } = await supabase
            .from('notifications')
            .insert([{
                user_id: data.user_id || user.id,
                type: data.type,
                title: data.title,
                message: data.message,
                task_id: data.task_id || null,
                deal_id: data.deal_id || null,
                complex_id: data.complex_id || null
            }])
            .select();
        
        if (error) throw error;
        return result[0];
    } catch (error) {
        console.error('[notifications] Ошибка создания:', error);
        return null;
    }
}

/**
 * Отметить уведомление как прочитанное
 * @param {string} id - ID уведомления
 * @returns {Promise<boolean>}
 */
export async function markAsRead(id) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[notifications] Ошибка отметки:', error);
        return false;
    }
}

/**
 * Отметить все уведомления как прочитанные
 * @returns {Promise<boolean>}
 */
export async function markAllAsRead() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[notifications] Ошибка массовой отметки:', error);
        return false;
    }
}

/**
 * Удалить уведомление
 * @param {string} id - ID уведомления
 * @returns {Promise<boolean>}
 */
export async function deleteNotification(id) {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[notifications] Ошибка удаления:', error);
        return false;
    }
}

/**
 * Удалить все уведомления
 * @returns {Promise<boolean>}
 */
export async function deleteAllNotifications() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[notifications] Ошибка массового удаления:', error);
        return false;
    }
}

/**
 * Проверить дедлайны задач и создать уведомления
 * @param {Array} tasks - Список задач
 * @returns {Promise<void>}
 */
export async function checkDeadlinesAndNotify(tasks) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const task of tasks) {
        if (task.status === 'completed') continue;
        if (!task.due_date) continue;
        
        const dueDate = new Date(task.due_date);
        const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
        
        // Проверяем, есть ли уже уведомление об этом
        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('task_id', task.id)
            .eq('type', diffDays === 1 ? 'deadline' : 'overdue')
            .single();
        
        if (existing) continue;
        
        if (diffDays === 1) {
            await createNotification({
                user_id: task.user_id,
                type: 'deadline',
                title: 'Дедлайн завтра',
                message: `Задача "${task.title}" должна быть выполнена завтра`,
                task_id: task.id
            });
        } else if (diffDays < 0) {
            await createNotification({
                user_id: task.user_id,
                type: 'overdue',
                title: 'Задача просрочена',
                message: `Задача "${task.title}" просрочена на ${Math.abs(diffDays)} дней`,
                task_id: task.id
            });
        }
    }
}
