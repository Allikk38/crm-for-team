/**
 * ============================================
 * ФАЙЛ: js/core/permissions.js
 * РОЛЬ: Единая система прав доступа (интеграция с маркетплейсом)
 * 
 * ОСОБЕННОСТИ:
 *   - Проверка доступа через marketplace-service
 *   - Кэширование прав при загрузке пользователя
 *   - ЧИСТЫЕ ES6 ЭКСПОРТЫ (БЕЗ ГЛОБАЛЬНЫХ ОБЪЕКТОВ)
 * 
 * ЗАВИСИМОСТИ:
 *   - getCurrentSupabaseUser из supabase-session.js
 *   - marketplace-service (динамический импорт)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 *   - 09.04.2026: Полный переход на права, чистые ES6 экспорты
 *   - 09.04.2026: Добавлены хелперы isAdmin, isManager, isAgent
 *   - 10.04.2026: УДАЛЁН ГЛОБАЛЬНЫЙ ОБЪЕКТ window.CRM.Permissions
 *   - 10.04.2026: ИНТЕГРАЦИЯ С НОВОЙ СИСТЕМОЙ МАРКЕТПЛЕЙСА
 * ============================================
 */

import { getCurrentSupabaseUser } from './supabase-session.js';

console.log('[permissions] Загрузка модуля...');

// ========== КЭШ ДОСТУПОВ ==========

let cachedAccess = new Map();      // userId -> Set разрешённых module_id
let cachedUser = null;
let marketplaceService = null;

/**
 * Ленивая загрузка marketplace-service
 */
async function getMarketplaceService() {
    if (!marketplaceService) {
        try {
            marketplaceService = await import('../services/marketplace-service.js');
        } catch (e) {
            console.error('[permissions] Ошибка загрузки marketplace-service:', e);
            return null;
        }
    }
    return marketplaceService;
}

/**
 * Проверить доступ к модулю через маркетплейс
 */
async function checkMarketplaceAccess(userId, moduleId) {
    const service = await getMarketplaceService();
    if (!service) return false;
    
    try {
        return await service.hasAccess(moduleId, userId);
    } catch (e) {
        console.error('[permissions] Ошибка проверки доступа:', e);
        return false;
    }
}

/**
 * Обновить кэш доступов пользователя
 */
async function refreshAccessCache(user) {
    if (!user) {
        cachedAccess.clear();
        cachedUser = null;
        return;
    }
    
    // Проверяем, изменился ли пользователь
    if (cachedUser && cachedUser.id === user.id) {
        return;
    }
    
    cachedUser = { ...user };
    cachedAccess.clear();
    
    // Администратор имеет доступ ко всем модулям
    if (user.permission_sets?.includes('ADMIN') || user.role === 'admin') {
        console.log('[permissions] Администратор — полный доступ');
        // Не заполняем кэш, isAdmin() будет возвращать true
        return;
    }
    
    // Для обычных пользователей — загружаем доступы через marketplace
    const service = await getMarketplaceService();
    if (!service) return;
    
    try {
        const catalog = await service.getCatalog();
        const accessibleIds = [];
        
        for (const item of catalog) {
            const hasAccess = await service.hasAccess(item.identifier, user.id);
            if (hasAccess) {
                accessibleIds.push(item.identifier);
            }
        }
        
        cachedAccess.set(user.id, new Set(accessibleIds));
        console.log('[permissions] Загружены доступы:', accessibleIds);
    } catch (e) {
        console.error('[permissions] Ошибка загрузки доступов:', e);
    }
}

// ========== ПРОВЕРКА ДОСТУПА ==========

/**
 * Проверить наличие разрешения
 */
export function hasPermission(permission) {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    
    // Администратор имеет все права
    if (user.permission_sets?.includes('ADMIN') || user.role === 'admin') {
        return true;
    }
    
    // Проверяем permission_sets (старая система)
    if (user.permission_sets?.includes(permission)) {
        return true;
    }
    
    // TODO: добавить маппинг permission -> module
    
    return false;
}

/**
 * Проверить наличие любого из разрешений
 */
export function hasAnyPermission(permissions) {
    return permissions.some(p => hasPermission(p));
}

/**
 * Проверить наличие всех разрешений
 */
export function hasAllPermissions(permissions) {
    return permissions.every(p => hasPermission(p));
}

/**
 * Получить все разрешения текущего пользователя
 */
export function getUserPermissions() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];
    
    if (user.permission_sets?.includes('ADMIN') || user.role === 'admin') {
        return ['*']; // Все права
    }
    
    return user.permission_sets || [];
}

// ========== ХЕЛПЕРЫ ДЛЯ РОЛЕЙ ==========

export function isAdmin() {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    return user.permission_sets?.includes('ADMIN') || user.role === 'admin';
}

export function isManager() {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    return user.permission_sets?.includes('MANAGER') || user.role === 'manager';
}

export function isAgent() {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    return user.permission_sets?.includes('AGENT') || user.role === 'agent';
}

// ========== ПРОВЕРКА ДОСТУПА К МОДУЛЯМ ==========

/**
 * Проверить доступ к модулю (основной метод)
 * @param {string} moduleId - идентификатор модуля (tasks, deals, finance, ...)
 * @returns {Promise<boolean>}
 */
export async function canAccessModule(moduleId) {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    
    // Администратор имеет доступ ко всем модулям
    if (isAdmin()) return true;
    
    // Проверяем кэш
    const userAccess = cachedAccess.get(user.id);
    if (userAccess) {
        return userAccess.has(moduleId);
    }
    
    // Загружаем доступы
    await refreshAccessCache(user);
    return cachedAccess.get(user.id)?.has(moduleId) || false;
}

