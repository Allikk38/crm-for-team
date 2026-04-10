/**
 * ============================================
 * ФАЙЛ: js/services/license-supabase.js
 * РОЛЬ: Управление лицензиями (НОВАЯ СИСТЕМА МАРКЕТПЛЕЙСА)
 * 
 * ОСОБЕННОСТИ:
 *   - Реэкспорт функций из marketplace-service.js
 *   - Обратная совместимость со старыми названиями функций
 *   - Постепенный переход на новую систему
 * 
 * ЗАВИСИМОСТИ:
 *   - ./marketplace-service.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание сервиса
 *   - 30.03.2026: Переход на Supabase
 *   - 31.03.2026: Интеграция с таблицами modules, company_licenses
 *   - 10.04.2026: ПОЛНАЯ ЗАМЕНА на новую систему маркетплейса
 *   - 10.04.2026: Сохранена обратная совместимость через алиасы
 * ============================================
 */

import {
    getCatalog,
    getItemByIdentifier,
    hasAccess,
    getUserLicenses,
    getCompanyLicenses,
    purchaseLicense,
    assignLicenseToUser,
    revokeLicenseFromUser,
    getAccessibleModules,
    getAccessibleWidgets
} from './marketplace-service.js';

console.log('[license-supabase] Сервис загружен (новая система маркетплейса)');

// ========== ОСНОВНЫЕ ФУНКЦИИ (НОВЫЕ НАЗВАНИЯ) ==========

export {
    getCatalog as getModulesCatalog,
    getItemByIdentifier as getModuleById,
    hasAccess as hasUserModule,
    getUserLicenses,
    getCompanyLicenses,
    purchaseLicense as purchaseModuleForTeam,
    assignLicenseToUser as assignModuleToUser,
    revokeLicenseFromUser as revokeModuleFromUser,
    getAccessibleModules,
    getAccessibleWidgets
};

// ========== АЛИАСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========

/**
 * @deprecated Используйте getModulesCatalog()
 */
export async function getCatalogLegacy() {
    console.warn('[license-supabase] getCatalogLegacy() устарел, используйте getModulesCatalog()');
    return getCatalog();
}

/**
 * @deprecated Используйте hasUserModule()
 */
export async function checkModuleAccess(identifier, userId = null) {
    console.warn('[license-supabase] checkModuleAccess() устарел, используйте hasUserModule()');
    return hasAccess(identifier, userId);
}

/**
 * @deprecated Используйте purchaseModuleForTeam()
 */
export async function buyLicense(itemIdentifier, licenseType, companyId = null) {
    console.warn('[license-supabase] buyLicense() устарел, используйте purchaseModuleForTeam()');
    return purchaseLicense(itemIdentifier, licenseType, companyId);
}

// ========== ФУНКЦИИ ДЛЯ СТАРОГО КОДА ==========

/**
 * Получить права модуля (для совместимости со старым permissions.js)
 * @param {string} moduleId - идентификатор модуля
 * @returns {Promise<Array>}
 */
export async function getModulePermissions(moduleId) {
    const module = await getItemByIdentifier(moduleId);
    return module?.permissions || [];
}

/**
 * Получить страницы модуля
 * @param {string} moduleId - идентификатор модуля
 * @returns {Promise<Array>}
 */
export async function getModulePages(moduleId) {
    const module = await getItemByIdentifier(moduleId);
    return module?.pages || [];
}

/**
 * Получить виджеты модуля
 * @param {string} moduleId - идентификатор модуля
 * @returns {Promise<Array>}
 */
export async function getModuleWidgets(moduleId) {
    const module = await getItemByIdentifier(moduleId);
    return module?.widgets || [];
}

/**
 * Получить все назначения лицензий (для админ-панели)
 * @returns {Promise<Object>}
 */
export async function getAllAssignments() {
    const user = getCurrentSupabaseUser();
    if (!user) return {};
    
    try {
        // Получаем компанию пользователя
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();
        
        if (!profile?.company_id) return {};
        
        // Получаем лицензии компании
        const licenses = await getCompanyLicenses(profile.company_id);
        
        const assignments = {};
        for (const license of licenses) {
            for (const assignment of (license.assignments || [])) {
                if (!assignments[assignment.user_id]) {
                    assignments[assignment.user_id] = [];
                }
                assignments[assignment.user_id].push({
                    moduleId: license.item.identifier,
                    name: license.item.name,
                    assignedAt: assignment.assigned_at
                });
            }
        }
        
        return assignments;
    } catch (error) {
        console.error('[license-supabase] Ошибка загрузки назначений:', error);
        return {};
    }
}

/**
 * Получить подписку пользователя (для совместимости)
 * @returns {Promise<Object>}
 */
export async function getUserSubscription() {
    const licenses = await getUserLicenses();
    
    return {
        plan_type: licenses.personal.length > 0 || licenses.team.length > 0 ? 'pro' : 'free',
        status: 'active',
        modules: [
            ...licenses.personal.map(l => l.item?.identifier),
            ...licenses.team.map(l => l.item?.identifier)
        ]
    };
}

/**
 * Обновить права пользователя (вызывается после назначения лицензий)
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>}
 */
export async function updateUserPermissions(userId) {
    // В новой системе права обновляются автоматически через БД-функцию
    // Эта функция оставлена для совместимости
    console.log('[license-supabase] updateUserPermissions: права обновляются автоматически');
    return true;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

/**
 * Проверить, доступен ли модуль в тарифе
 * @deprecated Тарифов больше нет, используйте hasUserModule()
 */
export async function isModuleInPlan(moduleId, planType) {
    console.warn('[license-supabase] isModuleInPlan() устарел, тарифы заменены на маркетплейс');
    // Бесплатные модули доступны всем
    const item = await getItemByIdentifier(moduleId);
    return item?.price_personal === 0;
}

/**
 * Получить или создать компанию
 * @deprecated Используйте team-supabase.js
 */
export async function getOrCreateCompany() {
    console.warn('[license-supabase] getOrCreateCompany() устарел, используйте team-supabase.js');
    try {
        const { getOrCreateCompany } = await import('./team-supabase.js');
        return await getOrCreateCompany();
    } catch {
        return null;
    }
}

/**
 * Получить членов компании
 * @deprecated Используйте team-supabase.js
 */
export async function getCompanyMembers(companyId) {
    console.warn('[license-supabase] getCompanyMembers() устарел, используйте team-supabase.js');
    try {
        const { getCompanyMembers } = await import('./team-supabase.js');
        return await getCompanyMembers(companyId);
    } catch {
        return [];
    }
}

// ========== ИМПОРТ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ ==========
import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[license-supabase] Сервис инициализирован (новая система)');
