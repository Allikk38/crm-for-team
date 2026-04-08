/**
 * ============================================
 * ФАЙЛ: js/modules/finance/index.js
 * РОЛЬ: Модуль Финансы - регистрация в реестре
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре CRM
 *   - Определение страницы finance.html
 *   - Определение виджетов для дашборда
 *   - Права доступа (доступно всем)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Создание модуля финансов
 * ============================================
 */

import { registerModule } from '../../core/registry.js';

console.log('[finance-module] Загрузка модуля финансов...');

// Определение модуля
const financeModule = {
    id: 'finance',
    name: 'Финансы',
    version: '1.0.0',
    description: 'Учет доходов и расходов',
    
    dependencies: [],
    requiredPermissions: [],
    requiredPlans: ['free', 'pro', 'business', 'enterprise'],
    
    pages: {
        'app/finance.html': {
            title: 'Финансы',
            icon: 'fa-money-bill-wave',
            permissions: []
        }
    },
    
    widgets: {
        'finance-balance': {
            title: 'Баланс',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: []
        },
        'finance-income-expense': {
            title: 'Доходы и расходы',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: []
        },
        'finance-top-expenses': {
            title: 'Топ расходов',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: []
        }
    },
    
    onLoad: async () => {
        console.log('[finance-module] Модуль финансов загружен');
        
        // Инициализируем страницу, если мы на finance.html
        const currentPath = window.location.pathname;
        if (currentPath.includes('finance.html')) {
            try {
                const { initFinancePage } = await import('../../pages/finance.js');
                if (typeof initFinancePage === 'function') {
                    await initFinancePage();
                    console.log('[finance-module] Страница финансов инициализирована');
                }
            } catch (error) {
                console.error('[finance-module] Ошибка инициализации:', error);
            }
        }
    },
    
    onUnload: async () => {
        console.log('[finance-module] Модуль финансов выгружен');
    }
};

// Регистрируем модуль в реестре
registerModule(financeModule);

console.log('[finance-module] Модуль финансов зарегистрирован');
