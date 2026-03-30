/**
 * ============================================
 * ФАЙЛ: js/services/license-supabase.js
 * РОЛЬ: Управление лицензиями и правами модулей
 * 
 * ОСОБЕННОСТИ:
 *   - Покупка модулей для пользователя/команды
 *   - Назначение модулей пользователям
 *   - Интеграция с системой прав (permissions.js)
 *   - Хранение в Supabase
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание сервиса
 *   - 30.03.2026: Переход на Supabase
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[license-supabase] Сервис загружен');

// Конфигурация модулей и их прав
const MODULES_CONFIG = {
    real_estate: {
        id: 'real_estate',
        name: 'Недвижимость',
        price: 500,
        permissions: [
            'view_complexes',
            'create_complexes',
            'edit_all_complexes',
            'view_own_deals',
            'create_deals',
            'edit_own_deals',
            'view_counterparties',
            'create_counterparties'
        ],
        pages: ['complexes-supabase.html', 'deals-supabase.html', 'counterparties-supabase.html'],
        features: ['Объекты недвижимости', 'Сделки', 'Контрагенты', 'Ипотечный калькулятор']
    },
    finance: {
        id: 'finance',
        name: 'Финансы',
        price: 300,
        permissions: ['view_finance', 'edit_finance', 'export_finance'],
        pages: ['finance-supabase.html'],
        features: ['Бюджет', 'Расходы/Доходы', 'Отчеты', 'Категории']
    },
    education: {
        id: 'education',
        name: 'Образование',
        price: 200,
        permissions: ['view_education', 'edit_education'],
        pages: ['education-supabase.html'],
        features: ['Расписание', 'Оценки', 'Домашние задания', 'Успеваемость']
    },
    health: {
        id: 'health',
        name: 'Здоровье',
        price: 150,
        permissions: ['view_health', 'edit_health'],
        pages: ['health-supabase.html'],
        features: ['Тренировки', 'Питание', 'Замеры тела', 'Водный баланс']
    },
    productivity: {
        id: 'productivity',
        name: 'Продуктивность',
        price: 0,
        permissions: ['view_tasks', 'view_calendar', 'view_profile'],
        pages: ['tasks-supabase.html', 'calendar-supabase.html'],
        features: ['Задачи', 'Календарь', 'Заметки', 'Привычки'],
        isFree: true
    }
};

// Получить все модули
export function getModulesCatalog() {
    return MODULES_CONFIG;
}

// Получить права модуля
export function getModulePermissions(moduleId) {
    return MODULES_CONFIG[moduleId]?.permissions || [];
}

// Получить страницы модуля
export function getModulePages(moduleId) {
    return MODULES_CONFIG[moduleId]?.pages || [];
}

// ========== УПРАВЛЕНИЕ ЛИЦЕНЗИЯМИ (SUPABASE) ==========

/**
 * Получить все лицензии компании
 */
