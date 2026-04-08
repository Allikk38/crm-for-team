/**
 * ============================================
 * ФАЙЛ: js/core/planManager.js
 * РОЛЬ: Управление тарифными планами
 * 
 * ОСОБЕННОСТИ:
 *   - Определение плана по наборам разрешений (permission_sets)
 *   - Проверка доступности модулей
 *   - Контроль лимитов (задачи, сделки, объекты)
 *   - Поддержка разных тарифов (Free, Pro, Business, Enterprise)
 *   - Чистые экспорты без глобальных объектов
 * 
 * ЗАВИСИМОСТИ:
 *   - getCurrentSupabaseUser из supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Администратор получает ENTERPRISE план
 *   - 30.03.2026: Создание менеджера планов
 *   - 08.04.2026: Переход на чистые экспорты, убраны глобальные объекты
 *   - 08.04.2026: Исправлено определение тарифа по permission_sets
 * ============================================
 */

import { getCurrentSupabaseUser } from './supabase-session.js';

console.log('[planManager] Загрузка...');

// ========== ОПРЕДЕЛЕНИЕ ТАРИФНЫХ ПЛАНОВ ==========

export const PLANS = {
    FREE: {
        id: 'free',
        name: 'Бесплатный',
        price: 0,
        modules: ['tasks', 'calendar', 'profile', 'notes', 'habits', 'pomodoro'],
        features: {
            maxTasks: 50,
            maxDeals: 0,
            maxComplexes: 3,
            maxCounterparties: 10
        }
    },
    PRO: {
        id: 'pro',
        name: 'Профессиональный',
        price: 990,
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'profile', 'notes', 'habits', 'pomodoro'],
        features: {
            maxTasks: 500,
            maxDeals: 100,
            maxComplexes: 20,
            maxCounterparties: 100
        }
    },
    BUSINESS: {
        id: 'business',
        name: 'Бизнес',
        price: 2990,
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'manager', 'profile', 'notes', 'habits', 'pomodoro', 'team'],
        features: {
            maxTasks: Infinity,
            maxDeals: Infinity,
            maxComplexes: Infinity,
            maxCounterparties: Infinity
        }
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Корпоративный',
        price: 'по запросу',
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'manager', 'admin', 'dashboard', 'profile', 'notes', 'habits', 'pomodoro', 'team'],
        features: {
            maxTasks: Infinity,
            maxDeals: Infinity,
            maxComplexes: Infinity,
            maxCounterparties: Infinity,
            customFields: true,
            api: true
        }
    }
};

// ========== МЕНЕДЖЕР ПЛАНОВ ==========

class PlanManager {
    constructor() {
        this.currentPlan = null;
        this.planCache = null;
        this.userChangeHandler = null;
        this.setupUserChangeListener();
    }
    
    /**
     * Настройка слушателя изменения пользователя
     */
    setupUserChangeListener() {
        if (typeof window !== 'undefined') {
            this.userChangeHandler = () => {
                console.log('[planManager] Пользователь изменился, сбрасываем кэш плана');
                this.planCache = null;
            };
            window.addEventListener('userLoaded', this.userChangeHandler);
        }
    }
    
    /**
     * Получить текущего пользователя
     * @returns {Object|null}
     */
    getCurrentUser() {
        try {
            return getCurrentSupabaseUser();
        } catch (e) {
            return window.currentSupabaseUser || null;
        }
    }
    
    /**
     * Получить план пользователя по его наборам разрешений
     * @returns {Object} Объект плана
     */
    getUserPlan() {
        const user = this.getCurrentUser();
        
        // Кэшируем план для этого пользователя
        if (this.planCache && this.planCache.userId === user?.id) {
            return this.planCache.plan;
        }
        
        let plan = PLANS.FREE;
        
        if (!user) {
            console.log('[planManager] Пользователь не загружен, используем FREE');
        } else {
            // Определяем тариф по наборам разрешений (permission_sets)
            const permissionSets = user.permission_sets || [];
            
            if (permissionSets.includes('ADMIN')) {
                plan = PLANS.ENTERPRISE;
                console.log('[planManager] Набор ADMIN → ENTERPRISE');
            } else if (permissionSets.includes('MANAGER')) {
                plan = PLANS.BUSINESS;
                console.log('[planManager] Набор MANAGER → BUSINESS');
            } else if (permissionSets.includes('AGENT')) {
                plan = PLANS.PRO;
                console.log('[planManager] Набор AGENT → PRO');
            } else if (permissionSets.includes('BASE')) {
                plan = PLANS.FREE;
                console.log('[planManager] Набор BASE → FREE');
            } else {
                plan = PLANS.FREE;
                console.log('[planManager] Нет наборов разрешений → FREE');
            }
        }
        
        // Сохраняем в кэш
        this.planCache = {
            userId: user?.id,
            plan: plan
        };
        
        console.log(`[planManager] Итоговый план: ${plan.name} (${plan.id})`);
        
        return plan;
    }
    
