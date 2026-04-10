/**
 * ============================================
 * ФАЙЛ: js/services/finance/transactions.js
 * РОЛЬ: Управление транзакциями (finance_transactions)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение транзакций с фильтрацией
 *   - Получение транзакции по ID
 *   - Добавление, обновление, удаление транзакции
 *   - Автоматическое обновление баланса счёта и бюджета
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - ./utils.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из finance-supabase.js при разделении модуля
 * ============================================
 */

import { supabase } from '../../core/supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';
import { 
    updateAccountBalance, 
    revertAccountBalance,
    updateBudgetFact,
    revertBudgetFact 
} from './utils.js';
import { getAccountById } from './accounts.js';

/**
 * Получить транзакции с фильтрацией
 * @param {Object} filters - { startDate, endDate, type, categoryId, accountId }
 * @returns {Promise<Array>}
 */
export async function getTransactions(filters = {}) {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    let query = supabase
        .from('finance_transactions')
        .select(`
            *,
            category:category_id(id, name, type),
            account:account_id(id, name, type)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (filters.startDate) {
        query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
        query = query.lte('date', filters.endDate);
    }
    if (filters.type) {
        query = query.eq('type', filters.type);
    }
    if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
    }
    if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[finance/transactions] Ошибка загрузки транзакций:', error);
        return [];
    }

    return data;
}

/**
 * Получить транзакцию по ID
 * @param {string} id - ID транзакции
 * @returns {Promise<Object|null>}
 */
export async function getTransactionById(id) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('finance_transactions')
        .select(`
            *,
            category:category_id(id, name, type),
            account:account_id(id, name, type)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[finance/transactions] Ошибка загрузки транзакции:', error);
        return null;
    }

    return data;
}

/**
 * Добавить транзакцию с обновлением баланса счёта и бюджета
 * @param {Object} transaction - { type, amount, category_id, account_id, date, comment }
 * @returns {Promise<Object>}
 */
export async function addTransaction(transaction) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    // 1. Создаём транзакцию
    const { data, error } = await supabase
        .from('finance_transactions')
        .insert([{
            user_id: user.id,
            type: transaction.type,
            amount: transaction.amount,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            date: transaction.date || new Date().toISOString().split('T')[0],
            comment: transaction.comment || null
        }])
        .select()
        .single();

    if (error) throw error;

    // 2. Обновляем баланс счёта
    await updateAccountBalance(transaction.account_id, transaction.type, transaction.amount);

    // 3. Если это расход, обновляем факт в бюджете
    if (transaction.type === 'expense') {
        await updateBudgetFact(transaction.category_id, transaction.date, transaction.amount);
    }

    return data;
}

/**
 * Обновить транзакцию с пересчётом баланса и бюджета
 * @param {string} id - ID транзакции
 * @param {Object} updates - обновляемые поля
 * @returns {Promise<Object>}
 */
export async function updateTransaction(id, updates) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    // 1. Получаем старую транзакцию
    const oldTransaction = await getTransactionById(id);
    if (!oldTransaction) throw new Error('Транзакция не найдена');

    // 2. Обновляем транзакцию
    const { data, error } = await supabase
        .from('finance_transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;

    // 3. Корректируем баланс счёта
    const accountChanged = updates.account_id && updates.account_id !== oldTransaction.account_id;
    const amountChanged = updates.amount && updates.amount !== oldTransaction.amount;
    const typeChanged = updates.type && updates.type !== oldTransaction.type;

    if (accountChanged || amountChanged || typeChanged) {
        // Возвращаем старую сумму на старый счёт
        await revertAccountBalance(oldTransaction.account_id, oldTransaction.type, oldTransaction.amount);
        // Применяем новую сумму к новому счёту
        const newAccountId = updates.account_id || oldTransaction.account_id;
        const newType = updates.type || oldTransaction.type;
        const newAmount = updates.amount !== undefined ? updates.amount : oldTransaction.amount;
        await updateAccountBalance(newAccountId, newType, newAmount);
    }

    // 4. Корректируем бюджет (только для расходов)
    const oldType = oldTransaction.type;
    const newType = updates.type !== undefined ? updates.type : oldType;
    const oldDate = oldTransaction.date;
    const newDate = updates.date || oldDate;

    if (oldType === 'expense') {
        await revertBudgetFact(oldTransaction.category_id, oldDate, oldTransaction.amount);
    }
    if (newType === 'expense') {
        const newCategoryId = updates.category_id || oldTransaction.category_id;
        const newAmount = updates.amount !== undefined ? updates.amount : oldTransaction.amount;
        await updateBudgetFact(newCategoryId, newDate, newAmount);
    }

    return data;
}

/**
 * Удалить транзакцию с возвратом баланса и бюджета
 * @param {string} id - ID транзакции
 * @returns {Promise<boolean>}
 */
export async function deleteTransaction(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    // 1. Получаем транзакцию перед удалением
    const transaction = await getTransactionById(id);
    if (!transaction) throw new Error('Транзакция не найдена');

    // 2. Удаляем транзакцию
    const { error } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;

    // 3. Возвращаем баланс счёта
    await revertAccountBalance(transaction.account_id, transaction.type, transaction.amount);

    // 4. Возвращаем факт в бюджете (только для расходов)
    if (transaction.type === 'expense') {
        await revertBudgetFact(transaction.category_id, transaction.date, transaction.amount);
    }

    return true;
}
