/**
 * ============================================
 * ФАЙЛ: js/modules/index/index.js
 * РОЛЬ: Модуль дашборда - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - KPI показатели, графики, рейтинг агентов
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля дашборда
 * ============================================
 */

console.log('[index-module] Загрузка модуля дашборда...');

// Права для модуля дашборда
const INDEX_PERMISSIONS = {
    VIEW_DASHBOARD: 'view_dashboard',
    VIEW_STATISTICS: 'view_statistics',
    VIEW_WIDGETS: 'view_widgets'
};

// Определение модуля
const indexModule = {
    id: 'index',
    name: 'Дашборд',
    version: '2.0.0',
    description: 'Главная страница с KPI показателями, графиками и рейтингом агентов',
    
    dependencies: ['tasks'],
    requiredPermissions: [INDEX_PERMISSIONS.VIEW_DASHBOARD],
    requiredPlans: ['free', 'pro', 'business', 'enterprise'],
    
    pages: {
        'index-supabase.html': {
            title: 'Дашборд',
            icon: 'fa-home',
            permissions: [INDEX_PERMISSIONS.VIEW_DASHBOARD]
        }
    },
    
    widgets: {
        'kpi-summary': {
            title: 'KPI показатели',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [INDEX_PERMISSIONS.VIEW_STATISTICS]
        },
        'weekly-chart': {
            title: 'Динамика задач',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [INDEX_PERMISSIONS.VIEW_STATISTICS]
        },
        'agent-ranking': {
            title: 'Топ агентов',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [INDEX_PERMISSIONS.VIEW_STATISTICS]
        },
        'project-progress': {
            title: 'Прогресс проекта',
            component: null,
            defaultSize: { w: 2, h: 1 },
            permissions: [INDEX_PERMISSIONS.VIEW_STATISTICS]
        }
    },
    
    onLoad: async () => {
        console.log('[index-module] Модуль дашборда загружен');
        
        // Инициализируем страницу
        try {
            const { initIndexPage } = await import('../../pages/index.js');
            if (typeof initIndexPage === 'function') {
                await initIndexPage();
                console.log('[index-module] Страница дашборда инициализирована');
            }
        } catch (error) {
            console.error('[index-module] Ошибка инициализации:', error);
        }
    },
    
    onUnload: async () => {
        console.log('[index-module] Модуль дашборда выгружен');
    }
};

// Делаем глобальным для доступа из других скриптов
window.indexModule = indexModule;

console.log('[index-module] Модуль готов к регистрации');
