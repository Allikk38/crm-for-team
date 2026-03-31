/**
 * ============================================
 * ФАЙЛ: js/services/deals-supabase.js
 * РОЛЬ: Сервис для работы со сделками (заявками) через Supabase
 * 
 * ОСОБЕННОСТИ:
 *   - Полный CRUD для сделок
 *   - Работа с этапами и чек-листами
 *   - Логирование действий в deal_logs
 *   - Поддержка списочного и детального режимов
 *   - Автоматический расчет комиссии
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Добавлен addDealLog, улучшена работа со stages
 *   - 30.03.2026: Создание файла
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
            status: deal.stage
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
        
        if (error) {
            console.error('[deals-supabase] Ошибка загрузки сделки:', error);
            return null;
        }
        
        if (data) {
            data.status = data.stage;
            
            // Убеждаемся, что stages и stage_order существуют
            if (!data.stages) {
                data.stages = {
                    new: { completed: false, checklist: {} },
                    selection: { completed: false, checklist: {} },
                    documents: { completed: false, checklist: {} },
                    deal: { completed: false, checklist: {} }
                };
            }
            
            if (!data.stage_order) {
                data.stage_order = {
                    new_building: ['new', 'selection', 'booking', 'documents', 'mortgage', 'registration', 'keys'],
                    secondary_buy: ['new', 'matching', 'showing', 'negotiation', 'documents', 'mortgage', 'deal', 'keys'],
                    secondary_sell: ['new', 'matching', 'documents', 'showing', 'negotiation', 'deal', 'keys'],
                    suburban: ['new', 'selection', 'utilities', 'documents', 'deal']
                };
            }
            
            if (!data.warnings) {
                data.warnings = [];
            }
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
        
        // Подготавливаем данные для вставки
        const insertData = {
            user_id: user.id,
            complex_id: dealData.complex_id || null,
            apartment: dealData.apartment || '',
            seller_id: dealData.seller_id || null,
            buyer_id: dealData.buyer_id || null,
            agent_id: dealData.agent_id || null,
            type: dealData.type || 'secondary',
            stage: dealData.status || 'new',
            price_initial: dealData.price_initial || 0,
            price_current: dealData.price_current || dealData.price_initial || 0,
            commission: dealData.commission || 3,
            deadline: dealData.deadline || null,
            bank: dealData.bank || null,
            mortgage_approved: dealData.mortgage_approved || false,
            notes: dealData.notes || null,
            // Новые поля
            predicted_close: dealData.predicted_close || null
        };
        
        const { data, error } = await supabase
            .from('deals')
            .insert([insertData])
            .select();
        
        if (error) throw error;
        
        const newDeal = data[0];
        
        // Добавляем лог создания
        if (newDeal) {
            await addDealLog(newDeal.id, 'deal_created', {
                type: newDeal.type,
                price: newDeal.price_initial
            });
        }
        
        console.log('[deals-supabase] Сделка создана:', newDeal.id);
        return newDeal;
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
        
        const updatedDeal = data[0];
        if (updatedDeal) {
            updatedDeal.status = updatedDeal.stage;
        }
        
        console.log('[deals-supabase] Сделка обновлена:', id);
        return updatedDeal;
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
        // Сначала удаляем логи (каскадное удаление должно сработать, но на всякий случай)
        await supabase
            .from('deal_logs')
            .delete()
            .eq('deal_id', id);
        
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
    
    const result = await updateDeal(id, updates);
    
    if (result) {
        await addDealLog(id, 'status_changed', {
            old_status: result.stage,
            new_status: status
        });
    }
    
    return result;
}

/**
 * Добавить лог действия по сделке
 * @param {string} dealId - ID сделки
 * @param {string} action - Тип действия
 * @param {Object} data - Дополнительные данные
 * @returns {Promise<boolean>} Успех операции
 */
export async function addDealLog(dealId, action, data = {}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('deal_logs')
            .insert([{
                deal_id: dealId,
                action: action,
                data: data,
                user_id: user?.id || null,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('[deals-supabase] Ошибка добавления лога:', error);
            return false;
        }
        
        console.log('[deals-supabase] Лог добавлен:', action, 'для сделки', dealId);
        return true;
    } catch (error) {
        console.error('[deals-supabase] Ошибка добавления лога:', error);
        return false;
    }
}

/**
 * Получить логи сделки
 * @param {string} dealId - ID сделки
 * @param {number} limit - Лимит записей
 * @returns {Promise<Array>} Массив логов
 */
export async function getDealLogs(dealId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('deal_logs')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('[deals-supabase] Ошибка загрузки логов:', error);
        return [];
    }
}

