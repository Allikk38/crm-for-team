/**
 * ============================================
 * ФАЙЛ: js/services/license-supabase.js
 * РОЛЬ: Управление лицензиями и правами модулей
 * 
 * ОСОБЕННОСТИ:
 *   - Покупка модулей для команды
 *   - Назначение модулей пользователям
 *   - Интеграция с системой прав (permissions.js)
 *   - Работа с таблицами: modules, company_licenses, user_module_assignments, companies
 *   - ЧИСТЫЕ ES6 ЭКСПОРТЫ (БЕЗ ГЛОБАЛЬНЫХ ОБЪЕКТОВ)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание сервиса
 *   - 30.03.2026: Переход на Supabase
 *   - 31.03.2026: Интеграция с новой структурой таблиц (modules, company_licenses, user_module_assignments)
 *   - 10.04.2026: УДАЛЁН ГЛОБАЛЬНЫЙ ОБЪЕКТ window.CRM.License (правило №5)
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[license-supabase] Сервис загружен');

// ========== КЭШ МОДУЛЕЙ ==========
let modulesCache = null;

/**
 * Загрузить модули из БД (с кэшированием)
 */
async function loadModulesFromDB() {
    if (modulesCache) return modulesCache;
    
    try {
        const { data, error } = await supabase
            .from('modules')
            .select('*');
        
        if (error) throw error;
        
        modulesCache = data;
        return data;
    } catch (error) {
        console.error('[license] Ошибка загрузки модулей:', error);
        return [];
    }
}

/**
 * Получить каталог модулей (из БД)
 */
export async function getModulesCatalog() {
    const modules = await loadModulesFromDB();
    // Преобразуем в формат для совместимости с существующим кодом
    const catalog = {};
    for (const module of modules) {
        catalog[module.id] = {
            id: module.id,
            name: module.name,
            description: module.description,
            price: module.price,
            permissions: module.permissions || [],
            pages: module.pages || [],
            widgets: module.widgets || [],
            icon: module.icon,
            isFree: module.is_free,
            isTeamModule: module.is_team_module
        };
    }
    return catalog;
}

/**
 * Получить права модуля
 */
export async function getModulePermissions(moduleId) {
    const catalog = await getModulesCatalog();
    return catalog[moduleId]?.permissions || [];
}

/**
 * Получить страницы модуля
 */
export async function getModulePages(moduleId) {
    const catalog = await getModulesCatalog();
    return catalog[moduleId]?.pages || [];
}

// ========== УПРАВЛЕНИЕ КОМПАНИЕЙ ==========

/**
 * Получить или создать компанию для текущего пользователя
 */
