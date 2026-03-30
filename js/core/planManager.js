/**
 * ============================================
 * ФАЙЛ: js/core/planManager.js
 * РОЛЬ: Управление тарифными планами и доступными модулями
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание менеджера планов
 * ============================================
 */

console.log('[planManager] Загрузка менеджера планов...');

const PLANS = {
    FREE: {
        id: 'free',
        name: 'Бесплатный',
        price: 0,
        modules: ['tasks', 'calendar', 'profile'],
        features: {
            maxTasks: 50,
            maxDeals: 0,
            maxComplexes: 3
        }
    },
    PRO: {
        id: 'pro',
        name: 'Профессиональный',
        price: 990,
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'profile'],
        features: {
            maxTasks: 500,
            maxDeals: 100,
            maxComplexes: 20
        }
    },
    BUSINESS: {
        id: 'business',
        name: 'Бизнес',
        price: 2990,
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'manager', 'profile'],
        features: {
            maxTasks: Infinity,
            maxDeals: Infinity,
            maxComplexes: Infinity
        }
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Корпоративный',
        price: 'по запросу',
        modules: ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'manager', 'admin', 'profile'],
        features: {
            maxTasks: Infinity,
            maxDeals: Infinity,
            maxComplexes: Infinity,
            customFields: true,
            api: true
        }
    }
};

class PlanManager {
    constructor() {
        this.currentPlan = PLANS.FREE;
    }
    
    /**
     * Получить текущий план пользователя
     */
    getUserPlan() {
        // TODO: загружать из БД или localStorage
        const user = window.currentSupabaseUser;
        if (user?.role === 'admin') return PLANS.BUSINESS;
        if (user?.role === 'manager') return PLANS.PRO;
        return PLANS.FREE;
    }
    
    /**
     * Проверить, доступен ли модуль в текущем плане
     */
    isModuleAvailableInPlan(moduleId) {
        const plan = this.getUserPlan();
        return plan.modules.includes(moduleId);
    }
    
    /**
     * Получить доступные модули для текущего плана
     */
    getAvailableModules() {
        const plan = this.getUserPlan();
        return plan.modules;
    }
    
    /**
     * Проверить лимиты
     */
    checkLimit(limitType, currentValue) {
        const plan = this.getUserPlan();
        const limit = plan.features[limitType];
        if (limit === Infinity) return true;
        return currentValue < limit;
    }
}

window.CRM = window.CRM || {};
window.CRM.PlanManager = new PlanManager();
window.CRM.PLANS = PLANS;

console.log('[planManager] Менеджер планов загружен');