    /**
     * Проверить, доступен ли модуль в текущем плане
     * @param {string} moduleId - ID модуля
     * @returns {boolean}
     */
    isModuleAvailableInPlan(moduleId) {
        const plan = this.getUserPlan();
        const available = plan.modules.includes(moduleId);
        
        if (!available) {
            console.log(`[planManager] Модуль ${moduleId} недоступен в плане ${plan.name}`);
        }
        
        return available;
    }
    
    /**
     * Получить список доступных модулей
     * @returns {Array}
     */
    getAvailableModules() {
        const plan = this.getUserPlan();
        return [...plan.modules];
    }
    
    /**
     * Проверить лимит
     * @param {string} limitType - Тип лимита (maxTasks, maxDeals, etc)
     * @param {number} currentValue - Текущее значение
     * @returns {boolean}
     */
    checkLimit(limitType, currentValue) {
        const plan = this.getUserPlan();
        const limit = plan.features[limitType];
        
        if (limit === Infinity) return true;
        
        const isWithinLimit = currentValue < limit;
        
        if (!isWithinLimit) {
            console.warn(`[planManager] Превышен лимит ${limitType}: ${currentValue}/${limit}`);
        }
        
        return isWithinLimit;
    }
    
    /**
     * Получить информацию о плане
     * @returns {Object}
     */
    getPlanInfo() {
        return this.getUserPlan();
    }
    
    /**
     * Получить все доступные планы
     * @returns {Object}
     */
    getAllPlans() {
        return { ...PLANS };
    }
    
    /**
     * Проверить, нужно ли апгрейдить план для модуля
     * @param {string} moduleId
     * @returns {Object|null} План, до которого нужно апгрейдиться, или null
     */
    getUpgradeRequiredForModule(moduleId) {
        const plans = [PLANS.FREE, PLANS.PRO, PLANS.BUSINESS, PLANS.ENTERPRISE];
        const currentPlan = this.getUserPlan();
        const currentIndex = plans.findIndex(p => p.id === currentPlan.id);
        
        for (let i = currentIndex + 1; i < plans.length; i++) {
            if (plans[i].modules.includes(moduleId)) {
                return plans[i];
            }
        }
        
        return null;
    }
    
    /**
     * Получить прогресс использования лимитов
     * @param {Object} currentCounts - Текущие значения { tasks, deals, complexes }
     * @returns {Object}
     */
    getLimitProgress(currentCounts) {
        const plan = this.getUserPlan();
        const progress = {};
        
        for (const [key, value] of Object.entries(currentCounts)) {
            const limitKey = `max${key.charAt(0).toUpperCase() + key.slice(1)}`;
            const limit = plan.features[limitKey];
            
            if (limit && limit !== Infinity) {
                progress[key] = {
                    current: value,
                    limit: limit,
                    percent: Math.round((value / limit) * 100)
                };
            } else {
                progress[key] = {
                    current: value,
                    limit: '∞',
                    percent: 0
                };
            }
        }
        
        return progress;
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (typeof window !== 'undefined' && this.userChangeHandler) {
            window.removeEventListener('userLoaded', this.userChangeHandler);
        }
        this.planCache = null;
    }
}

// ========== СОЗДАНИЕ СИНГЛТОНА ==========

const planManager = new PlanManager();

// ========== ЭКСПОРТЫ ==========

export default planManager;
export { PlanManager };

// Для обратной совместимости
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.PlanManager = planManager;
    window.CRM.PLANS = PLANS;
}

console.log('[planManager] Менеджер планов загружен');
console.log('[planManager] Доступные планы:', Object.keys(PLANS).join(', '));
