/**
 * ============================================
 * ФАЙЛ: js/core/registry.js
 * РОЛЬ: Реестр модулей CRM - централизованное управление модулями
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модулей с их метаданными
 *   - Управление зависимостями между модулями
 *   - Проверка прав доступа к модулям (переход на permission_sets)
 *   - Поддержка разных тарифных планов
 *   - События жизненного цикла модулей
 *   - ЧИСТЫЕ ES6 ЭКСПОРТЫ
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/permissions.js (hasPermission, isAdmin)
 *   - js/core/planManager.js (импорт)
 *   - js/core/supabase-session.js (getCurrentSupabaseUser)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание реестра модулей
 *   - 30.03.2026: Убрано дублирование PLANS
 *   - 09.04.2026: Добавлены чистые ES6 экспорты
 *   - 09.04.2026: Переход с role на permission_sets
 *   - 09.04.2026: Убрана зависимость от window.CRM
 * ============================================
 */

import { hasPermission, hasAnyPermission, isAdmin } from './permissions.js';
import planManager from './planManager.js';
import { getCurrentSupabaseUser } from './supabase-session.js';

console.log('[registry] Загрузка реестра модулей...');

// ========== ХРАНИЛИЩЕ МОДУЛЕЙ ==========

const modules = new Map();
const moduleStates = new Map();

// Состояния модулей
export const MODULE_STATUS = {
    REGISTERED: 'registered',
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error',
    DISABLED: 'disabled'
};

// ========== РЕГИСТРАЦИЯ МОДУЛЯ ==========

/**
 * Регистрация модуля в системе
 * @param {Object} moduleDef - Определение модуля
 * @returns {boolean}
 */
export function registerModule(moduleDef) {
    if (!moduleDef || !moduleDef.id) {
        console.error('[registry] Ошибка регистрации: не указан id модуля');
        return false;
    }
    
    if (modules.has(moduleDef.id)) {
        console.warn(`[registry] Модуль ${moduleDef.id} уже зарегистрирован`);
        return false;
    }
    
    if (!moduleDef.name) {
        console.error(`[registry] Модуль ${moduleDef.id}: не указано name`);
        return false;
    }
    
    // Нормализация данных
    const normalizedModule = {
        ...moduleDef,
        requiredPermissions: moduleDef.requiredPermissions || [],
        requiredPlans: moduleDef.requiredPlans || ['free', 'pro', 'business', 'enterprise'],
        pages: moduleDef.pages || {},
        widgets: moduleDef.widgets || {},
        dependencies: moduleDef.dependencies || [],
        status: MODULE_STATUS.REGISTERED
    };
    
    modules.set(moduleDef.id, normalizedModule);
    moduleStates.set(moduleDef.id, MODULE_STATUS.REGISTERED);
    
    console.log(`[registry] Модуль зарегистрирован: ${moduleDef.id} (${moduleDef.name})`);
    
    window.dispatchEvent(new CustomEvent('moduleRegistered', { 
        detail: { moduleId: moduleDef.id, module: normalizedModule }
    }));
    
    return true;
}

/**
 * Получить информацию о модуле
 * @param {string} moduleId - ID модуля
 */
export function getModule(moduleId) {
    return modules.get(moduleId) || null;
}

/**
 * Получить тарифный план пользователя
 */
function getUserPlan() {
    try {
        return planManager?.getUserPlan() || { id: 'free' };
    } catch (e) {
        return { id: 'free' };
    }
}

/**
 * Проверить, доступен ли модуль для текущего пользователя
 * @param {string} moduleId - ID модуля
 */
export function isModuleAvailable(moduleId) {
    const module = getModule(moduleId);
    if (!module) return false;
    
    if (module.status === MODULE_STATUS.DISABLED) return false;
    
    const user = getCurrentSupabaseUser();
    if (!user) {
        console.log(`[registry] Пользователь не загружен, модуль ${moduleId} временно недоступен`);
        return false;
    }
    
    // Администратор имеет доступ ко всем модулям
    if (isAdmin()) {
        console.log(`[registry] Администратор, модуль ${moduleId} доступен`);
        return true;
    }
    
    // Проверка прав доступа (по permission_sets)
    if (module.requiredPermissions && module.requiredPermissions.length > 0) {
        const hasPermissions = hasAnyPermission(module.requiredPermissions);
        if (!hasPermissions) {
            console.log(`[registry] Нет прав для модуля ${moduleId}, требуется:`, module.requiredPermissions);
            return false;
        }
    }
    
    // Проверка тарифного плана
    const userPlan = getUserPlan();
    const planId = userPlan.id || 'free';
    if (!module.requiredPlans.includes(planId) && !module.requiredPlans.includes(planId.toUpperCase())) {
        console.log(`[registry] Тарифный план ${planId} не подходит для модуля ${moduleId}`);
        return false;
    }
    
    return true;
}

/**
 * Получить все доступные модули для текущего пользователя
 */
export function getAvailableModules() {
    const available = [];
    for (const [id, module] of modules) {
        if (isModuleAvailable(id)) {
            available.push({
                id,
                name: module.name,
                version: module.version,
                pages: module.pages,
                widgets: module.widgets
            });
        }
    }
    return available;
}

