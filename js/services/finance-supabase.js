/**
 * ============================================
 * ФАЙЛ: js/services/finance-supabase.js
 * РОЛЬ: Сервис для работы с транзакциями (доходы/расходы)
 * 
 * ФУНКЦИОНАЛ:
 *   - CRUD операции с транзакциями
 *   - Получение статистики (баланс, доходы, расходы)
 *   - Получение отчетов по периодам
 *   - Управление категориями
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Создание сервиса
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import cacheService from './cache-service.js';

// ========== КОНСТАНТЫ ==========

const CACHE_KEYS = {
    TRANSACTIONS: 'finance_transactions',
    BALANCE: 'finance_balance',
    STATS: 'finance_stats',
    CATEGORIES: 'finance_categories'
};

// Категории по умолчанию
const DEFAULT_CATEGORIES = {
    income: ['Зарплата', 'Фриланс', 'Подарок', 'Кэшбэк', 'Другое'],
    expense: ['Еда', 'Транспорт', 'Подписки', 'Развлечения', 'Здоровье', 'Дом', 'Обучение', 'Другое']
};

// ========== ТРАНЗАКЦИИ (CRUD) ==========

/**
 * Получить список транзакций пользователя
 * @param {Object} filters - фильтры { startDate, endDate, type, category }
 * @param {boolean} forceRefresh - принудительно обновить кэш
 * @returns {Promise<Array>}
 */
export async function getTransactions(filters = {}, forceRefresh = false) {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    const cacheKey = `${CACHE_KEYS.TRANSACTIONS}_${user.id}_${JSON.stringify(filters)}`;

    if (!forceRefresh) {
        const cached = cacheService.get(cacheKey, 'session');
        if (cached) return cached;
    }

    let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (filters.startDate) {
        query = query.gte('transaction_date', filters.startDate);
    }
    if (filters.endDate) {
        query = query.lte('transaction_date', filters.endDate);
    }
    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }
    if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[finance] Ошибка загрузки транзакций:', error);
        return [];
    }

    cacheService.set(cacheKey, data, { ttl: 60, storage: 'session' }); // 1 минута
    return data;
}

/**
 * Добавить новую транзакцию
 * @param {Object} transaction - { type, amount, category, description, transaction_date }
 * @returns {Promise<Object>}
 */
export async function addTransaction(transaction) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            user_id: user.id,
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            description: transaction.description || null,
            transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

    if (error) throw error;

    // Очищаем кэш
    clearFinanceCache(user.id);
    
    return data;
}

/**
 * Обновить транзакцию
 * @param {string} id - ID транзакции
 * @param {Object} updates - обновляемые поля
 * @returns {Promise<Object>}
 */
export async function updateTransaction(id, updates) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;

    clearFinanceCache(user.id);
    return data;
}

/**
 * Удалить транзакцию
 * @param {string} id - ID транзакции
 * @returns {Promise<boolean>}
 */
export async function deleteTransaction(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;

    clearFinanceCache(user.id);
    return true;
}

// ========== СТАТИСТИКА ==========

/**
 * Получить баланс (доходы - расходы)
 * @param {string} period - 'day', 'week', 'month', 'year', 'all'
 * @returns {Promise<number>}
 */
export async function getBalance(period = 'month') {
    const user = getCurrentSupabaseUser();
    if (!user) return 0;

    const { startDate, endDate } = getDateRange(period);
    const transactions = await getTransactions({ startDate, endDate });

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    return totalIncome - totalExpense;
}

/**
 * Получить статистику по доходам/расходам
 * @param {string} period - 'day', 'week', 'month', 'year', 'all'
 * @returns {Promise<Object>}
 */
export async function getStats(period = 'month') {
    const user = getCurrentSupabaseUser();
    if (!user) return { totalIncome: 0, totalExpense: 0, balance: 0 };

    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `${CACHE_KEYS.STATS}_${user.id}_${period}`;
    
    const cached = cacheService.get(cacheKey, 'session');
    if (cached) return cached;

    const transactions = await getTransactions({ startDate, endDate });

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const stats = {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        transactionCount: transactions.length,
        incomeCount: transactions.filter(t => t.type === 'income').length,
        expenseCount: transactions.filter(t => t.type === 'expense').length
    };

    cacheService.set(cacheKey, stats, { ttl: 60, storage: 'session' });
    return stats;
}

