/**
 * ============================================
 * ФАЙЛ: js/services/marketplace-service.js
 * РОЛЬ: Сервис для работы с маркетплейсом (модули, виджеты, лицензии)
 * 
 * ФУНКЦИОНАЛ:
 *   - Получение каталога товаров
 *   - Покупка лицензий (личных и командных)
 *   - Назначение/отзыв лицензий пользователям
 *   - Проверка доступа к модулю/виджету
 *   - Получение лицензий пользователя/компании
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Создание сервиса для новой системы маркетплейса
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[marketplace-service] Загрузка...');

// ========== КАТАЛОГ ==========

/**
 * Получить все товары из каталога
 * @param {string} type - 'module', 'widget' или 'all'
 * @returns {Promise<Array>}
 */
export async function getCatalog(type = 'all') {
    try {
        let query = supabase
            .from('marketplace_items')
            .select('*')
            .eq('is_active', true)
            .order('type', { ascending: true })
            .order('name', { ascending: true });
        
        if (type !== 'all') {
            query = query.eq('type', type);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Форматируем цены из копеек в рубли для удобства
        return (data || []).map(item => ({
            ...item,
            price_personal_rub: item.price_personal ? item.price_personal / 100 : null,
            price_team_3_rub: item.price_team_3 ? item.price_team_3 / 100 : null,
            price_team_10_rub: item.price_team_10 ? item.price_team_10 / 100 : null,
            price_team_unlimited_rub: item.price_team_unlimited ? item.price_team_unlimited / 100 : null
        }));
    } catch (error) {
        console.error('[marketplace-service] Ошибка загрузки каталога:', error);
        return [];
    }
}

/**
 * Получить товар по идентификатору
 * @param {string} identifier - например 'deals', 'credit-calculator'
 * @returns {Promise<Object|null>}
 */
export async function getItemByIdentifier(identifier) {
    try {
        const { data, error } = await supabase
            .from('marketplace_items')
            .select('*')
            .eq('identifier', identifier)
            .single();
        
        if (error) throw error;
        
        if (data) {
            data.price_personal_rub = data.price_personal ? data.price_personal / 100 : null;
            data.price_team_3_rub = data.price_team_3 ? data.price_team_3 / 100 : null;
            data.price_team_10_rub = data.price_team_10 ? data.price_team_10 / 100 : null;
            data.price_team_unlimited_rub = data.price_team_unlimited ? data.price_team_unlimited / 100 : null;
        }
        
        return data;
    } catch (error) {
        console.error('[marketplace-service] Ошибка загрузки товара:', error);
        return null;
    }
}

// ========== ПРОВЕРКА ДОСТУПА ==========

/**
 * Проверить, есть ли у пользователя доступ к модулю/виджету
 * @param {string} identifier - идентификатор товара
 * @param {string} userId - ID пользователя (если не указан, текущий)
 * @returns {Promise<boolean>}
 */
export async function hasAccess(identifier, userId = null) {
    try {
        const user = userId ? { id: userId } : getCurrentSupabaseUser();
        if (!user) return false;
        
        // Используем функцию из БД
        const { data, error } = await supabase
            .rpc('has_access_to_item', {
                p_user_id: user.id,
                p_item_identifier: identifier
            });
        
        if (error) throw error;
        
        return data || false;
    } catch (error) {
        console.error('[marketplace-service] Ошибка проверки доступа:', error);
        return false;
    }
}

// ========== ЛИЦЕНЗИИ ==========

/**
 * Получить все лицензии текущего пользователя (личные + командные)
 * @returns {Promise<Object>} { personal: [], team: [] }
 */
export async function getUserLicenses() {
    const user = getCurrentSupabaseUser();
    if (!user) return { personal: [], team: [] };
    
    try {
        // Личные лицензии
        const { data: personal, error: personalError } = await supabase
            .from('licenses')
            .select(`
                id,
                license_type,
                status,
                purchased_at,
                expires_at,
                item:item_id(id, identifier, name, icon, type)
            `)
            .eq('buyer_user_id', user.id)
            .eq('license_type', 'personal')
            .eq('status', 'active')
            .order('purchased_at', { ascending: false });
        
        if (personalError) throw personalError;
        
        // Командные лицензии (назначенные пользователю)
        const { data: team, error: teamError } = await supabase
            .from('license_assignments')
            .select(`
                license:license_id(
                    id,
                    license_type,
                    status,
                    purchased_at,
                    expires_at,
                    company_id,
                    buyer_user_id,
                    item:item_id(id, identifier, name, icon, type)
                )
            `)
            .eq('user_id', user.id);
        
        if (teamError) throw teamError;
        
        // Фильтруем активные лицензии
        const activeTeamLicenses = (team || [])
            .filter(t => t.license?.status === 'active')
            .filter(t => !t.license?.expires_at || new Date(t.license.expires_at) > new Date())
            .map(t => t.license);
        
        return {
            personal: personal || [],
            team: activeTeamLicenses
        };
    } catch (error) {
        console.error('[marketplace-service] Ошибка загрузки лицензий:', error);
        return { personal: [], team: [] };
    }
}

/**
 * Получить лицензии компании
 * @param {string} companyId - ID компании
 * @returns {Promise<Array>}
 */
export async function getCompanyLicenses(companyId) {
    try {
        const { data, error } = await supabase
            .from('licenses')
            .select(`
                id,
                license_type,
                status,
                purchased_at,
                expires_at,
                max_seats,
                item:item_id(id, identifier, name, icon, type),
                assignments:license_assignments(
                    user_id,
                    assigned_at,
                    user:user_id(id, name, email)
                )
            `)
            .eq('company_id', companyId)
            .in('license_type', ['team_3', 'team_10', 'team_unlimited'])
            .eq('status', 'active')
            .order('purchased_at', { ascending: false });
        
        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('[marketplace-service] Ошибка загрузки лицензий компании:', error);
        return [];
    }
}

// ========== ПОКУПКА ==========

/**
 * Купить лицензию
 * @param {string} itemIdentifier - идентификатор товара
 * @param {string} licenseType - 'personal', 'team_3', 'team_10', 'team_unlimited'
 * @param {string} companyId - ID компании (если командная лицензия)
 * @returns {Promise<Object|null>}
 */
export async function purchaseLicense(itemIdentifier, licenseType, companyId = null) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    try {
        // Получаем товар
        const item = await getItemByIdentifier(itemIdentifier);
        if (!item) throw new Error('Товар не найден');
        
        // Проверяем, что цена указана для выбранного типа лицензии
        const priceField = `price_${licenseType}`;
        if (!item[priceField] && item[priceField] !== 0) {
            throw new Error(`Цена для типа лицензии ${licenseType} не указана`);
        }
        
        // Проверяем, нет ли уже активной лицензии
        const { data: existing } = await supabase
            .from('licenses')
            .select('id')
            .eq('item_id', item.id)
            .eq('buyer_user_id', user.id)
            .eq('license_type', licenseType)
            .eq('status', 'active')
            .maybeSingle();
        
        if (existing) {
            throw new Error('У вас уже есть активная лицензия на этот товар');
        }
        
        // Создаём лицензию
        const { data: license, error } = await supabase
            .from('licenses')
            .insert({
                item_id: item.id,
                buyer_user_id: user.id,
                company_id: companyId,
                license_type: licenseType,
                status: 'active'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Если это командная лицензия и указана компания, назначаем владельца
        if (licenseType !== 'personal' && companyId) {
            await supabase
                .from('license_assignments')
                .insert({
                    license_id: license.id,
                    user_id: user.id,
                    assigned_by: user.id
                });
        }
        
        console.log('[marketplace-service] Лицензия куплена:', license.id);
        return license;
    } catch (error) {
        console.error('[marketplace-service] Ошибка покупки:', error);
        throw error;
    }
}

// ========== НАЗНАЧЕНИЕ ЛИЦЕНЗИЙ ==========

/**
 * Назначить лицензию пользователю (только для командных лицензий)
 * @param {string} licenseId - ID лицензии
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>}
 */
export async function assignLicenseToUser(licenseId, userId) {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) throw new Error('Пользователь не авторизован');
    
    try {
        // Проверяем, что лицензия существует и есть свободные места
        const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .select('*, assignments:license_assignments(count)')
            .eq('id', licenseId)
            .single();
        
        if (licenseError) throw licenseError;
        
        if (license.license_type === 'personal') {
            throw new Error('Личную лицензию нельзя назначить другому пользователю');
        }
        
        const currentAssignments = await supabase
            .from('license_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('license_id', licenseId);
        
        if (currentAssignments.count >= license.max_seats) {
            throw new Error(`Достигнут лимит мест (${license.max_seats})`);
        }
        
        // Проверяем, не назначен ли уже пользователь
        const { data: existing } = await supabase
            .from('license_assignments')
            .select('id')
            .eq('license_id', licenseId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (existing) {
            throw new Error('Пользователь уже имеет доступ к этой лицензии');
        }
        
        // Назначаем
        const { error } = await supabase
            .from('license_assignments')
            .insert({
                license_id: licenseId,
                user_id: userId,
                assigned_by: currentUser.id
            });
        
        if (error) throw error;
        
        console.log('[marketplace-service] Лицензия назначена:', { licenseId, userId });
        return true;
    } catch (error) {
        console.error('[marketplace-service] Ошибка назначения:', error);
        throw error;
    }
}

/**
 * Отозвать лицензию у пользователя
 * @param {string} licenseId - ID лицензии
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>}
 */
export async function revokeLicenseFromUser(licenseId, userId) {
    try {
        const { error } = await supabase
            .from('license_assignments')
            .delete()
            .eq('license_id', licenseId)
            .eq('user_id', userId);
        
        if (error) throw error;
        
        console.log('[marketplace-service] Лицензия отозвана:', { licenseId, userId });
        return true;
    } catch (error) {
        console.error('[marketplace-service] Ошибка отзыва:', error);
        throw error;
    }
}

// ========== ПОЛУЧЕНИЕ ДОСТУПНЫХ МОДУЛЕЙ ==========

/**
 * Получить список модулей, доступных текущему пользователю
 * @returns {Promise<Array>}
 */
export async function getAccessibleModules() {
    const catalog = await getCatalog('module');
    const accessible = [];
    
    for (const module of catalog) {
        const access = await hasAccess(module.identifier);
        if (access) {
            accessible.push(module);
        }
    }
    
    return accessible;
}

/**
 * Получить список виджетов, доступных текущему пользователю
 * @returns {Promise<Array>}
 */
export async function getAccessibleWidgets() {
    const catalog = await getCatalog('widget');
    const accessible = [];
    
    for (const widget of catalog) {
        const access = await hasAccess(widget.identifier);
        if (access) {
            accessible.push(widget);
        }
    }
    
    return accessible;
}

console.log('[marketplace-service] Сервис загружен');
