/**
 * ============================================
 * ФАЙЛ: js/services/finance/credits.js
 * РОЛЬ: Управление кредитами (finance_credits)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение всех кредитов пользователя
 *   - Получение кредита по ID
 *   - Создание, обновление, удаление кредита
 *   - Кредитный калькулятор (аннуитетный платёж)
 *   - Расчёт графика платежей
 *   - Расчёт досрочного погашения
 *   - Внесение досрочного погашения с созданием транзакции
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - ./transactions.js (addTransaction)
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из finance-supabase.js при разделении модуля
 *   - 10.04.2026: ИСПРАВЛЕНО: учёт card_balance для кредитных карт
 * ============================================
 */

import { supabase } from '../../core/supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';
import { addTransaction } from './transactions.js';

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
        console.error('[finance/credits] Ошибка загрузки кредитов:', error);
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
        console.error('[finance/credits] Ошибка загрузки кредита:', error);
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
    // Для кредитных карт график не рассчитывается
    if (credit.credit_type === 'card') return [];
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
    // Для кредитных карт упрощённый расчёт
    if (credit.credit_type === 'card') {
        const currentBalance = credit.card_balance || 0;
        const newBalance = Math.max(0, currentBalance - prepaymentAmount);
        const payment = credit.planned_payment || credit.min_payment || 0;
        
        const oldMonths = payment > 0 ? Math.ceil(currentBalance / payment) : 0;
        const newMonths = payment > 0 ? Math.ceil(newBalance / payment) : 0;
        
        return {
            newBalance: Math.round(newBalance * 100) / 100,
            interestSaved: 0,
            monthsReduced: oldMonths - newMonths,
            newTerm: newMonths,
            totalSaved: prepaymentAmount
        };
    }
    
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

    const isCard = credit.credit_type === 'card';
    const currentBalance = isCard ? (credit.card_balance || 0) : (credit.balance || 0);
    const newBalance = currentBalance - amount;
    
    if (newBalance < 0) {
        throw new Error('Сумма погашения превышает остаток по кредиту');
    }

    // Обновляем остаток кредита
    if (isCard) {
        await updateCredit(creditId, { card_balance: newBalance });
    } else {
        await updateCredit(creditId, { balance: newBalance });
    }

    // Создаём транзакцию расхода
    await addTransaction({
        type: 'expense',
        amount: amount,
        category_id: categoryId,
        account_id: accountId,
        date: new Date().toISOString().split('T')[0],
        comment: `Досрочное погашение: ${credit.name}`
    });

    return {
        credit: await getCreditById(creditId),
        newBalance,
        prepaid: amount
    };
}

/**
 * Получить общую сумму задолженности по кредитам
 * @param {Array} credits - массив кредитов
 * @returns {number}
 */
export function getTotalCreditBalance(credits) {
    return credits.reduce((sum, c) => {
        if (c.credit_type === 'card') {
            return sum + (c.card_balance || 0);
        }
        return sum + (c.balance || 0);
    }, 0);
}
