/**
 * ============================================
 * ФАЙЛ: js/services/deals-supabase.js
 * РОЛЬ: Сервис для работы со сделками (заявками) через Supabase
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * ============================================
 * 
 * ВНИМАНИЕ: В таблице deals используется поле stage (не status!)
 * Статусы: new, showing, negotiation, documents, closed, cancelled
 * ============================================
 */

import { supabase } from '../core/supabase.js';

/**
 * Получить все сделки текущего пользователя
 * @returns {Promise<Array>} Массив сделок
 */
export async function getDeals() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('[deals-supabase] Пользователь не авторизован');
            return [];
        }
        
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Добавляем поле status как алиас для stage для совместимости
        const dealsWithStatus = (data || []).map(deal => ({
            ...deal,
            status: deal.stage // добавляем status для совместимости с frontend
        }));
        
        console.log(`[deals-supabase] Загружено ${dealsWithStatus?.length || 0} сделок`);
        return dealsWithStatus;
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки сделок:', error);
        return [];
    }
}

/**
 * Получить сделку по ID
 * @param {number|string} id - ID сделки
 * @returns {Promise<Object|null>} Объект сделки или null
 */
export async function getDealById(id) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
        
        if (error) throw error;
        
        if (data) {
            data.status = data.stage; // добавляем status для совместимости
        }
        return data;
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки сделки:', error);
        return null;
    }
}

/**
 * Создать новую сделку
 * @param {Object} dealData - Данные сделки
 * @returns {Promise<Object|null>} Созданная сделка или null
 */
export async function createDeal(dealData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            throw new Error('Пользователь не авторизован');
        }
        
        const { data, error } = await supabase
            .from('deals')
            .insert([{
                user_id: user.id,
                complex_id: dealData.complex_id || null,
                apartment: dealData.apartment || '',
                seller_id: dealData.seller_id || null,
                buyer_id: dealData.buyer_id || null,
                agent_id: dealData.agent_id || null,
                type: dealData.type || 'secondary',
                stage: dealData.status || 'new', // используем stage, а не status
                price_initial: dealData.price_initial || 0,
                price_current: dealData.price_current || dealData.price_initial || 0,
                commission: dealData.commission || 3,
                deadline: dealData.deadline || null,
                bank: dealData.bank || null,
                mortgage_approved: dealData.mortgage_approved || false,
                notes: dealData.notes || null
            }])
            .select();
        
        if (error) throw error;
        
        console.log('[deals-supabase] Сделка создана:', data[0].id);
        return data[0];
    } catch (error) {
        console.error('[deals-supabase] Ошибка создания сделки:', error);
        return null;
    }
}

/**
 * Обновить сделку
 * @param {number|string} id - ID сделки
 * @param {Object} updates - Обновляемые поля
 * @returns {Promise<Object|null>} Обновленная сделка или null
 */
export async function updateDeal(id, updates) {
    try {
        // Преобразуем status в stage, если есть
        const updateData = { ...updates };
        if (updateData.status !== undefined) {
            updateData.stage = updateData.status;
            delete updateData.status;
        }
        
        // Убираем поля, которые нельзя обновлять
        delete updateData.user_id;
        delete updateData.id;
        delete updateData.created_at;
        
        // Добавляем updated_at
        updateData.updated_at = new Date().toISOString();
        
        console.log('[deals-supabase] Обновление сделки:', {
            id: id,
            updateData: updateData
        });
        
        const { data, error } = await supabase
            .from('deals')
            .update(updateData)
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('[deals-supabase] Ошибка Supabase:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }
        
        console.log('[deals-supabase] Сделка обновлена:', id);
        return data[0];
    } catch (error) {
        console.error('[deals-supabase] Ошибка обновления сделки:', error);
        return null;
    }
}

/**
 * Удалить сделку
 * @param {number|string} id - ID сделки
 * @returns {Promise<boolean>} Успех операции
 */
export async function deleteDeal(id) {
    try {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('[deals-supabase] Сделка удалена:', id);
        return true;
    } catch (error) {
        console.error('[deals-supabase] Ошибка удаления сделки:', error);
        return false;
    }
}

/**
 * Обновить статус сделки
 * @param {number|string} id - ID сделки
 * @param {string} status - Новый статус
 * @returns {Promise<Object|null>} Обновленная сделка или null
 */
export async function updateDealStatus(id, status) {
    const updates = { status }; // status будет преобразован в stage в updateDeal
    
    if (status === 'closed' || status === 'cancelled') {
        updates.completed_at = new Date().toISOString();
    }
    
    return await updateDeal(id, updates);
}

/**
 * Получить сделки по статусу
 * @param {string} status - Статус сделки
 * @returns {Promise<Array>} Массив сделок
 */
export async function getDealsByStatus(status) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .eq('stage', status); // используем stage, а не status
        
        if (error) throw error;
        
        const dealsWithStatus = (data || []).map(deal => ({
            ...deal,
            status: deal.stage
        }));
        return dealsWithStatus;
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки сделок по статусу:', error);
        return [];
    }
}

/**
 * Получить сделки по агенту
 * @param {string} agentId - ID агента (github_username)
 * @returns {Promise<Array>} Массив сделок
 */
export async function getDealsByAgent(agentId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .eq('agent_id', agentId);
        
        if (error) throw error;
        
        const dealsWithStatus = (data || []).map(deal => ({
            ...deal,
            status: deal.stage
        }));
        return dealsWithStatus;
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки сделок по агенту:', error);
        return [];
    }
}

/**
 * Получить просроченные сделки (дедлайн просрочен, не закрыты)
 * @returns {Promise<Array>} Массив просроченных сделок
 */
export async function getOverdueDeals() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .lt('deadline', today)
            .not('stage', 'in', ['closed', 'cancelled']); // используем stage
        
        if (error) throw error;
        
        const dealsWithStatus = (data || []).map(deal => ({
            ...deal,
            status: deal.stage
        }));
        return dealsWithStatus;
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки просроченных сделок:', error);
        return [];
    }
}