/**
 * Получить статистику по категориям
 * @param {string} period - период
 * @param {string} type - 'income' или 'expense'
 * @returns {Promise<Array>}
 */
export async function getStatsByCategory(period = 'month', type = 'expense') {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    const { startDate, endDate } = getDateRange(period);
    const transactions = await getTransactions({ startDate, endDate, type });

    const categoryStats = {};
    transactions.forEach(t => {
        if (!categoryStats[t.category]) {
            categoryStats[t.category] = 0;
        }
        categoryStats[t.category] += t.amount;
    });

    return Object.entries(categoryStats)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
}

// ========== КАТЕГОРИИ ==========

/**
 * Получить категории пользователя
 * @param {string} type - 'income', 'expense', или 'all'
 * @returns {Promise<Object>}
 */
export async function getCategories(type = 'all') {
    const user = getCurrentSupabaseUser();
    if (!user) return type === 'all' ? DEFAULT_CATEGORIES : DEFAULT_CATEGORIES[type];

    const cacheKey = `${CACHE_KEYS.CATEGORIES}_${user.id}`;
    const cached = cacheService.get(cacheKey, 'local');
    if (cached) return cached;

    let query = supabase
        .from('transaction_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

    const { data, error } = await query;

    let userCategories = { income: [], expense: [] };
    
    if (!error && data) {
        data.forEach(cat => {
            userCategories[cat.type].push(cat.name);
        });
    }

    // Если у пользователя нет категорий, создаем стандартные
    const hasIncomeCategories = userCategories.income.length > 0;
    const hasExpenseCategories = userCategories.expense.length > 0;

    if (!hasIncomeCategories) {
        userCategories.income = DEFAULT_CATEGORIES.income;
    }
    if (!hasExpenseCategories) {
        userCategories.expense = DEFAULT_CATEGORIES.expense;
    }

    cacheService.set(cacheKey, userCategories, { ttl: 3600, storage: 'local' }); // 1 час
    return userCategories;
}

/**
 * Добавить новую категорию
 * @param {string} name - название категории
 * @param {string} type - 'income' или 'expense'
 * @returns {Promise<Object>}
 */
export async function addCategory(name, type) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('transaction_categories')
        .insert([{
            user_id: user.id,
            name,
            type,
            is_active: true
        }])
        .select()
        .single();

    if (error) throw error;

    // Очищаем кэш категорий
    cacheService.invalidate(`${CACHE_KEYS.CATEGORIES}_${user.id}`, 'all');
    
    return data;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

/**
 * Получить диапазон дат для периода
 * @param {string} period - 'day', 'week', 'month', 'year', 'all'
 * @returns {Object}
 */
function getDateRange(period) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (period === 'day') {
        return { startDate: today, endDate: today };
    }
    
    if (period === 'week') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        startOfWeek.setDate(now.getDate() - diff);
        return {
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    if (period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    if (period === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
            startDate: startOfYear.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    return { startDate: null, endDate: null };
}

/**
 * Очистить кэш финансов
 * @param {string} userId - ID пользователя
 */
function clearFinanceCache(userId) {
    // Очищаем все кэши по паттерну
    const keys = [
        CACHE_KEYS.TRANSACTIONS,
        CACHE_KEYS.BALANCE,
        CACHE_KEYS.STATS
    ];
    
    keys.forEach(key => {
        cacheService.invalidate(`${key}_${userId}`, 'session');
    });
    
    cacheService.invalidate(`${CACHE_KEYS.CATEGORIES}_${userId}`, 'all');
}

// ========== ЭКСПОРТЫ ==========
export default {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getBalance,
    getStats,
    getStatsByCategory,
    getCategories,
    addCategory,
    DEFAULT_CATEGORIES
};