export async function getCompanyLicenses() {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return [];
    
    try {
        const { data, error } = await supabase
            .from('user_purchased_modules')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (error) {
            console.error('[license] Ошибка загрузки лицензий:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('[license] Ошибка:', error);
        return [];
    }
}

/**
 * Купить модуль для команды
 * @param {string} moduleId - ID модуля
 * @param {number} maxUsers - максимальное количество пользователей (не используется пока)
 * @returns {Promise<boolean>}
 */
export async function purchaseModuleForTeam(moduleId, maxUsers = 10) {
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) {
        console.error('[license] Пользователь не авторизован');
        return false;
    }
    
    const module = MODULES_CONFIG[moduleId];
    if (!module) {
        console.error('[license] Модуль не найден');
        return false;
    }
    
    // Проверяем, не куплен ли уже
    const { data: existing } = await supabase
        .from('user_purchased_modules')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('module_id', moduleId)
        .single();
    
    if (existing) {
        console.warn('[license] Модуль уже приобретен');
        return false;
    }
    
    // Добавляем в БД
    const { error } = await supabase
        .from('user_purchased_modules')
        .insert({
            user_id: currentUser.id,
            module_id: moduleId,
            status: 'active',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 дней
        });
    
    if (error) {
        console.error('[license] Ошибка покупки:', error);
        return false;
    }
    
    // Обновляем права пользователя
    await updateUserPermissions(currentUser.id);
    
    console.log(`[license] Модуль "${module.name}" приобретен`);
    return true;
}

/**
 * Назначить модуль пользователю (в демо-режиме пока)
 * @param {string} moduleId - ID модуля
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>}
 */
export async function assignModuleToUser(moduleId, userId) {
    // В текущей версии модуль назначается только покупателю
    const currentUser = getCurrentSupabaseUser();
    if (userId !== currentUser?.id) {
        console.warn('[license] Назначение модулей другим пользователям пока в разработке');
        return false;
    }
    
    return true;
}

/**
 * Отозвать модуль у пользователя
 * @param {string} moduleId - ID модуля
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>}
 */
export async function revokeModuleFromUser(moduleId, userId) {
    const currentUser = getCurrentSupabaseUser();
    if (userId !== currentUser?.id) {
        console.warn('[license] Отзыв модулей у других пользователей пока в разработке');
        return false;
    }
    
    const { error } = await supabase
        .from('user_purchased_modules')
        .delete()
        .eq('user_id', userId)
        .eq('module_id', moduleId);
    
    if (error) {
        console.error('[license] Ошибка отзыва:', error);
        return false;
    }
    
    await updateUserPermissions(userId);
    return true;
}

/**
 * Получить все модули, назначенные пользователю
 * @param {string} userId - ID пользователя
 * @returns {Promise<Array>}
 */
export async function getUserModules(userId) {
    try {
        const { data, error } = await supabase
            .from('user_purchased_modules')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active');
        
        if (error) {
            console.error('[license] Ошибка загрузки модулей пользователя:', error);
            return [];
        }
        
        return data.map(purchase => ({
            moduleId: purchase.module_id,
            name: MODULES_CONFIG[purchase.module_id]?.name || purchase.module_id,
            permissions: MODULES_CONFIG[purchase.module_id]?.permissions || [],
            pages: MODULES_CONFIG[purchase.module_id]?.pages || [],
            purchasedAt: purchase.created_at,
            expiresAt: purchase.expires_at
        }));
    } catch (error) {
        console.error('[license] Ошибка:', error);
        return [];
    }
}

/**
 * Проверить, есть ли у пользователя модуль
 * @param {string} userId - ID пользователя
 * @param {string} moduleId - ID модуля
 * @returns {Promise<boolean>}
 */
export async function hasUserModule(userId, moduleId) {
    const userModules = await getUserModules(userId);
    return userModules.some(m => m.moduleId === moduleId);
}

/**
 * Обновить права пользователя в системе
 * @param {string} userId - ID пользователя
 */
export async function updateUserPermissions(userId) {
    // Получаем модули пользователя
    const userModules = await getUserModules(userId);
    
    // Собираем все права из модулей
    const allPermissions = [];
    for (const module of userModules) {
        allPermissions.push(...module.permissions);
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
            
            if (window.CRM?.Permissions?.updatePermissionsCache) {
                window.CRM.Permissions.updatePermissionsCache(currentUser);
            }
        }
        
        // 👇 ДОБАВИТЬ ЭТОТ БЛОК
        // Обновляем навигацию после изменения прав
        if (window.sidebar?.renderNavigation) {
            window.sidebar.renderNavigation();
            console.log('[license] Навигация обновлена');
        }
        
        console.log(`[license] Права пользователя ${userId} обновлены:`, uniquePermissions);
        return true;
    } catch (error) {
        console.error('[license] Ошибка:', error);
        return false;
    }
}

/**
 * Получить все назначенные модули для всех пользователей
 * @returns {Promise<Object>}
 */
export async function getAllAssignments() {
    // В текущей версии возвращаем модули текущего пользователя
    const currentUser = getCurrentSupabaseUser();
    if (!currentUser) return {};
    
    const userModules = await getUserModules(currentUser.id);
    const assignments = {};
    assignments[currentUser.id] = userModules.map(m => ({
        moduleId: m.moduleId,
        name: m.name
    }));
    
    return assignments;
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
            // Нет активной подписки
            return { plan_type: 'free', status: 'active' };
        }
        
        return data;
    } catch (error) {
        console.error('[license] Ошибка загрузки подписки:', error);
        return { plan_type: 'free', status: 'active' };
    }
}

// Экспортируем в глобальный объект для обратной совместимости
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.License = {
        getModulesCatalog,
        getModulePermissions,
        getModulePages,
        purchaseModuleForTeam,
        assignModuleToUser,
        revokeModuleFromUser,
        getUserModules,
        hasUserModule,
        updateUserPermissions,
        getCompanyLicenses,
        getAllAssignments,
        getUserSubscription
    };
}

console.log('[license-supabase] Сервис инициализирован (Supabase)');