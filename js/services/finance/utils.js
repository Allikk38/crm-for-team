/**
 * ============================================
 * ФАЙЛ: js/services/finance/utils.js
 * РОЛЬ: Вспомогательные функции для модуля финансов
 * 
 * ФУНКЦИОНАЛ:
 *   - Обновление/откат баланса счёта
 *   - Обновление/откат факта в бюджете
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
 * Получить счёт по ID
 * @param {string} accountId - ID счёта
 * @returns {Promise<Object|null>}
 */
export async function getAccountById(accountId) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('finance_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[finance/utils] Ошибка загрузки счёта:', error);
        return null;
    }

    return data;
}

/**
 * Обновить баланс счёта при добавлении транзакции
 * @param {string} accountId - ID счёта
 * @param {string} type - тип транзакции ('income' или 'expense')
 * @param {number} amount - сумма
 */
export async function updateAccountBalance(accountId, type, amount) {
    const account = await getAccountById(accountId);
    if (!account) return;

    let newBalance = account.balance;
    if (type === 'income') {
        newBalance += amount;
    } else {
        newBalance -= amount;
    }

    await supabase
        .from('finance_accounts')
        .update({ balance: newBalance })
        .eq('id', accountId);
}

/**
 * Откатить баланс счёта (при удалении или изменении транзакции)
 * @param {string} accountId - ID счёта
 * @param {string} type - тип транзакции ('income' или 'expense')
 * @param {number} amount - сумма
 */
export async function revertAccountBalance(accountId, type, amount) {
    const account = await getAccountById(accountId);
    if (!account) return;

    let newBalance = account.balance;
    if (type === 'income') {
        newBalance -= amount;
    } else {
        newBalance += amount;
    }

    await supabase
        .from('finance_accounts')
        .update({ balance: newBalance })
        .eq('id', accountId);
}

/**
 * Обновить факт в бюджете
 * @param {string} categoryId - ID категории
 * @param {string} date - дата транзакции (YYYY-MM-DD)
 * @param {number} amount - сумма
 */
export async function updateBudgetFact(categoryId, date, amount) {
    const user = getCurrentSupabaseUser();
    if (!user) return;

    const month = date.slice(0, 7) + '-01';

    const { data: existingBudget } = await supabase
        .from('finance_budget')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', month)
        .maybeSingle();

    if (existingBudget) {
        await supabase
            .from('finance_budget')
            .update({ fact: existingBudget.fact + amount })
            .eq('id', existingBudget.id);
    } else {
        await supabase
            .from('finance_budget')
            .insert([{
                user_id: user.id,
                category_id: categoryId,
                month: month,
                planned: 0,
                fact: amount
            }]);
    }
}

/**
 * Откатить факт в бюджете
 * @param {string} categoryId - ID категории
 * @param {string} date - дата транзакции (YYYY-MM-DD)
 * @param {number} amount - сумма
 */
export async function revertBudgetFact(categoryId, date, amount) {
    const user = getCurrentSupabaseUser();
    if (!user) return;

    const month = date.slice(0, 7) + '-01';

    const { data: existingBudget } = await supabase
        .from('finance_budget')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', month)
        .maybeSingle();

    if (existingBudget) {
        const newFact = Math.max(0, existingBudget.fact - amount);
        await supabase
            .from('finance_budget')
            .update({ fact: newFact })
            .eq('id', existingBudget.id);
    }
}