/**
 * Обновить чек-лист этапа
 * @param {string} dealId - ID сделки
 * @param {string} stageName - Название этапа
 * @param {string} itemKey - Ключ пункта чек-листа
 * @param {boolean} completed - Статус выполнения
 * @returns {Promise<Object|null>} Обновленная сделка
 */
export async function updateChecklistItem(dealId, stageName, itemKey, completed) {
    try {
        // Получаем текущую сделку
        const deal = await getDealById(dealId);
        if (!deal) return null;
        
        const stages = { ...deal.stages };
        
        if (!stages[stageName]) {
            stages[stageName] = { completed: false, checklist: {} };
        }
        
        if (!stages[stageName].checklist) {
            stages[stageName].checklist = {};
        }
        
        // Обновляем пункт чек-листа
        stages[stageName].checklist[itemKey] = {
            ...stages[stageName].checklist[itemKey],
            completed: completed,
            completedAt: completed ? new Date().toISOString() : null
        };
        
        // Обновляем сделку
        const updated = await updateDeal(dealId, { stages });
        
        if (updated) {
            await addDealLog(dealId, 'checklist_updated', {
                stage: stageName,
                item: itemKey,
                completed: completed
            });
        }
        
        return updated;
    } catch (error) {
        console.error('[deals-supabase] Ошибка обновления чек-листа:', error);
        return null;
    }
}

/**
 * Завершить этап сделки
 * @param {string} dealId - ID сделки
 * @param {string} stageName - Название этапа
 * @returns {Promise<Object|null>} Обновленная сделка
 */
export async function completeDealStage(dealId, stageName) {
    try {
        const deal = await getDealById(dealId);
        if (!deal) return null;
        
        const stages = { ...deal.stages };
        
        // Проверяем, можно ли завершить этап (все чек-листы выполнены)
        const stage = stages[stageName];
        if (!stage) return null;
        
        const checklist = stage.checklist || {};
        const allCompleted = Object.values(checklist).every(item => item.completed === true);
        
        if (!allCompleted) {
            console.warn('[deals-supabase] Не все пункты чек-листа выполнены');
            return null;
        }
        
        // Завершаем этап
        stages[stageName] = {
            ...stage,
            completed: true,
            completedAt: new Date().toISOString()
        };
        
        // Определяем следующий этап
        const stageOrder = deal.stage_order?.[deal.type] || 
            ['new', 'selection', 'documents', 'deal'];
        const currentIndex = stageOrder.indexOf(stageName);
        const nextStage = stageOrder[currentIndex + 1];
        
        // Обновляем сделку
        const updates = {
            stages: stages,
            stage: nextStage || stageName
        };
        
        if (nextStage && nextStage !== stageName) {
            updates.current_stage = nextStage;
        }
        
        const updated = await updateDeal(dealId, updates);
        
        if (updated) {
            await addDealLog(dealId, 'stage_completed', {
                stage: stageName,
                next_stage: nextStage || 'completed'
            });
        }
        
        return updated;
    } catch (error) {
        console.error('[deals-supabase] Ошибка завершения этапа:', error);
        return null;
    }
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
            .eq('stage', status);
        
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
            .not('stage', 'in', ['closed', 'cancelled']);
        
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

/**
 * Получить статистику по сделкам
 * @returns {Promise<Object>} Статистика
 */
export async function getDealsStats() {
    try {
        const deals = await getDeals();
        
        const stats = {
            total: deals.length,
            byStatus: {},
            byType: {},
            totalAmount: 0,
            totalCommission: 0,
            avgDealTime: 0,
            overdue: 0
        };
        
        let completedDealsTime = 0;
        let completedCount = 0;
        
        for (const deal of deals) {
            // По статусам
            const status = deal.stage || 'new';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            // По типам
            const type = deal.type || 'secondary';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // Суммы
            stats.totalAmount += deal.price_current || deal.price_initial || 0;
            stats.totalCommission += deal.commission_amount || 0;
            
            // Просрочки
            if (deal.deadline && new Date(deal.deadline) < new Date() && 
                deal.stage !== 'closed' && deal.stage !== 'cancelled') {
                stats.overdue++;
            }
            
            // Время закрытия
            if (deal.completed_at && deal.created_at) {
                const created = new Date(deal.created_at);
                const completed = new Date(deal.completed_at);
                const days = (completed - created) / (1000 * 60 * 60 * 24);
                completedDealsTime += days;
                completedCount++;
            }
        }
        
        if (completedCount > 0) {
            stats.avgDealTime = Math.round(completedDealsTime / completedCount);
        }
        
        return stats;
    } catch (error) {
        console.error('[deals-supabase] Ошибка получения статистики:', error);
        return null;
    }
}