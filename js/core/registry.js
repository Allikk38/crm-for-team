/**
 * ============================================
 * ФАЙЛ: js/core/registry.js
 * РОЛЬ: Реестр модулей CRM - централизованное управление модулями
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модулей с их метаданными
 *   - Управление зависимостями между модулями
 *   - Проверка прав доступа к модулям
 *   - Поддержка разных тарифных планов
 *   - События жизненного цикла модулей
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание реестра модулей
 *   - 30.03.2026: Добавлена проверка наличия пользователя в isModuleAvailable
 * ============================================
 */

console.log('[registry] Загрузка реестра модулей...');

// ========== ХРАНИЛИЩЕ МОДУЛЕЙ ==========

const modules = new Map();
const moduleStates = new Map(); // 'loading', 'loaded', 'error', 'disabled'

// Состояния модулей
const MODULE_STATUS = {
    REGISTERED: 'registered',
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error',
    DISABLED: 'disabled'
};

// ========== ОПРЕДЕЛЕНИЯ МОДУЛЕЙ ==========

// Тарифные планы
const PLANS = {
    FREE: 'free',
    PRO: 'pro',
    BUSINESS: 'business'
};

// Базовые модули для каждого плана
const PLAN_MODULES = {
    [PLANS.FREE]: ['tasks', 'calendar', 'profile'],
    [PLANS.PRO]: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'profile'],
    [PLANS.BUSINESS]: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'manager', 'admin', 'profile']
};

/**
 * Регистрация модуля в системе
 * @param {Object} moduleDef - Определение модуля
 */
function registerModule(moduleDef) {
    if (!moduleDef || !moduleDef.id) {
        console.error('[registry] Ошибка регистрации: не указан id модуля');
        return false;
    }
    
    if (modules.has(moduleDef.id)) {
        console.warn(`[registry] Модуль ${moduleDef.id} уже зарегистрирован`);
        return false;
    }
    
    // Валидация обязательных полей
    if (!moduleDef.name) {
        console.error(`[registry] Модуль ${moduleDef.id}: не указано name`);
        return false;
    }
    
    // Нормализация данных
    const normalizedModule = {
        ...moduleDef,
        requiredPermissions: moduleDef.requiredPermissions || [],
        requiredPlans: moduleDef.requiredPlans || Object.values(PLANS),
        pages: moduleDef.pages || {},
        widgets: moduleDef.widgets || {},
        dependencies: moduleDef.dependencies || [],
        status: MODULE_STATUS.REGISTERED
    };
    
    modules.set(moduleDef.id, normalizedModule);
    moduleStates.set(moduleDef.id, MODULE_STATUS.REGISTERED);
    
    console.log(`[registry] Модуль зарегистрирован: ${moduleDef.id} (${moduleDef.name})`);
    
    // Отправляем событие о регистрации
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('moduleRegistered', { 
            detail: { moduleId: moduleDef.id, module: normalizedModule }
        }));
    }
    
    return true;
}

/**
 * Получить информацию о модуле
 * @param {string} moduleId - ID модуля
 */
function getModule(moduleId) {
    return modules.get(moduleId) || null;
}

/**
 * Получить тарифный план пользователя
 */
function getUserPlan() {
    // TODO: Реализовать получение плана из БД или localStorage
    // Пока возвращаем BUSINESS для администратора
    if (window.currentSupabaseUser?.role === 'admin') {
        return PLANS.BUSINESS;
    }
    return PLANS.FREE; // По умолчанию FREE
}

/**
 * Проверить, доступен ли модуль для текущего пользователя
 * @param {string} moduleId - ID модуля
 */
