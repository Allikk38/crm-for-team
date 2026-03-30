/**
 * ============================================
 * ФАЙЛ: js/modules/deals/index.js
 * РОЛЬ: Модуль сделок - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Инициализация Kanban-доски со сделками
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 *   - js/services/deals-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля сделок
 * ============================================
 */

console.log('[deals-module] Загрузка модуля сделок...');

// Определение модуля
const dealsModule = {
    id: 'deals',
    name: 'Сделки',
    version: '2.0.0',
    description: 'Управление заявками и сделками с Kanban-доской на 6 статусов',
    
    // Необходимые разрешения
    requiredPermissions: ['view_own_deals'],
    
    // Доступные тарифы
    requiredPlans: ['pro', 'business'],
    
    // Страницы модуля
    pages: {
        'deals-supabase.html': {
            title: 'Сделки',
            icon: 'fa-handshake',
            permissions: ['view_own_deals']
        }
    },
    
    // Виджеты для дашборда
    widgets: {
        'deals-summary': {
            title: 'Статистика сделок',
            component: null, // TODO: создать компонент
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_own_deals']
        },
        'deals-pipeline': {
            title: 'Воронка сделок',
            component: null, // TODO: создать компонент
            defaultSize: { w: 3, h: 3 },
            permissions: ['view_own_deals']
        },
        'overdue-deals': {
            title: 'Просроченные сделки',
            component: null, // TODO: создать компонент
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_own_deals']
        }
    },
    
    // Зависимости от других модулей
    dependencies: ['tasks'],
    
    // Callback при загрузке модуля
    onLoad: async () => {
        console.log('[deals-module] Модуль сделок загружен, инициализация...');
        
        // Динамически импортируем и инициализируем страницу
        try {
            const { initDealsPage } = await import('../../pages/deals.js');
            if (typeof initDealsPage === 'function') {
                await initDealsPage();
                console.log('[deals-module] Страница сделок инициализирована');
            }
        } catch (error) {
            console.error('[deals-module] Ошибка инициализации:', error);
        }
    },
    
    // Callback при выгрузке модуля
    onUnload: async () => {
        console.log('[deals-module] Модуль сделок выгружен');
        // Очистка событий и данных
    }
};

// Делаем глобальным для доступа из других скриптов
window.dealsModule = dealsModule;

console.log('[deals-module] Модуль готов к регистрации');
