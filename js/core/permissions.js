/**
 * ============================================
 * ФАЙЛ: js/core/permissions.js
 * РОЛЬ: Единая система прав доступа (полный переход от ролей к permission_sets)
 * 
 * ОСОБЕННОСТИ:
 *   - Полный отказ от проверки role в пользу permission_sets
 *   - Хелперы isAdmin(), isManager(), isAgent() на основе прав
 *   - Кэширование прав при загрузке пользователя
 *   - ЧИСТЫЕ ES6 ЭКСПОРТЫ
 * 
 * ЗАВИСИМОСТИ:
 *   - getCurrentSupabaseUser из supabase-session.js (импорт)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла
 *   - 09.04.2026: Полный переход на права, чистые ES6 экспорты
 *   - 09.04.2026: Добавлены хелперы isAdmin, isManager, isAgent
 *   - 09.04.2026: Убрана зависимость от window.currentSupabaseUser
 * ============================================
 */

import { getCurrentSupabaseUser } from './supabase-session.js';

console.log('[permissions] Загрузка модуля...');

// ========== ОПРЕДЕЛЕНИЯ НАБОРОВ РАЗРЕШЕНИЙ ==========

const PERMISSION_SETS = {
    BASE: {
        name: 'Базовый',
        permissions: [
            'view_dashboard',
            'view_tasks',
            'view_calendar',
            'view_profile',
            'edit_own_profile',
            'view_statistics',
            'view_team',
            'view_notes'
        ]
    },
    AGENT: {
        name: 'Агент',
        extends: 'BASE',
        permissions: [
            'create_tasks',
            'edit_own_tasks',
            'delete_own_tasks',
            'view_own_deals',
            'create_deals',
            'edit_own_deals',
            'view_complexes',
            'add_comments',
            'view_counterparties'
        ]
    },
    MANAGER: {
        name: 'Менеджер',
        extends: 'AGENT',
        permissions: [
            'view_team_tasks',
            'assign_tasks',
            'edit_any_task',
            'view_team_deals',
            'edit_any_deal',
            'view_team_kpi',
            'manage_team',
            'view_all_complexes',
            'edit_all_complexes',
            'create_counterparties',
            'edit_all_counterparties',
            'export_counterparties'
        ]
    },
    ADMIN: {
        name: 'Администратор',
        extends: 'MANAGER',
        permissions: [
            'manage_users',
            'manage_roles',
            'manage_permissions',
            'manage_plans',
            'system_settings',
            'view_all_data',
            'delete_any_data',
            'delete_counterparties'
        ]
    }
};

// ========== КЭШ ПРАВ ПОЛЬЗОВАТЕЛЯ ==========

let cachedPermissions = null;
let cachedUser = null;

/**
 * Получить все разрешения из наборов
 * @param {Array} permissionSets - массив названий наборов
 * @returns {Set} Set разрешений
 */
function getAllPermissionsFromSets(permissionSets) {
    const permissions = new Set();
    
    if (!permissionSets || !Array.isArray(permissionSets)) {
        return permissions;
    }
    
    for (const setName of permissionSets) {
        const setDef = PERMISSION_SETS[setName];
        if (setDef) {
            if (setDef.permissions) {
                setDef.permissions.forEach(p => permissions.add(p));
            }
            
            let parentSet = setDef.extends;
            while (parentSet && PERMISSION_SETS[parentSet]) {
                const parent = PERMISSION_SETS[parentSet];
                if (parent.permissions) {
                    parent.permissions.forEach(p => permissions.add(p));
                }
                parentSet = parent.extends;
            }
        }
    }
    
    return permissions;
}

/**
 * Обновить кэш прав пользователя
 * @param {Object} user - пользователь
 */
