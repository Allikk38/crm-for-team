/**
 * ============================================
 * ФАЙЛ: js/services/finance/budget.js
 * РОЛЬ: Управление бюджетом (finance_budget)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение бюджета на указанный месяц
 *   - Установка плана бюджета для категории
 *   - Получение сводки по бюджету (план/факт/остаток)
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
        console.error('[finance/budget] Ошибка загрузки бюджета:', error);
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