/**
 * Синхронная версия (использует кэш)
 */
export function canAccessModuleSync(moduleId) {
    const user = getCurrentSupabaseUser();
    if (!user) return false;
    if (isAdmin()) return true;
    
    return cachedAccess.get(user.id)?.has(moduleId) || false;
}

/**
 * Получить все доступные модули
 */
export async function getAccessibleModules() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];
    if (isAdmin()) return ['*'];
    
    await refreshAccessCache(user);
    return Array.from(cachedAccess.get(user.id) || []);
}

// ========== УСТАРЕВШИЕ ФУНКЦИИ (ДЛЯ СОВМЕСТИМОСТИ) ==========

const MODULE_PERMISSIONS = {
    'tasks': 'view_tasks',
    'deals': 'view_own_deals',
    'complexes': 'view_complexes',
    'calendar': 'view_calendar',
    'manager': 'view_team_kpi',
    'admin': 'manage_users',
    'profile': 'view_profile',
    'team': 'view_team',
    'counterparties': 'view_counterparties',
    'notes': 'view_notes',
    'analytics': 'view_statistics',
    'finance': 'view_finance'
};

/**
 * @deprecated Используйте canAccessModule()
 */
export function canAccessModuleLegacy(moduleId) {
    console.warn('[permissions] canAccessModuleLegacy() устарел, используйте canAccessModule()');
    return canAccessModuleSync(moduleId);
}

/**
 * @deprecated Используйте getAccessibleModules()
 */
export function getAccessibleModulesLegacy() {
    console.warn('[permissions] getAccessibleModulesLegacy() устарел');
    return Object.keys(MODULE_PERMISSIONS).filter(module => canAccessModuleSync(module));
}

// ========== ХЕЛПЕРЫ ДЛЯ БИЗНЕС-ЛОГИКИ ==========

export function canEditAllComplexes() {
    return isAdmin() || isManager();
}

export function canViewAllComplexes() {
    return isAdmin() || isManager();
}

export function canViewAllCounterparties() {
    return isAdmin() || isManager();
}

export function canEditAllCounterparties() {
    return isAdmin() || isManager();
}

export function canCreateCounterparties() {
    return true; // Любой агент может создавать
}

export function canExportCounterparties() {
    return isAdmin() || isManager();
}

export function canManageTeam() {
    return isAdmin();
}

export function canViewTeamKpi() {
    return isAdmin() || isManager();
}

export function canViewTeamTasks() {
    return isAdmin() || isManager();
}

export function canAssignTasks() {
    return isAdmin() || isManager();
}

export function canEditAnyTask() {
    return isAdmin() || isManager();
}

// ========== DEPRECATED ==========

export function getUserRole() {
    const user = getCurrentSupabaseUser();
    if (isAdmin()) return 'admin';
    if (isManager()) return 'manager';
    if (isAgent()) return 'agent';
    return user?.role || 'viewer';
}

export function hasRole(role) {
    console.warn('[permissions] hasRole() устарел');
    const currentRole = getUserRole();
    if (role === 'admin') return isAdmin();
    if (role === 'manager') return isManager() || isAdmin();
    if (role === 'agent') return isAgent() || isManager() || isAdmin();
    return currentRole === role;
}

// ========== ИНФОРМАЦИЯ О НАБОРАХ ==========

const PERMISSION_SETS = {
    BASE: { name: 'Базовый', permissions: [] },
    AGENT: { name: 'Агент', extends: 'BASE', permissions: [] },
    MANAGER: { name: 'Менеджер', extends: 'AGENT', permissions: [] },
    ADMIN: { name: 'Администратор', extends: 'MANAGER', permissions: ['*'] }
};

export function getPermissionSetInfo(setName) {
    return PERMISSION_SETS[setName] || null;
}

export function getAllPermissionSets() {
    return { ...PERMISSION_SETS };
}

// ========== ОБНОВЛЕНИЕ КЭША ==========

export async function refreshUserPermissions() {
    const user = getCurrentSupabaseUser();
    if (user) {
        console.log('[permissions] Принудительное обновление доступов');
        await refreshAccessCache(user);
        
        window.dispatchEvent(new CustomEvent('permissionsReady', { 
            detail: { user, modules: getAccessibleModules() }
        }));
        
        return true;
    }
    return false;
}

export { refreshAccessCache as updatePermissionsCache };

// ========== ПОДПИСКА НА СОБЫТИЯ ==========

if (typeof window !== 'undefined') {
    window.addEventListener('userLoaded', async (event) => {
        const user = event.detail;
        console.log('[permissions] userLoaded, обновляем доступы');
        await refreshAccessCache(user);
        
        window.dispatchEvent(new CustomEvent('permissionsReady', { 
            detail: { user, modules: await getAccessibleModules() }
        }));
    });
    
    // Событие после покупки лицензии
    window.addEventListener('license:purchased', async () => {
        console.log('[permissions] license:purchased, сбрасываем кэш');
        cachedAccess.clear();
        await refreshUserPermissions();
    });
}

// Периодическая проверка изменения пользователя
let lastUserId = null;
setInterval(async () => {
    const user = getCurrentSupabaseUser();
    const currentUserId = user?.id;
    if (currentUserId && currentUserId !== lastUserId) {
        lastUserId = currentUserId;
        console.log('[permissions] Пользователь изменился, обновляем доступы');
        await refreshUserPermissions();
    }
}, 1000);

console.log('[permissions] Модуль загружен (интеграция с маркетплейсом)');