function updatePermissionsCache(user) {
    if (!user) {
        cachedPermissions = null;
        cachedUser = null;
        return;
    }
    
    // Проверяем, изменился ли пользователь
    if (cachedUser && cachedUser.id === user.id && 
        JSON.stringify(cachedUser.permission_sets) === JSON.stringify(user.permission_sets)) {
        return;
    }
    
    let permissions = new Set();
    
    if (user.permission_sets && Array.isArray(user.permission_sets) && user.permission_sets.length > 0) {
        permissions = getAllPermissionsFromSets(user.permission_sets);
        console.log('[permissions] Загружены разрешения из наборов:', Array.from(permissions));
    } else {
        // Fallback: если нет permission_sets, даем BASE
        if (PERMISSION_SETS.BASE && PERMISSION_SETS.BASE.permissions) {
            PERMISSION_SETS.BASE.permissions.forEach(p => permissions.add(p));
        }
        console.log('[permissions] Использованы минимальные права (BASE)');
    }
    
    cachedPermissions = permissions;
    cachedUser = { ...user };
    
    console.log('[permissions] Кэш прав обновлен для пользователя:', user.name);
}

/**
 * Проверить наличие разрешения
 * @param {string} permission - название разрешения
 * @returns {boolean}
 */
export function hasPermission(permission) {
    const user = getCurrentSupabaseUser();
    
    if (!user) {
        console.warn('[permissions] Нет пользователя для проверки права:', permission);
        return false;
    }
    
    if (!cachedPermissions || cachedUser?.id !== user.id) {
        updatePermissionsCache(user);
    }
    
    return cachedPermissions ? cachedPermissions.has(permission) : false;
}

/**
 * Проверить наличие любого из разрешений
 * @param {Array} permissions - массив разрешений
 * @returns {boolean}
 */
export function hasAnyPermission(permissions) {
    return permissions.some(p => hasPermission(p));
}

/**
 * Проверить наличие всех разрешений
 * @param {Array} permissions - массив разрешений
 * @returns {boolean}
 */
export function hasAllPermissions(permissions) {
    return permissions.every(p => hasPermission(p));
}

/**
 * Получить все разрешения текущего пользователя
 * @returns {Array}
 */
export function getUserPermissions() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];
    
    if (!cachedPermissions || cachedUser?.id !== user.id) {
        updatePermissionsCache(user);
    }
    return cachedPermissions ? Array.from(cachedPermissions) : [];
}

// ========== ХЕЛПЕРЫ ДЛЯ ЗАМЕНЫ РОЛЕЙ ==========

/**
 * Проверить, является ли пользователь администратором (по правам)
 * Заменяет: user.role === 'admin'
 */
export function isAdmin() {
    return hasPermission('manage_users');
}

/**
 * Проверить, является ли пользователь менеджером (по правам)
 * Заменяет: user.role === 'manager'
 */
export function isManager() {
    return hasPermission('view_team_tasks') || hasPermission('manage_team');
}

/**
 * Проверить, является ли пользователь агентом (по правам)
 * Заменяет: user.role === 'agent'
 */
export function isAgent() {
    return hasPermission('view_own_deals') && !hasPermission('view_team_tasks');
}

/**
 * Проверить, может ли пользователь редактировать все объекты
 * Заменяет: user.role === 'admin' || user.role === 'manager'
 */
export function canEditAllComplexes() {
    return hasPermission('edit_all_complexes');
}

/**
 * Проверить, может ли пользователь просматривать все объекты
 * Заменяет: user.role === 'admin' || user.role === 'manager'
 */
export function canViewAllComplexes() {
    return hasPermission('view_all_complexes');
}

/**
 * Проверить, может ли пользователь просматривать всех контрагентов
 * Заменяет: user.role === 'admin' || user.role === 'manager'
 */
