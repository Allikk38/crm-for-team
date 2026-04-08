/**
 * ============================================
 * ФАЙЛ: js/services/finance-supabase.js
 * РОЛЬ: Сервис для работы с модулем «Финансы»
 * 
 * ФУНКЦИОНАЛ:
 *   - Управление счетами (finance_accounts)
 *   - Управление категориями (finance_categories)
 *   - Управление транзакциями (finance_transactions)
 *   - Управление бюджетом (finance_budget)
 *   - Управление кредитами (finance_credits)
 *   - Кредитный калькулятор
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   2026-04-08: Полное пересоздание сервиса для новых таблиц finance_*
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

// ============================================
// СЧЕТА (finance_accounts)
// ============================================

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
        console.error('[finance] Ошибка загрузки счетов:', error);
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
        console.error('[finance] Ошибка загрузки счёта:', error);
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

// ============================================
// КАТЕГОРИИ (finance_categories)
// ============================================

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
        console.error('[finance] Ошибка загрузки категорий:', error);
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
        console.error('[finance] Ошибка загрузки категории:', error);
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

// ============================================
// ТРАНЗАКЦИИ (finance_transactions)
// ============================================

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
        console.error('[finance] Ошибка загрузки транзакций:', error);
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
        console.error('[finance] Ошибка загрузки транзакции:', error);
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
    const categoryChanged = updates.category_id && updates.category_id !== oldTransaction.category_id;
    const dateChanged = updates.date && updates.date !== oldTransaction.date;
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

// ============================================
// БЮДЖЕТ (finance_budget)
// ============================================

/**
 * Получить бюджет на указанный месяц
 * @param {string} month - дата в формате YYYY-MM-DD (используется YYYY-MM-01)
 * @returns {Promise<Array>}
 */
export async function getBudget(month) {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    const monthDate = `${month.slice(0, 7)}-01`;

    const { data, error } = await supabase
        .from('finance_budget')
        .select(`
            *,
            category:category_id(id, name, type)
        `)
        .eq('user_id', user.id)
        .eq('month', monthDate)
        .order('planned', { ascending: false });

    if (error) {
        console.error('[finance] Ошибка загрузки бюджета:', error);
        return [];
    }

    return data;
}

/**
 * Установить план бюджета для категории на месяц
 * @param {string} categoryId - ID категории
 * @param {string} month - месяц в формате YYYY-MM
 * @param {number} planned - плановая сумма
 * @returns {Promise<Object>}
 */
export async function setBudgetPlan(categoryId, month, planned) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const monthDate = `${month}-01`;

    const { data, error } = await supabase
        .from('finance_budget')
        .upsert({
            user_id: user.id,
            category_id: categoryId,
            month: monthDate,
            planned: planned,
            fact: 0
        }, {
            onConflict: 'user_id, category_id, month'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Получить сводку по бюджету (план/факт/остаток) за месяц
 * @param {string} month - месяц в формате YYYY-MM
 * @returns {Promise<Object>}
 */
export async function getBudgetSummary(month) {
    const budgetData = await getBudget(month);
    
    const totalPlanned = budgetData.reduce((sum, item) => sum + (item.planned || 0), 0);
    const totalFact = budgetData.reduce((sum, item) => sum + (item.fact || 0), 0);
    const remaining = totalPlanned - totalFact;
    
    // Топ-5 категорий по расходам
    const topCategories = budgetData
        .filter(item => item.fact > 0)
        .sort((a, b) => b.fact - a.fact)
        .slice(0, 5)
        .map(item => ({
            categoryId: item.category_id,
            categoryName: item.category?.name || 'Без категории',
            planned: item.planned,
            fact: item.fact,
            remaining: item.planned - item.fact,
            percentage: item.planned > 0 ? (item.fact / item.planned) * 100 : 0
        }));

    return {
        month,
        totalPlanned,
        totalFact,
        remaining,
        categories: budgetData,
        topCategories
    };
}

// ============================================
// КРЕДИТЫ (finance_credits)
// ============================================

/**
 * Получить все кредиты пользователя
 * @returns {Promise<Array>}
 */
export async function getCredits() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('finance_credits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[finance] Ошибка загрузки кредитов:', error);
        return [];
    }

    return data;
}

/**
 * Получить кредит по ID
 * @param {string} id - ID кредита
 * @returns {Promise<Object|null>}
 */
export async function getCreditById(id) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('finance_credits')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[finance] Ошибка загрузки кредита:', error);
        return null;
    }

    return data;
}

/**
 * Рассчитать аннуитетный платёж
 * @param {number} amount - сумма кредита
 * @param {number} rate - годовая ставка (%)
 * @param {number} termMonths - срок в месяцах
 * @returns {number} Ежемесячный платёж
 */
