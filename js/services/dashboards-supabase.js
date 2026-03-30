/**
 * ============================================
 * ФАЙЛ: js/services/dashboards-supabase.js
 * РОЛЬ: CRUD операции для работы с дашбордами в Supabase
 * 
 * ОСОБЕННОСТИ:
 *   - Получение активного дашборда пользователя
 *   - Сохранение/обновление макета дашборда
 *   - Создание нового дашборда
 *   - Загрузка шаблонов по роли
 *   - Кэширование дашбордов в localStorage
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание сервиса
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[dashboards-supabase] Сервис загружен');

// Кэширование
const CACHE_KEY = 'crm_dashboard_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

let dashboardCache = {
    data: null,
    timestamp: null
};

/**
 * Получить активный дашборд текущего пользователя
 * @param {boolean} forceRefresh - Принудительное обновление кэша
 * @returns {Promise<Object|null>}
 */
export async function getActiveDashboard(forceRefresh = false) {
    try {
        const user = getCurrentSupabaseUser();
        if (!user) {
            console.warn('[dashboards] Пользователь не авторизован');
            return null;
        }
        
        // Проверяем кэш
        if (!forceRefresh && dashboardCache.data && dashboardCache.timestamp) {
            const now = Date.now();
            if (now - dashboardCache.timestamp < CACHE_TTL) {
                console.log('[dashboards] Используем кэшированный дашборд');
                return dashboardCache.data;
            }
        }
        
        console.log('[dashboards] Загружаем активный дашборд для пользователя:', user.id);
        
        const { data, error } = await supabase
            .from('user_dashboards')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Нет активного дашборда - создаем из шаблона
                console.log('[dashboards] Активный дашборд не найден, создаем из шаблона');
                return await createDashboardFromTemplate();
            }
            console.error('[dashboards] Ошибка загрузки дашборда:', error);
            return null;
        }
        
        // Обновляем кэш
        dashboardCache = {
            data: data,
            timestamp: Date.now()
        };
        
        // Сохраняем в localStorage для оффлайн доступа
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[dashboards] Не удалось сохранить кэш:', e);
        }
        
        console.log('[dashboards] Дашборд загружен:', data.name);
        return data;
        
    } catch (error) {
        console.error('[dashboards] Критическая ошибка:', error);
        
        // Пытаемся восстановить из localStorage
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (data && Date.now() - timestamp < CACHE_TTL * 2) {
                    console.log('[dashboards] Восстанавливаем дашборд из localStorage');
                    return data;
                }
            }
        } catch (e) {}
        
        return null;
    }
}

/**
 * Создать дашборд из шаблона по роли пользователя
 * @param {string} role - Роль пользователя (опционально)
 * @returns {Promise<Object|null>}
 */
export async function createDashboardFromTemplate(role = null) {
    try {
        const user = getCurrentSupabaseUser();
        if (!user) return null;
        
        const userRole = role || user.role || 'agent';
        
        console.log('[dashboards] Создаем дашборд из шаблона для роли:', userRole);
        
        // Получаем шаблон для роли
        const { data: template, error: templateError } = await supabase
            .from('dashboard_templates')
            .select('layout, name')
            .eq('role', userRole)
            .limit(1)
            .single();
        
        if (templateError && templateError.code !== 'PGRST116') {
            console.error('[dashboards] Ошибка загрузки шаблона:', templateError);
        }
        
        // Если шаблон не найден, создаем пустой дашборд
        const layout = template?.layout || { widgets: [] };
        const name = template?.name || 'Мой дашборд';
        
        // Создаем дашборд
        const { data: newDashboard, error: insertError } = await supabase
            .from('user_dashboards')
            .insert({
                user_id: user.id,
                name: name,
                layout: layout,
                is_active: true
            })
            .select()
            .single();
        
        if (insertError) {
            console.error('[dashboards] Ошибка создания дашборда:', insertError);
            return null;
        }
        
        console.log('[dashboards] Дашборд создан:', newDashboard.name);
        
        // Обновляем кэш
        dashboardCache = {
            data: newDashboard,
            timestamp: Date.now()
        };
        
        return newDashboard;
        
    } catch (error) {
        console.error('[dashboards] Ошибка создания дашборда:', error);
        return null;
    }
}

/**
 * Сохранить макет дашборда
 * @param {string} dashboardId - ID дашборда
 * @param {Object} layout - Новый макет
 * @returns {Promise<boolean>}
 */
export async function saveDashboardLayout(dashboardId, layout) {
    try {
        console.log('[dashboards] Сохраняем макет дашборда:', dashboardId);
        
        const { error } = await supabase
            .from('user_dashboards')
            .update({
                layout: layout,
                updated_at: new Date().toISOString()
            })
            .eq('id', dashboardId);
        
        if (error) {
            console.error('[dashboards] Ошибка сохранения макета:', error);
            return false;
        }
        
        // Обновляем кэш
        if (dashboardCache.data && dashboardCache.data.id === dashboardId) {
            dashboardCache.data.layout = layout;
            dashboardCache.timestamp = Date.now();
            
            // Обновляем localStorage
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: dashboardCache.data,
                    timestamp: Date.now()
                }));
            } catch (e) {}
        }
        
        // Отправляем событие об обновлении дашборда
        if (window.CRM?.EventBus) {
            window.CRM.EventBus.emit('dashboard:updated', {
                dashboardId,
                layout
            });
        }
        
        console.log('[dashboards] Макет сохранен');
        return true;
        
    } catch (error) {
        console.error('[dashboards] Ошибка сохранения макета:', error);
        return false;
    }
}