/**
 * Загрузить модуль
 * @param {string} moduleId - ID модуля
 */
export async function loadModule(moduleId) {
    const module = getModule(moduleId);
    if (!module) {
        console.error(`[registry] Модуль ${moduleId} не найден`);
        return null;
    }
    
    if (!isModuleAvailable(moduleId)) {
        console.warn(`[registry] Модуль ${moduleId} недоступен для текущего пользователя`);
        return null;
    }
    
    const currentStatus = moduleStates.get(moduleId);
    if (currentStatus === MODULE_STATUS.LOADED) {
        console.log(`[registry] Модуль ${moduleId} уже загружен`);
        return module;
    }
    
    if (currentStatus === MODULE_STATUS.LOADING) {
        console.log(`[registry] Модуль ${moduleId} уже загружается`);
        return null;
    }
    
    // Загрузка зависимостей
    if (module.dependencies && module.dependencies.length > 0) {
        console.log(`[registry] Загрузка зависимостей для ${moduleId}:`, module.dependencies);
        for (const depId of module.dependencies) {
            await loadModule(depId);
        }
    }
    
    moduleStates.set(moduleId, MODULE_STATUS.LOADING);
    
    try {
        if (module.onLoad && typeof module.onLoad === 'function') {
            await module.onLoad();
        }
        
        module.status = MODULE_STATUS.LOADED;
        moduleStates.set(moduleId, MODULE_STATUS.LOADED);
        
        console.log(`[registry] Модуль загружен: ${moduleId}`);
        
        window.dispatchEvent(new CustomEvent('moduleLoaded', { 
            detail: { moduleId, module }
        }));
        
        return module;
    } catch (error) {
        console.error(`[registry] Ошибка загрузки модуля ${moduleId}:`, error);
        module.status = MODULE_STATUS.ERROR;
        moduleStates.set(moduleId, MODULE_STATUS.ERROR);
        
        window.dispatchEvent(new CustomEvent('moduleError', { 
            detail: { moduleId, error }
        }));
        
        return null;
    }
}

/**
 * Выгрузить модуль
 * @param {string} moduleId - ID модуля
 */
export async function unloadModule(moduleId) {
    const module = getModule(moduleId);
    if (!module) return;
    
    if (module.status !== MODULE_STATUS.LOADED) {
        console.warn(`[registry] Модуль ${moduleId} не загружен`);
        return;
    }
    
    try {
        if (module.onUnload && typeof module.onUnload === 'function') {
            await module.onUnload();
        }
        
        module.status = MODULE_STATUS.REGISTERED;
        moduleStates.set(moduleId, MODULE_STATUS.REGISTERED);
        
        console.log(`[registry] Модуль выгружен: ${moduleId}`);
        
        window.dispatchEvent(new CustomEvent('moduleUnloaded', { 
            detail: { moduleId }
        }));
    } catch (error) {
        console.error(`[registry] Ошибка выгрузки модуля ${moduleId}:`, error);
    }
}

/**
 * Получить виджеты для дашборда
 * @param {string} moduleId - ID модуля (опционально)
 */
export function getAvailableWidgets(moduleId = null) {
    const widgets = [];
    
    for (const [id, module] of modules) {
        if (moduleId && id !== moduleId) continue;
        if (!isModuleAvailable(id)) continue;
        
        if (module.widgets) {
            for (const [widgetId, widgetDef] of Object.entries(module.widgets)) {
                widgets.push({
                    moduleId: id,
                    moduleName: module.name,
                    widgetId,
                    ...widgetDef
                });
            }
        }
    }
    
    return widgets;
}

/**
 * Получить страницы модуля
 * @param {string} moduleId - ID модуля
 */
export function getModulePages(moduleId) {
    const module = getModule(moduleId);
    if (!module) return {};
    
    const user = getCurrentSupabaseUser();
    if (!user) return {};
    
    const accessiblePages = {};
    for (const [pagePath, pageDef] of Object.entries(module.pages)) {
        if (!pageDef.permissions || pageDef.permissions.length === 0) {
            accessiblePages[pagePath] = pageDef;
        } else if (hasAnyPermission(pageDef.permissions)) {
            accessiblePages[pagePath] = pageDef;
        }
    }
    
    return accessiblePages;
}

/**
 * Проверить, загружен ли модуль
 */
export function isModuleLoaded(moduleId) {
    return moduleStates.get(moduleId) === MODULE_STATUS.LOADED;
}

/**
 * Получить все зарегистрированные модули
 */
export function getAllModules() {
    return Array.from(modules.entries()).map(([id, module]) => ({
        id,
        name: module.name,
        version: module.version,
        status: module.status,
        available: isModuleAvailable(id)
    }));
}

// ========== ГЛОБАЛЬНЫЙ ОБЪЕКТ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Registry = {
        registerModule,
        getModule,
        isModuleAvailable,
        getAvailableModules,
        loadModule,
        unloadModule,
        getAvailableWidgets,
        getModulePages,
        isModuleLoaded,
        getAllModules,
        MODULE_STATUS
    };
}

console.log('[registry] Реестр модулей загружен');