export function calculateAnnuityPayment(amount, rate, termMonths) {
    const monthlyRate = rate / 100 / 12;
    
    if (monthlyRate === 0) {
        return amount / termMonths;
    }
    
    const payment = amount * monthlyRate * Math.pow(1 + monthlyRate, termMonths) 
        / (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return Math.round(payment * 100) / 100;
}

/**
 * Рассчитать простой прогноз без ставки
 * @param {number} balance - остаток долга
 * @param {number} payment - ежемесячный платёж
 * @param {string} nextPaymentDate - дата следующего платежа
 * @returns {Object} { monthsLeft, yearsLeft, monthsRemainder, endDate }
 */
export function calculateSimpleForecast(balance, payment, nextPaymentDate) {
    if (!balance || !payment || payment <= 0 || !nextPaymentDate) {
        return { monthsLeft: 0, yearsLeft: 0, monthsRemainder: 0, endDate: null };
    }
    
    const monthsLeft = Math.ceil(balance / payment);
    const yearsLeft = Math.floor(monthsLeft / 12);
    const monthsRemainder = monthsLeft % 12;
    
    const startDate = new Date(nextPaymentDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + monthsLeft - 1);
    
    return {
        monthsLeft,
        yearsLeft,
        monthsRemainder,
        endDate: endDate.toISOString().split('T')[0]
    };
}

/**
 * Рассчитать точный график платежей (если указана ставка)
 * @param {Object} credit - объект кредита
 * @returns {Array} Массив платежей
 */
export function calculatePaymentSchedule(credit) {
    if (!credit.rate || !credit.next_payment_date) return [];
    
    const monthlyRate = credit.rate / 100 / 12;
    const schedule = [];
    
    let balance = credit.balance;
    const payment = credit.payment;
    const startDate = new Date(credit.next_payment_date);
    
    let month = 0;
    while (balance > 0 && month < 600) {
        const interest = balance * monthlyRate;
        const principal = Math.min(payment - interest, balance);
        
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + month);
        
        schedule.push({
            month: month + 1,
            date: paymentDate.toISOString().split('T')[0],
            payment: Math.round(payment * 100) / 100,
            interest: Math.round(interest * 100) / 100,
            principal: Math.round(principal * 100) / 100,
            balanceBefore: Math.round(balance * 100) / 100,
            balanceAfter: Math.round((balance - principal) * 100) / 100
        });
        
        balance -= principal;
        month++;
        
        if (balance < 0) balance = 0;
    }
    
    return schedule;
}

/**
 * Создать новый кредит
 * @param {Object} credit - все поля кредита
 * @returns {Promise<Object>}
 */
export async function createCredit(credit) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const insertData = {
        user_id: user.id,
        name: credit.name,
        bank: credit.bank || null,
        credit_type: credit.credit_type || 'loan',
        rate: credit.rate || null,
        remaining_payments: credit.remaining_payments || null,
        last_payment_amount: credit.last_payment_amount || null
    };
    
    if (credit.credit_type === 'card') {
        insertData.credit_limit = credit.credit_limit || null;
        insertData.card_balance = credit.card_balance || 0;
        insertData.min_payment = credit.min_payment || null;
        insertData.planned_payment = credit.planned_payment || null;
        insertData.grace_period_end = credit.grace_period_end || null;
    } else {
        insertData.balance = credit.balance || 0;
        insertData.payment = credit.payment || 0;
        insertData.next_payment_date = credit.next_payment_date || null;
    }

    const { data, error } = await supabase
        .from('finance_credits')
        .insert([insertData])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Обновить кредит
 * @param {string} id - ID кредита
 * @param {Object} updates - обновляемые поля
 * @returns {Promise<Object>}
 */
export async function updateCredit(id, updates) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase
        .from('finance_credits')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Удалить кредит
 * @param {string} id - ID кредита
 * @returns {Promise<boolean>}
 */
export async function deleteCredit(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { error } = await supabase
        .from('finance_credits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return true;
}
/**
 * Рассчитать досрочное погашение
 * @param {Object} credit - объект кредита
 * @param {number} prepaymentAmount - сумма досрочного погашения
 * @returns {Object} Результаты расчёта
 */
export function calculatePrepayment(credit, prepaymentAmount) {
    const rate = credit.rate || 0;
    const monthlyRate = rate / 100 / 12;
    const currentBalance = credit.balance || 0;
    const payment = credit.payment || 0;
    
    if (prepaymentAmount >= currentBalance) {
        return {
            newBalance: 0,
            interestSaved: 0,
            monthsReduced: 0,
            newTerm: 0,
            totalSaved: 0
        };
    }
    
    const newBalance = currentBalance - prepaymentAmount;
    
    let oldMonthsLeft = 0;
    let tempBalance = currentBalance;
    let totalInterestOld = 0;
    
    while (tempBalance > 0 && oldMonthsLeft < 600) {
        const interest = tempBalance * monthlyRate;
        const principal = Math.min(payment - interest, tempBalance);
        if (principal <= 0) break;
        totalInterestOld += interest;
        tempBalance -= principal;
        oldMonthsLeft++;
    }
    
    let newMonthsLeft = 0;
    tempBalance = newBalance;
    let totalInterestNew = 0;
    
    while (tempBalance > 0 && newMonthsLeft < 600) {
        const interest = tempBalance * monthlyRate;
        const principal = Math.min(payment - interest, tempBalance);
        if (principal <= 0) break;
        totalInterestNew += interest;
        tempBalance -= principal;
        newMonthsLeft++;
    }
    
    const interestSaved = totalInterestOld - totalInterestNew;
    const monthsReduced = oldMonthsLeft - newMonthsLeft;
    
    return {
        newBalance: Math.round(newBalance * 100) / 100,
        interestSaved: Math.round(interestSaved * 100) / 100,
        monthsReduced: monthsReduced,
        newTerm: newMonthsLeft,
        totalSaved: Math.round((prepaymentAmount + interestSaved) * 100) / 100
    };
}
    
/**
 * Внести досрочное погашение
 * @param {string} creditId - ID кредита
 * @param {number} amount - сумма погашения
 * @param {string} categoryId - ID категории для списания
 * @param {string} accountId - ID счёта для списания
 * @returns {Promise<Object>}
 */
export async function makePrepayment(creditId, amount, categoryId, accountId) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const credit = await getCreditById(creditId);
    if (!credit) throw new Error('Кредит не найден');

    const newBalance = credit.balance - amount;
    
    if (newBalance < 0) {
        throw new Error('Сумма погашения превышает остаток по кредиту');
    }

    // Обновляем остаток кредита
    await updateCredit(creditId, { balance: newBalance });

    // Создаём транзакцию расхода
    await addTransaction({
        type: 'expense',
        amount: amount,
        category_id: categoryId,
        account_id: accountId,
        date: new Date().toISOString().split('T')[0],
        comment: `Досрочное погашение кредита: ${credit.name}`
    });

    return {
        credit: await getCreditById(creditId),
        newBalance,
        prepaid: amount
    };
}