/**
 * Создать новый дашборд
 * @param {string} name - Название дашборда
 * @returns {Promise<Object|null>}
 */
export async function createDashboard(name) {
    try {
        const user = getCurrentSupabaseUser();
        if (!user) return null;
        
        console.log('[dashboards] Создаем новый дашборд:', name);
        
        const { data, error } = await supabase
            .from('user_dashboards')
            .insert({
                user_id: user.id,
                name: name,
                layout: { widgets: [] },
                is_active: false
            })
            .select()
            .single();
        
        if (error) {
            console.error('[dashboards] Ошибка создания дашборда:', error);
            return null;
        }
        
        console.log('[dashboards] Дашборд создан:', data.name);
        return data;
        
    } catch (error) {
        console.error('[dashboards] Ошибка создания дашборда:', error);
        return null;
    }
}

/**
 * Получить все дашборды пользователя
 * @returns {Promise<Array>}
 */
export async function getUserDashboards() {
    try {
        const user = getCurrentSupabaseUser();
        if (!user) return [];
        
        console.log('[dashboards] Загружаем все дашборды пользователя');
        
        const { data, error } = await supabase
            .from('user_dashboards')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('[dashboards] Ошибка загрузки дашбордов:', error);
            return [];
        }
        
        return data || [];
        
    } catch (error) {
        console.error('[dashboards] Ошибка загрузки дашбордов:', error);
        return [];
    }
}

/**
 * Установить активный дашборд
 * @param {string} dashboardId - ID дашборда
 * @returns {Promise<boolean>}
 */
export async function setActiveDashboard(dashboardId) {
    try {
        const user = getCurrentSupabaseUser();
        if (!user) return false;
        
        console.log('[dashboards] Устанавливаем активный дашборд:', dashboardId);
        
        // Сначала снимаем активный флаг со всех дашбордов
        const { error: deactivateError } = await supabase
            .from('user_dashboards')
            .update({ is_active: false })
            .eq('user_id', user.id);
        
        if (deactivateError) {
            console.error('[dashboards] Ошибка деактивации дашбордов:', deactivateError);
            return false;
        }
        
        // Активируем выбранный дашборд
        const { error: activateError } = await supabase
            .from('user_dashboards')
            .update({ is_active: true })
            .eq('id', dashboardId);
        
        if (activateError) {
            console.error('[dashboards] Ошибка активации дашборда:', activateError);
            return false;
        }
        
        // Обновляем кэш
        const { data: newActive } = await supabase
            .from('user_dashboards')
            .select('*')
            .eq('id', dashboardId)
            .single();
        
        if (newActive) {
            dashboardCache = {
                data: newActive,
                timestamp: Date.now()
            };
        }
        
        // Отправляем событие о смене дашборда
        if (window.CRM?.EventBus) {
            window.CRM.EventBus.emit('dashboard:activated', {
                dashboardId,
                dashboard: newActive
            });
        }
        
        console.log('[dashboards] Активный дашборд установлен');
        return true;
        
    } catch (error) {
        console.error('[dashboards] Ошибка установки активного дашборда:', error);
        return false;
    }
}

/**
 * Удалить дашборд
 * @param {string} dashboardId - ID дашборда
 * @returns {Promise<boolean>}
 */
export async function deleteDashboard(dashboardId) {
    try {
        console.log('[dashboards] Удаляем дашборд:', dashboardId);
        
        const { error } = await supabase
            .from('user_dashboards')
            .delete()
            .eq('id', dashboardId);
        
        if (error) {
            console.error('[dashboards] Ошибка удаления дашборда:', error);
            return false;
        }
        
        // Если удалили активный дашборд, создаем новый
        if (dashboardCache.data && dashboardCache.data.id === dashboardId) {
            dashboardCache = { data: null, timestamp: null };
            await createDashboardFromTemplate();
        }
        
        // Отправляем событие
        if (window.CRM?.EventBus) {
            window.CRM.EventBus.emit('dashboard:deleted', { dashboardId });
        }
        
        console.log('[dashboards] Дашборд удален');
        return true;
        
    } catch (error) {
        console.error('[dashboards] Ошибка удаления дашборда:', error);
        return false;
    }
}

/**
 * Получить доступные виджеты из зарегистрированных модулей
 * @returns {Array}
 */
export function getAvailableWidgets() {
    const widgets = [];
    
    if (window.CRM?.Registry) {
        const modules = window.CRM.Registry.getAllModules();
        
        for (const module of modules) {
            if (module.available && module.widgets) {
                for (const [widgetId, widgetDef] of Object.entries(module.widgets)) {
                    widgets.push({
                        id: widgetId,
                        moduleId: module.id,
                        moduleName: module.name,
                        title: widgetDef.title || widgetId,
                        defaultSize: widgetDef.defaultSize || { w: 2, h: 2 },
                        permissions: widgetDef.permissions || []
                    });
                }
            }
        }
    }
    
    return widgets;
}

/**
 * Сбросить кэш дашборда
 */
export function clearDashboardCache() {
    dashboardCache = { data: null, timestamp: null };
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
    console.log('[dashboards] Кэш сброшен');
}

// Экспортируем функции в глобальный объект для обратной совместимости
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Dashboards = {
        getActiveDashboard,
        saveDashboardLayout,
        createDashboard,
        getUserDashboards,
        setActiveDashboard,
        deleteDashboard,
        getAvailableWidgets,
        clearDashboardCache
    };
}

console.log('[dashboards-supabase] Сервис инициализирован');