export async function getOrCreateCompany() {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return null;
    
    try {
        // Ищем компанию, где пользователь владелец
        let { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('owner_id', currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('[license] Ошибка поиска компании:', error);
        }
        
        if (!data) {
            // Создаем компанию
            const { data: newCompany, error: createError } = await supabase
                .from('companies')
                .insert({
                    name: `Компания ${currentUser.name}`,
                    owner_id: currentUser.id
                })
                .select()
                .single();
            
            if (createError) {
                console.error('[license] Ошибка создания компании:', createError);
                return null;
            }
            
            // Добавляем владельца в company_members
            await supabase
                .from('company_members')
                .insert({
                    company_id: newCompany.id,
                    user_id: currentUser.id,
                    role: 'owner'
                });
            
            data = newCompany;
        }
        
        return data;
    } catch (error) {
        console.error('[license] Ошибка:', error);
        return null;
    }
}

/**
 * Получить всех членов компании
 */
export async function getCompanyMembers(companyId) {
    try {
        const { data, error } = await supabase
            .from('company_members')
            .select('*, profiles:user_id(id, name, email, role, github_username)')
            .eq('company_id', companyId);
        
        if (error) throw error;
        
        return data.map(m => ({
            id: m.profiles.id,
            name: m.profiles.name,
            email: m.profiles.email,
            role: m.profiles.role,
            github_username: m.profiles.github_username,
            member_role: m.role
        }));
    } catch (error) {
        console.error('[license] Ошибка загрузки членов компании:', error);
        return [];
    }
}

// ========== УПРАВЛЕНИЕ ЛИЦЕНЗИЯМИ ==========

/**
 * Получить все лицензии компании
 */
export async function getCompanyLicenses(companyId = null) {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return [];
    
    let company = null;
    if (companyId) {
        const { data } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();
        company = data;
    } else {
        company = await getOrCreateCompany();
    }
    
    if (!company) return [];
    
    try {
        const { data, error } = await supabase
            .from('company_licenses')
            .select('*, modules:module_id(*)')
            .eq('company_id', company.id)
            .eq('status', 'active');
        
        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('[license] Ошибка загрузки лицензий:', error);
        return [];
    }
}

/**
 * Купить модуль для команды
 * @param {string} moduleId - ID модуля
 * @param {number} maxUsers - максимальное количество пользователей
 */
export async function purchaseModuleForTeam(moduleId, maxUsers = 10) {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) {
        console.error('[license] Пользователь не авторизован');
        return false;
    }
    
    const catalog = await getModulesCatalog();
    const module = catalog[moduleId];
    if (!module) {
        console.error('[license] Модуль не найден');
        return false;
    }
    
    // Получаем или создаем компанию
    const company = await getOrCreateCompany();
    if (!company) {
        console.error('[license] Не удалось создать компанию');
        return false;
    }
    
    // Проверяем, не куплена ли уже лицензия
    const { data: existing } = await supabase
        .from('company_licenses')
        .select('*')
        .eq('company_id', company.id)
        .eq('module_id', moduleId)
        .single();
    
    if (existing) {
        console.warn('[license] Лицензия уже приобретена');
        return false;
    }
    
    // Добавляем лицензию
    const { error } = await supabase
        .from('company_licenses')
        .insert({
            company_id: company.id,
            module_id: moduleId,
            purchased_by: currentUser.id,
            max_users: maxUsers,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
    
    if (error) {
        console.error('[license] Ошибка покупки:', error);
        return false;
    }
    
    // Автоматически назначаем модуль владельцу
    await assignModuleToUser(moduleId, currentUser.id);
    
    console.log(`[license] Модуль "${module.name}" приобретен для команды`);
    return true;
}

/**
 * Назначить модуль пользователю
 * @param {string} moduleId - ID модуля
 * @param {string} userId - ID пользователя
 */
export async function assignModuleToUser(moduleId, userId) {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return false;
    
    // Проверяем, есть ли лицензия на модуль в компании
    const company = await getOrCreateCompany();
    if (!company) return false;
    
    const { data: license } = await supabase
        .from('company_licenses')
        .select('*')
        .eq('company_id', company.id)
        .eq('module_id', moduleId)
        .eq('status', 'active')
        .single();
    
    if (!license) {
        console.error('[license] Лицензия на модуль не найдена');
        return false;
    }
    
    // Проверяем количество назначений
    const { count } = await supabase
        .from('user_module_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('module_id', moduleId);
    
    if (count >= license.max_users) {
        console.error('[license] Достигнут лимит пользователей');
        return false;
    }
    
    // Проверяем, не назначен ли уже
    const { data: existing } = await supabase
        .from('user_module_assignments')
        .select('*')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .eq('company_id', company.id)
        .single();
    
    if (existing) {
        console.warn('[license] Модуль уже назначен пользователю');
        return false;
    }
    
    // Назначаем модуль
    const { error } = await supabase
        .from('user_module_assignments')
        .insert({
            user_id: userId,
            module_id: moduleId,
            company_id: company.id,
            assigned_by: currentUser.id
        });
    
    if (error) {
        console.error('[license] Ошибка назначения:', error);
        return false;
    }
    
    // Обновляем права пользователя
    await updateUserPermissions(userId);
    
    console.log(`[license] Модуль назначен пользователю ${userId}`);
    return true;
}

/**
 * Отозвать модуль у пользователя
 */
export async function revokeModuleFromUser(moduleId, userId) {
    const company = await getOrCreateCompany();
    if (!company) return false;
    
    const { error } = await supabase
        .from('user_module_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .eq('company_id', company.id);
    
    if (error) {
        console.error('[license] Ошибка отзыва:', error);
        return false;
    }
    
    // Обновляем права пользователя
    await updateUserPermissions(userId);
    
    console.log(`[license] Модуль отозван у пользователя ${userId}`);
    return true;
}

/**
 * Получить все модули, назначенные пользователю
 */
export async function getUserModules(userId) {
    try {
        const { data, error } = await supabase
            .from('user_module_assignments')
            .select('*, modules:module_id(*)')
            .eq('user_id', userId)
            .eq('status', 'active');
        
        if (error) throw error;
        
        const catalog = await getModulesCatalog();
        
        return (data || []).map(assignment => ({
            moduleId: assignment.module_id,
            name: assignment.modules?.name || catalog[assignment.module_id]?.name,
            permissions: assignment.modules?.permissions || catalog[assignment.module_id]?.permissions || [],
            pages: assignment.modules?.pages || catalog[assignment.module_id]?.pages || [],
            assignedAt: assignment.assigned_at,
            assignedBy: assignment.assigned_by
        }));
    } catch (error) {
        console.error('[license] Ошибка загрузки модулей пользователя:', error);
        return [];
    }
}

/**
 * Проверить, есть ли у пользователя модуль
 */
export async function hasUserModule(userId, moduleId) {
    const userModules = await getUserModules(userId);
    return userModules.some(m => m.moduleId === moduleId);
}

/**
 * Обновить права пользователя в системе
 */
export async function updateUserPermissions(userId) {
    // Получаем модули пользователя
    const userModules = await getUserModules(userId);
    
    // Собираем все права из модулей
    const allPermissions = [];
    for (const module of userModules) {
        if (module.permissions) {
            allPermissions.push(...module.permissions);
        }
    }
    
    // Добавляем базовые права
    const basePermissions = [
        'view_tasks',
        'view_calendar',
        'view_profile',
        'edit_own_profile',
        'view_dashboard',
        'view_statistics'
    ];
    allPermissions.push(...basePermissions);
    
    // Уникальные права
    const uniquePermissions = [...new Set(allPermissions)];
    
    // Обновляем permission_sets пользователя
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ 
                permission_sets: uniquePermissions,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) {
            console.error('[license] Ошибка обновления прав:', error);
            return false;
        }
        
        // Если обновляем текущего пользователя, обновляем кэш
        const currentUser = getCurrentSupabaseUser();
        if (currentUser && currentUser.id === userId) {
            currentUser.permission_sets = uniquePermissions;
            
            // Импортируем динамически чтобы избежать циклической зависимости
            const { updatePermissionsCache } = await import('../core/permissions.js');
            updatePermissionsCache(currentUser);
        }
        
        // Обновляем навигацию через событие
        window.dispatchEvent(new CustomEvent('permissionsUpdated', { detail: { userId } }));
        
        console.log(`[license] Права пользователя ${userId} обновлены:`, uniquePermissions);
        return true;
    } catch (error) {
        console.error('[license] Ошибка:', error);
        return false;
    }
}

/**
 * Получить все назначения модулей
 */
export async function getAllAssignments() {
    const company = await getOrCreateCompany();
    if (!company) return {};
    
    try {
        const { data, error } = await supabase
            .from('user_module_assignments')
            .select('*, modules:module_id(*)')
            .eq('company_id', company.id)
            .eq('status', 'active');
        
        if (error) throw error;
        
        const assignments = {};
        for (const item of data || []) {
            if (!assignments[item.user_id]) {
                assignments[item.user_id] = [];
            }
            assignments[item.user_id].push({
                moduleId: item.module_id,
                name: item.modules?.name,
                assignedAt: item.assigned_at
            });
        }
        
        return assignments;
    } catch (error) {
        console.error('[license] Ошибка загрузки назначений:', error);
        return {};
    }
}

/**
 * Получить подписку пользователя
 */
export async function getUserSubscription() {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return null;
    
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .single();
        
        if (error) {
            return { plan_type: 'free', status: 'active' };
        }
        
        return data;
    } catch (error) {
        console.error('[license] Ошибка загрузки подписки:', error);
        return { plan_type: 'free', status: 'active' };
    }
}

console.log('[license-supabase] Сервис инициализирован (Supabase)');