// ============================================
// СВОДНАЯ ИНФОРМАЦИЯ
// ============================================

/**
 * Получить сводку по финансам для дашборда
 * @returns {Promise<Object>}
 */
export async function getFinanceSummary() {
    const user = getCurrentSupabaseUser();
    if (!user) return null;

    // Счета
    const accounts = await getAccounts();
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Текущий месяц
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;
    const monthEnd = today.toISOString().split('T')[0];

    // Транзакции за месяц
    const monthTransactions = await getTransactions({
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
    const credits = await getCredits();
    const totalCreditBalance = credits.reduce((sum, c) => sum + (c.balance || 0), 0);
    
    // Ближайший платёж по кредиту
    let nextPayment = null;
    if (credits.length > 0) {
        const today = new Date();
        const futurePayments = credits
            .filter(c => c.balance > 0)
            .map(c => {
                const startDate = new Date(c.start_date);
                let nextPaymentDate = new Date(startDate);
                while (nextPaymentDate < today) {
                    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
                }
                return {
                    creditName: c.name,
                    creditId: c.id,
                    date: nextPaymentDate.toISOString().split('T')[0],
                    amount: c.payment
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));
        
        nextPayment = futurePayments[0] || null;
    }

    // Бюджет
    const budgetSummary = await getBudgetSummary(currentMonth);

    return {
        accounts,
        totalBalance,
        monthIncome,
        monthExpense,
        monthBalance: monthIncome - monthExpense,
        credits,
        totalCreditBalance,
        creditCount: credits.length,
        nextPayment,
        budget: budgetSummary,
        currentMonth
    };
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (приватные)
// ============================================

/**
 * Обновить баланс счёта при добавлении транзакции
 * @param {string} accountId - ID счёта
 * @param {string} type - тип транзакции
 * @param {number} amount - сумма
 */
async function updateAccountBalance(accountId, type, amount) {
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
 * @param {string} type - тип транзакции
 * @param {number} amount - сумма
 */
async function revertAccountBalance(accountId, type, amount) {
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
 * @param {string} date - дата транзакции
 * @param {number} amount - сумма
 */
async function updateBudgetFact(categoryId, date, amount) {
    const user = getCurrentSupabaseUser();
    if (!user) return;

    const month = date.slice(0, 7) + '-01';

    // Проверяем, есть ли запись в бюджете
    const { data: existingBudget } = await supabase
        .from('finance_budget')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', month)
        .single();

    if (existingBudget) {
        await supabase
            .from('finance_budget')
            .update({ fact: existingBudget.fact + amount })
            .eq('id', existingBudget.id);
    } else {
        // Создаём запись бюджета с планом 0
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
 * @param {string} date - дата транзакции
 * @param {number} amount - сумма
 */
async function revertBudgetFact(categoryId, date, amount) {
    const user = getCurrentSupabaseUser();
    if (!user) return;

    const month = date.slice(0, 7) + '-01';

    const { data: existingBudget } = await supabase
        .from('finance_budget')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', month)
        .single();

    if (existingBudget) {
        const newFact = Math.max(0, existingBudget.fact - amount);
        await supabase
            .from('finance_budget')
            .update({ fact: newFact })
            .eq('id', existingBudget.id);
    }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

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
    deleteCredit,  // ← УБЕДИТЬСЯ, ЧТО ЭТА СТРОКА ЕСТЬ
    calculateAnnuityPayment,
    calculatePaymentSchedule,
    calculatePrepayment,
    makePrepayment,
    
    // Сводка
    getFinanceSummary
};