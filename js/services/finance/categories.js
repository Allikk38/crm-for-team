/**
 * ============================================
 * ФАЙЛ: js/services/finance/categories.js
 * РОЛЬ: Управление категориями (finance_categories)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение категорий пользователя
 *   - Получение категории по ID
 *   - Создание пользовательской категории
 *   - Удаление пользовательской категории
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из finance-supabase.js при разделении модуля
 * ============================================
 */

import { supabase } from '../../core/supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

/**
 * Получить категории пользователя
 * @param {string} type - 'expense', 'income', или 'all'
 * @returns {Promise<Array>}
 */
export async function getCategories(type = 'all') {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    let query = supabase
        .from('finance_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

    if (type !== 'all') {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[finance/categories] Ошибка загрузки категорий:', error);
        return [];
    }

    return data;
}

/**
 * Получить категорию по ID
 * @param {string} id - ID категории
 * @returns {Promise<Object|null>}
 */
export async function getCategoryById(id) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[finance/categories] Ошибка загрузки категории:', error);
        return null;
    }

    return data;
}

/**
 * Создать пользовательскую категорию
 * @param {Object} category - { name, type }
 * @returns {Promise<Object>}
 */
export async function createCategory(category) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('finance_categories')
        .insert([{
            user_id: user.id,
            name: category.name,
            type: category.type,
            is_custom: true
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Удалить пользовательскую категорию
 * @param {string} id - ID категории
 * @returns {Promise<boolean>}
 */
export async function deleteCategory(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { error } = await supabase
        .from('finance_categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('is_custom', true);

    if (error) throw error;
    return true;
}
