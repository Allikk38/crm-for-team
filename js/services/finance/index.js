/**
 * ============================================
 * ФАЙЛ: js/services/finance/index.js
 * РОЛЬ: Точка входа для модуля финансов
 * 
 * ФУНКЦИОНАЛ:
 *   - Ре-экспорт всех функций из подмодулей
 *   - getFinanceSummary() — сводка по финансам для дашборда
 * 
 * ЗАВИСИМОСТИ:
 *   - ./accounts.js
 *   - ./categories.js
 *   - ./transactions.js
 *   - ./budget.js
 *   - ./credits.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Создан при разделении finance-supabase.js
 *   - 10.04.2026: ИСПРАВЛЕНО: getFinanceSummary учитывает card_balance
 * ============================================
 */

import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

// Импорты из подмодулей
import * as accounts from './accounts.js';
import * as categories from './categories.js';
import * as transactions from './transactions.js';
import * as budget from './budget.js';
import * as credits from './credits.js';

// ========== РЕ-ЭКСПОРТ ВСЕХ ФУНКЦИЙ ==========

// Счета
export const getAccounts = accounts.getAccounts;
export const getAccountById = accounts.getAccountById;
export const createAccount = accounts.createAccount;
export const updateAccount = accounts.updateAccount;
export const deleteAccount = accounts.deleteAccount;

// Категории
export const getCategories = categories.getCategories;
export const getCategoryById = categories.getCategoryById;
export const createCategory = categories.createCategory;
export const deleteCategory = categories.deleteCategory;

// Транзакции
export const getTransactions = transactions.getTransactions;
export const getTransactionById = transactions.getTransactionById;
export const addTransaction = transactions.addTransaction;
export const updateTransaction = transactions.updateTransaction;
export const deleteTransaction = transactions.deleteTransaction;

// Бюджет
export const getBudget = budget.getBudget;
export const setBudgetPlan = budget.setBudgetPlan;
export const getBudgetSummary = budget.getBudgetSummary;

// Кредиты
export const getCredits = credits.getCredits;
export const getCreditById = credits.getCreditById;
export const createCredit = credits.createCredit;
export const updateCredit = credits.updateCredit;
export const deleteCredit = credits.deleteCredit;
export const calculateAnnuityPayment = credits.calculateAnnuityPayment;
export const calculatePaymentSchedule = credits.calculatePaymentSchedule;
export const calculatePrepayment = credits.calculatePrepayment;
export const makePrepayment = credits.makePrepayment;
export const getTotalCreditBalance = credits.getTotalCreditBalance;

// ========== СВОДНАЯ ИНФОРМАЦИЯ ==========

/**
 * Получить сводку по финансам для дашборда
 * @returns {Promise<Object>}
 */
export async function getFinanceSummary() {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    // Загружаем все данные параллельно
    const [accountsList, creditsList] = await Promise.all([
        accounts.getAccounts(),
        credits.getCredits()
    ]);

    // Счета
    const totalBalance = accountsList.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Текущий месяц
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;
    const monthEnd = today.toISOString().split('T')[0];

    // Транзакции за месяц
    const monthTransactions = await transactions.getTransactions({
        startDate: monthStart,
        endDate: monthEnd
    });

    const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Кредиты
    const totalCreditBalance = credits.getTotalCreditBalance(creditsList);
    
    // Ближайший платёж по кредиту
    let nextPayment = null;
    const activeCredits = creditsList.filter(c => {
        const balance = c.credit_type === 'card' ? (c.card_balance || 0) : (c.balance || 0);
        return balance > 0;
    });
    
    if (activeCredits.length > 0) {
        const todayDate = new Date();
        const futurePayments = activeCredits
            .filter(c => c.credit_type !== 'card' && c.next_payment_date)
            .map(c => {
                const nextDate = new Date(c.next_payment_date);
                return {
                    creditName: c.name,
                    creditId: c.id,
                    date: nextDate.toISOString().split('T')[0],
                    amount: c.payment
                };
            })
            .filter(p => new Date(p.date) >= todayDate)
            .sort((a, b) => a.date.localeCompare(b.date));
        
        nextPayment = futurePayments[0] || null;
    }

    // Бюджет
    const budgetSummary = await budget.getBudgetSummary(currentMonth);

    return {
        accounts: accountsList,
        totalBalance,
        monthIncome,
        monthExpense,
        monthBalance: monthIncome - monthExpense,
        credits: creditsList,
        totalCreditBalance,
        creditCount: creditsList.length,
        nextPayment,
        budget: budgetSummary,
        currentMonth
    };
}

// ========== ЭКСПОРТ ПО УМОЛЧАНИЮ ==========

export default {
    // Счета
    getAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    
    // Категории
    getCategories,
    getCategoryById,
    createCategory,
    deleteCategory,
    
    // Транзакции
    getTransactions,
    getTransactionById,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    
    // Бюджет
    getBudget,
    setBudgetPlan,
    getBudgetSummary,
    
    // Кредиты
    getCredits,
    getCreditById,
    createCredit,
    updateCredit,
    deleteCredit,
    calculateAnnuityPayment,
    calculatePaymentSchedule,
    calculatePrepayment,
    makePrepayment,
    getTotalCreditBalance,
    
    // Сводка
    getFinanceSummary
};