function isModuleAvailable(moduleId) {
    const module = getModule(moduleId);
    if (!module) return false;
    
    // Проверка статуса
    if (module.status === MODULE_STATUS.DISABLED) return false;
    
    // ВАЖНО: Проверяем, что пользователь загружен
    if (!window.currentSupabaseUser) {
        console.log(`[registry] Пользователь не загружен, модуль ${moduleId} временно недоступен`);
        return false;
    }
    
    // Проверка прав доступа
    if (module.requiredPermissions && module.requiredPermissions.length > 0) {
        // Проверяем, что объект Permissions существует
        if (!window.CRM?.Permissions) {
            console.warn(`[registry] Модуль прав не загружен, модуль ${moduleId} временно недоступен`);
            return false;
        }
        
        const hasPermissions = window.CRM.Permissions.hasAnyPermission(module.requiredPermissions);
        if (!hasPermissions) {
            console.log(`[registry] Нет прав для модуля ${moduleId}, требуется:`, module.requiredPermissions);
            return false;
        }
    }
    
    // Проверка тарифного плана
    const userPlan = getUserPlan();
    if (!module.requiredPlans.includes(userPlan)) {
        console.log(`[registry] Тарифный план ${userPlan} не подходит для модуля ${moduleId}`);
        return false;
    }
    
    return true;
}

/**
 * Получить все доступные модули для текущего пользователя
 */
function getAvailableModules() {
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
async function loadModule(moduleId) {
    const module = getModule(moduleId);
    if (!module) {
        console.error(`[registry] Модуль ${moduleId} не найден`);
        return null;
    }
    
    // Проверка доступности
    if (!isModuleAvailable(moduleId)) {
        console.warn(`[registry] Модуль ${moduleId} недоступен для текущего пользователя`);
        return null;
    }
    
    // Проверка текущего статуса
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
    
    // Обновляем статус
    moduleStates.set(moduleId, MODULE_STATUS.LOADING);
    
    try {
        // Вызываем onLoad если есть
        if (module.onLoad && typeof module.onLoad === 'function') {
            await module.onLoad();
        }
        
        module.status = MODULE_STATUS.LOADED;
        moduleStates.set(moduleId, MODULE_STATUS.LOADED);
        
        console.log(`[registry] Модуль загружен: ${moduleId}`);
        
        // Отправляем событие о загрузке
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('moduleLoaded', { 
                detail: { moduleId, module }
            }));
        }
        
        return module;
    } catch (error) {
        console.error(`[registry] Ошибка загрузки модуля ${moduleId}:`, error);
        module.status = MODULE_STATUS.ERROR;
        moduleStates.set(moduleId, MODULE_STATUS.ERROR);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('moduleError', { 
                detail: { moduleId, error }
            }));
        }
        
        return null;
    }
}

/**
 * Выгрузить модуль
 * @param {string} moduleId - ID модуля
 */
async function unloadModule(moduleId) {
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
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('moduleUnloaded', { 
                detail: { moduleId }
            }));
        }
    } catch (error) {
        console.error(`[registry] Ошибка выгрузки модуля ${moduleId}:`, error);
    }
}

/**
 * Получить виджеты для дашборда
 * @param {string} moduleId - ID модуля (опционально)
 */
function getAvailableWidgets(moduleId = null) {
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
function getModulePages(moduleId) {
    const module = getModule(moduleId);
    if (!module) return {};
    
    // Проверяем, что пользователь загружен и права доступны
    if (!window.currentSupabaseUser || !window.CRM?.Permissions) {
        return {};
    }
    
    // Фильтруем страницы по правам доступа
    const accessiblePages = {};
    for (const [pagePath, pageDef] of Object.entries(module.pages)) {
        if (!pageDef.permissions || pageDef.permissions.length === 0) {
            accessiblePages[pagePath] = pageDef;
        } else if (window.CRM.Permissions.hasAnyPermission(pageDef.permissions)) {
            accessiblePages[pagePath] = pageDef;
        }
    }
    
    return accessiblePages;
}

/**
 * Проверить, загружен ли модуль
 */
function isModuleLoaded(moduleId) {
    return moduleStates.get(moduleId) === MODULE_STATUS.LOADED;
}

/**
 * Получить все зарегистрированные модули
 */
function getAllModules() {
    return Array.from(modules.entries()).map(([id, module]) => ({
        id,
        name: module.name,
        version: module.version,
        status: module.status,
        available: isModuleAvailable(id)
    }));
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

// Экспортируем в глобальный объект
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
    MODULE_STATUS,
    PLANS
};

console.log('[registry] Реестр модулей загружен');
