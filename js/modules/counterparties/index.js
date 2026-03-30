/**
 * ============================================
 * ФАЙЛ: js/modules/counterparties/index.js
 * РОЛЬ: Модуль контрагентов - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Интеграция со сделками через EventBus
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля контрагентов
 * ============================================
 */

console.log('[counterparties-module] Загрузка модуля контрагентов...');

// Права для модуля контрагентов
const COUNTERPARTY_PERMISSIONS = {
    VIEW_COUNTERPARTIES: 'view_counterparties',
    CREATE_COUNTERPARTIES: 'create_counterparties',
    EDIT_OWN_COUNTERPARTIES: 'edit_own_counterparties',
    EDIT_ALL_COUNTERPARTIES: 'edit_all_counterparties',
    DELETE_COUNTERPARTIES: 'delete_counterparties',
    EXPORT_COUNTERPARTIES: 'export_counterparties'
};

// Определение модуля
const counterpartiesModule = {
    id: 'counterparties',
    name: 'Контрагенты',
    version: '2.0.0',
    description: 'Управление контрагентами (продавцы, покупатели, застройщики, инвесторы)',
    
    dependencies: [],
    requiredPermissions: [COUNTERPARTY_PERMISSIONS.VIEW_COUNTERPARTIES],
    requiredPlans: ['pro', 'business', 'enterprise'],
    
    pages: {
        'counterparties-supabase.html': {
            title: 'Контрагенты',
            icon: 'fa-users',
            permissions: [COUNTERPARTY_PERMISSIONS.VIEW_COUNTERPARTIES]
        }
    },
    
    widgets: {
        'counterparties-summary': {
            title: 'Статистика контрагентов',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [COUNTERPARTY_PERMISSIONS.VIEW_COUNTERPARTIES]
        },
        'recent-counterparties': {
            title: 'Новые контрагенты',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [COUNTERPARTY_PERMISSIONS.VIEW_COUNTERPARTIES]
        },
        'counterparties-map': {
            title: 'Карта контрагентов',
            component: null,
            defaultSize: { w: 3, h: 2 },
            permissions: [COUNTERPARTY_PERMISSIONS.VIEW_COUNTERPARTIES]
        }
    },
    
    // Опциональные расширения
    optionalExtensions: {
        'show-deals-for-counterparty': {
            title: 'Сделки контрагента',
            requires: ['view_own_deals']
        },
        'create-deal-from-counterparty': {
            title: 'Создать сделку из контрагента',
            requires: ['create_deals']
        }
    },
    
    onLoad: async () => {
        console.log('[counterparties-module] Модуль контрагентов загружен');
        
        // Проверяем, загружен ли Deals модуль
        const dealsAvailable = window.CRM?.Registry?.isModuleAvailable('deals');
        
        if (dealsAvailable) {
            console.log('[counterparties-module] Модуль Deals доступен, включаем интеграцию');
            
            if (window.CRM?.EventBus) {
                // Подписываемся на создание сделки
                window.CRM.EventBus.on('deal:created', (dealData) => {
                    console.log('[counterparties-module] Создана новая сделка, обновляем контрагентов');
                    refreshCounterparties();
                });
            }
        } else {
            console.log('[counterparties-module] Модуль Deals не доступен, работаем в базовом режиме');
        }
        
        // Инициализируем страницу
        try {
            const { initCounterpartiesPage } = await import('../../pages/counterparties.js');
            if (typeof initCounterpartiesPage === 'function') {
                await initCounterpartiesPage();
                console.log('[counterparties-module] Страница контрагентов инициализирована');
            }
        } catch (error) {
            console.error('[counterparties-module] Ошибка инициализации:', error);
        }
    },
    
    onUnload: async () => {
        console.log('[counterparties-module] Модуль контрагентов выгружен');
    }
};

// Функция для обновления списка контрагентов
async function refreshCounterparties() {
    try {
        if (window.CRM?.EventBus) {
            window.CRM.EventBus.emit('counterparties:refresh', {
                timestamp: new Date().toISOString()
            });
        }
        
        // Если на странице есть функция перерисовки, вызываем её
        if (typeof window.renderCounterparties === 'function') {
            window.renderCounterparties();
        }
    } catch (error) {
        console.error('[counterparties-module] Ошибка обновления:', error);
    }
}

// Делаем глобальным для доступа из других скриптов
window.counterpartiesModule = counterpartiesModule;

console.log('[counterparties-module] Модуль готов к регистрации');