export function canViewAllCounterparties() {
    return hasPermission('view_all_counterparties') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь редактировать всех контрагентов
 */
export function canEditAllCounterparties() {
    return hasPermission('edit_all_counterparties') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь создавать контрагентов
 */
export function canCreateCounterparties() {
    return hasPermission('create_counterparties') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь экспортировать контрагентов
 */
export function canExportCounterparties() {
    return hasPermission('export_counterparties') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь управлять командой
 */
export function canManageTeam() {
    return hasPermission('manage_team') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь просматривать KPI команды
 */
export function canViewTeamKpi() {
    return hasPermission('view_team_kpi') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь просматривать задачи команды
 */
export function canViewTeamTasks() {
    return hasPermission('view_team_tasks') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь назначать задачи
 */
export function canAssignTasks() {
    return hasPermission('assign_tasks') || hasPermission('manage_users');
}

/**
 * Проверить, может ли пользователь редактировать любую задачу
 */
export function canEditAnyTask() {
    return hasPermission('edit_any_task') || hasPermission('manage_users');
}

// ========== DEPRECATED: ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========

/**
 * @deprecated Используйте isAdmin() вместо role === 'admin'
 */
export function getUserRole() {
    const user = getCurrentSupabaseUser();
    if (isAdmin()) return 'admin';
    if (isManager()) return 'manager';
    if (isAgent()) return 'agent';
    return user?.role || 'viewer';
}

/**
 * @deprecated Используйте isAdmin() или hasPermission()
 */
export function hasRole(role) {
    console.warn('[permissions] hasRole() устарел, используйте isAdmin(), isManager() или hasPermission()');
    const currentRole = getUserRole();
    
    if (role === 'admin') return isAdmin();
    if (role === 'manager') return isManager() || isAdmin();
    if (role === 'agent') return isAgent() || isManager() || isAdmin();
    
    return currentRole === role;
}

// ========== ПРОВЕРКА ДОСТУПА К МОДУЛЯМ ==========

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
    'analytics': 'view_statistics'
};

export function canAccessModule(moduleId) {
    const required = MODULE_PERMISSIONS[moduleId];
    if (!required) return true;
    return hasPermission(required);
}

export function getAccessibleModules() {
    return Object.keys(MODULE_PERMISSIONS).filter(module => canAccessModule(module));
}

// ========== ИНФОРМАЦИЯ О НАБОРАХ ==========

export function getPermissionSetInfo(setName) {
    return PERMISSION_SETS[setName] || null;
}

export function getAllPermissionSets() {
    return { ...PERMISSION_SETS };
}

// ========== ОБНОВЛЕНИЕ КЭША ==========

export function refreshUserPermissions() {
    const user = getCurrentSupabaseUser();
    if (user) {
        console.log('[permissions] Принудительное обновление прав пользователя');
        updatePermissionsCache(user);
        
        window.dispatchEvent(new CustomEvent('permissionsReady', { 
            detail: { user, permissions: getUserPermissions() }
        }));
        
        return true;
    }
    return false;
}

export function updatePermissionsCache(user) {
    updatePermissionsCache(user);
}

// ========== ПОДПИСКА НА СОБЫТИЯ ==========

if (typeof window !== 'undefined') {
    window.addEventListener('userLoaded', (event) => {
        const user = event.detail;
        console.log('[permissions] Получено событие userLoaded, обновляем права');
        updatePermissionsCache(user);
        
        window.dispatchEvent(new CustomEvent('permissionsReady', { 
            detail: { user, permissions: getUserPermissions() }
        }));
    });
}

// Периодическая проверка изменения пользователя
let lastUserId = null;
setInterval(() => {
    const user = getCurrentSupabaseUser();
    const currentUserId = user?.id;
    if (currentUserId && currentUserId !== lastUserId) {
        lastUserId = currentUserId;
        console.log('[permissions] Обнаружено изменение пользователя, обновляем права');
        refreshUserPermissions();
    }
}, 1000);

// ========== ГЛОБАЛЬНЫЙ ОБЪЕКТ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Permissions = {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        getUserPermissions,
        canAccessModule,
        getAccessibleModules,
        isAdmin,
        isManager,
        isAgent,
        canEditAllComplexes,
        canViewAllComplexes,
        canViewAllCounterparties,
        canEditAllCounterparties,
        canCreateCounterparties,
        canExportCounterparties,
        canManageTeam,
        canViewTeamKpi,
        canViewTeamTasks,
        canAssignTasks,
        canEditAnyTask,
        getUserRole,
        hasRole,
        getPermissionSetInfo,
        getAllPermissionSets,
        refreshUserPermissions,
        updatePermissionsCache
    };
}

console.log('[permissions] Модуль загружен. Доступные хелперы: isAdmin(), isManager(), isAgent(), canEditAllComplexes() и др.');
