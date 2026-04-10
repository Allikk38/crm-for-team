/**
 * ============================================
 * ФАЙЛ: js/services/finance/accounts.js
 * РОЛЬ: Управление счетами (finance_accounts)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение всех счетов пользователя
 *   - Получение счёта по ID
 *   - Создание, обновление, удаление счёта
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
 * Получить все счета пользователя
 * @returns {Promise<Array>} Массив счетов
 */
export async function getAccounts() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('finance_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[finance/accounts] Ошибка загрузки счетов:', error);
        return [];
    }

    return data;
}

/**
 * Получить счёт по ID
 * @param {string} id - ID счёта
 * @returns {Promise<Object|null>}
 */
export async function getAccountById(id) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('finance_accounts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[finance/accounts] Ошибка загрузки счёта:', error);
        return null;
    }

    return data;
}

/**
 * Создать новый счёт
 * @param {Object} account - { name, type, balance }
 * @returns {Promise<Object>}
 */
export async function createAccount(account) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('finance_accounts')
        .insert([{
            user_id: user.id,
            name: account.name,
            type: account.type,
            balance: account.balance || 0
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Обновить счёт
 * @param {string} id - ID счёта
 * @param {Object} updates - { name, type, balance }
 * @returns {Promise<Object>}
 */
export async function updateAccount(id, updates) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('finance_accounts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Удалить счёт
 * @param {string} id - ID счёта
 * @returns {Promise<boolean>}
 */
export async function deleteAccount(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { error } = await supabase
        .from('finance_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return true;
}
