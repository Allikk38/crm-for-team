/**
 * ============================================
 * ФАЙЛ: js/core/permissions.js
 * РОЛЬ: Система прав доступа (работает параллельно со старой системой)
 * 
 * ОСОБЕННОСТИ:
 *   - Поддержка старых ролей (role) как fallback
 *   - Новые наборы разрешений (permission_sets) из таблицы profiles
 *   - Кэширование прав при загрузке пользователя
 *   - Гибкая проверка отдельных разрешений
 * 
 * ЗАВИСИМОСТИ:
 *   - window.currentSupabaseUser (из supabase-session.js)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла, интеграция с существующей системой
 * ============================================
 */

console.log('[permissions] Загрузка модуля...');

// ========== ОПРЕДЕЛЕНИЯ НАБОРОВ РАЗРЕШЕНИЙ ==========

const PERMISSION_SETS = {
    BASE: {
        name: 'Базовый',
        permissions: [
            'view_tasks',
            'view_calendar',
            'view_profile',
            'edit_own_profile'
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
            'add_comments'
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
            'edit_all_complexes'
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
            'delete_any_data'
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
            // Добавляем разрешения текущего набора
            if (setDef.permissions) {
                setDef.permissions.forEach(p => permissions.add(p));
            }
            
            // Рекурсивно добавляем разрешения родительских наборов
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
 * Получить разрешения из старой роли (для обратной совместимости)
 * @param {string} role - роль пользователя
 * @returns {Set} Set разрешений
 */
function getPermissionsFromLegacyRole(role) {
    const permissions = new Set();
    
    switch (role) {
        case 'admin':
            // Администратор имеет все разрешения
            Object.values(PERMISSION_SETS).forEach(set => {
                if (set.permissions) {
                    set.permissions.forEach(p => permissions.add(p));
                }
            });
            break;
        case 'manager':
            // Менеджер имеет разрешения MANAGER и ниже
            ['BASE', 'AGENT', 'MANAGER'].forEach(setName => {
                const set = PERMISSION_SETS[setName];
                if (set && set.permissions) {
                    set.permissions.forEach(p => permissions.add(p));
                }
            });
            break;
        case 'agent':
            // Агент имеет разрешения AGENT и BASE
            ['BASE', 'AGENT'].forEach(setName => {
                const set = PERMISSION_SETS[setName];
                if (set && set.permissions) {
                    set.permissions.forEach(p => permissions.add(p));
                }
            });
            break;
        default:
            // По умолчанию только базовые разрешения
            if (PERMISSION_SETS.BASE && PERMISSION_SETS.BASE.permissions) {
                PERMISSION_SETS.BASE.permissions.forEach(p => permissions.add(p));
            }
    }
    
    return permissions;
}

/**
 * Обновить кэш прав пользователя
 * @param {Object} user - пользователь из window.currentSupabaseUser
 */
function updatePermissionsCache(user) {
    if (!user) {
        cachedPermissions = null;
        cachedUser = null;
        return;
    }
    
    // Проверяем, изменился ли пользователь
    if (cachedUser && cachedUser.id === user.id && 
        JSON.stringify(cachedUser.permission_sets) === JSON.stringify(user.permission_sets) && 
        cachedUser.role === user.role) {
        return; // Кэш актуален
    }
    
    let permissions = new Set();
    
    // Приоритет 1: Новые наборы разрешений (если есть)
    if (user.permission_sets && Array.isArray(user.permission_sets) && user.permission_sets.length > 0) {
        permissions = getAllPermissionsFromSets(user.permission_sets);
        console.log('[permissions] Загружены разрешения из наборов:', Array.from(permissions));
    }
    // Приоритет 2: Старая система ролей (fallback)
    else if (user.role) {
        permissions = getPermissionsFromLegacyRole(user.role);
        console.log('[permissions] Загружены разрешения из роли:', user.role, Array.from(permissions));
    }
    // Приоритет 3: Минимальные права (BASE)
    else {
        if (PERMISSION_SETS.BASE && PERMISSION_SETS.BASE.permissions) {
            PERMISSION_SETS.BASE.permissions.forEach(p => permissions.add(p));
        }
        console.log('[permissions] Использованы минимальные права (BASE)');
    }
    
    cachedPermissions = permissions;
    cachedUser = { ...user }; // Копируем для сравнения
    
    console.log('[permissions] Кэш прав обновлен для пользователя:', user.name);
}

/**
 * Проверить наличие разрешения
 * @param {string} permission - название разрешения
 * @param {Object} user - опционально, конкретный пользователь (по умолчанию текущий)
 * @returns {boolean}
 */
function hasPermission(permission, user = null) {
    const targetUser = user || window.currentSupabaseUser;
    
    if (!targetUser) {
        console.warn('[permissions] Нет пользователя для проверки права:', permission);
        return false;
    }
    
    // Обновляем кэш если нужно
    if (!cachedPermissions || cachedUser?.id !== targetUser.id) {
        updatePermissionsCache(targetUser);
    }
    
    const has = cachedPermissions ? cachedPermissions.has(permission) : false;
    
    if (!has) {
        console.debug('[permissions] Доступ запрещен:', permission, 'для пользователя:', targetUser.name);
    }
    
    return has;
}

/**
 * Проверить наличие любого из разрешений
 * @param {Array} permissions - массив разрешений
 * @param {Object} user - опционально
 * @returns {boolean}
 */
function hasAnyPermission(permissions, user = null) {
    return permissions.some(p => hasPermission(p, user));
}

/**
 * Проверить наличие всех разрешений
 * @param {Array} permissions - массив разрешений
 * @param {Object} user - опционально
 * @returns {boolean}
 */
function hasAllPermissions(permissions, user = null) {
    return permissions.every(p => hasPermission(p, user));
}

/**
 * Получить все разрешения текущего пользователя
 * @returns {Array}
 */
function getUserPermissions() {
    if (!window.currentSupabaseUser) return [];
    if (!cachedPermissions || cachedUser?.id !== window.currentSupabaseUser.id) {
        updatePermissionsCache(window.currentSupabaseUser);
    }
    return cachedPermissions ? Array.from(cachedPermissions) : [];
}

/**
 * Проверить доступ к модулю
 * @param {string} moduleId - идентификатор модуля
 * @returns {boolean}
 */
function canAccessModule(moduleId) {
    // Маппинг модулей на необходимые разрешения
    const modulePermissions = {
        'tasks': ['view_tasks'],
        'deals': ['view_own_deals'],
        'complexes': ['view_complexes'],
        'calendar': ['view_calendar'],
        'manager': ['view_team_kpi'],
        'admin': ['manage_users'],
        'profile': ['view_profile']
    };
    
    const required = modulePermissions[moduleId];
    if (!required) return true; // Неизвестный модуль доступен по умолчанию
    
    return hasAnyPermission(required);
}

/**
 * Получить доступные модули для текущего пользователя
 * @returns {Array}
 */
function getAccessibleModules() {
    const allModules = ['tasks', 'deals', 'complexes', 'calendar', 'manager', 'admin', 'profile'];
    return allModules.filter(module => canAccessModule(module));
}

// ========== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ПРИ ЗАГРУЗКЕ ПОЛЬЗОВАТЕЛЯ ==========

// Подписываемся на событие загрузки пользователя
if (typeof window !== 'undefined') {
    window.addEventListener('userLoaded', (event) => {
        const user = event.detail;
        console.log('[permissions] Получено событие userLoaded, обновляем права');
        updatePermissionsCache(user);
        
        // Отправляем событие о готовности прав
        window.dispatchEvent(new CustomEvent('permissionsReady', { 
            detail: { user, permissions: getUserPermissions() }
        }));
    });
    
    // Если пользователь уже загружен, обновляем сразу
    if (window.currentSupabaseUser) {
        setTimeout(() => {
            console.log('[permissions] Пользователь уже загружен, обновляем права');
            updatePermissionsCache(window.currentSupabaseUser);
        }, 100);
    }
}

// ========== ЭКСПОРТ ГЛОБАЛЬНОГО ОБЪЕКТА ==========

window.CRM = window.CRM || {};
window.CRM.Permissions = {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getUserPermissions,
    canAccessModule,
    getAccessibleModules,
    canManageUser: (targetUser) => {
        if (!window.currentSupabaseUser) return false;
        if (hasPermission('manage_users')) return true;
        if (hasPermission('manage_team')) {
            const targetRole = targetUser?.role;
            const currentRole = window.currentSupabaseUser?.role;
            if (targetRole === 'admin') return false;
            if (targetRole === 'manager' && currentRole === 'manager') return false;
            return true;
        }
        return false;
    },
    getPermissionSetInfo: (setName) => PERMISSION_SETS[setName] || null,
    getAllPermissionSets: () => ({ ...PERMISSION_SETS })
};

console.log('[permissions] Модуль загружен');
