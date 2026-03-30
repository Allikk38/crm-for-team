/**
 * ============================================
 * ФАЙЛ: js/core/planManager.js
 * РОЛЬ: Управление тарифными планами
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание
 * ============================================
 */

console.log('[planManager] Загрузка...');

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
    }
};

class PlanManager {
    constructor() {
        this.currentPlan = null;
    }
    
    getUserPlan() {
        const user = window.currentSupabaseUser;
        if (!user) return PLANS.FREE;
        
        // По роли определяем план
        if (user.role === 'admin') return PLANS.BUSINESS;
        if (user.role === 'manager') return PLANS.PRO;
        return PLANS.FREE;
    }
    
    isModuleAvailableInPlan(moduleId) {
        const plan = this.getUserPlan();
        return plan.modules.includes(moduleId);
    }
    
    getAvailableModules() {
        const plan = this.getUserPlan();
        return [...plan.modules];
    }
    
    checkLimit(limitType, currentValue) {
        const plan = this.getUserPlan();
        const limit = plan.features[limitType];
        if (limit === Infinity) return true;
        return currentValue < limit;
    }
    
    getPlanInfo() {
        return this.getUserPlan();
    }
}

window.CRM = window.CRM || {};
window.CRM.PlanManager = new PlanManager();
window.CRM.PLANS = PLANS;

console.log('[planManager] Загружен');
