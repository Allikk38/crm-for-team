/**
 * ============================================
 * ФАЙЛ: js/modules/deals/index.js
 * РОЛЬ: Модуль сделок (заявок) - логика и компоненты
 * 
 * ОСОБЕННОСТИ:
 *   - Kanban-доска с 6 статусами
 *   - Drag-and-drop для изменения статуса
 *   - Фильтрация по поиску, типу, агенту
 *   - Интеграция с объектами и контрагентами
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
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
    description: 'Управление сделками с Kanban-доской и фильтрацией',
    
    requiredPermissions: ['view_own_deals'],
    requiredPlans: ['pro', 'business'],
    
    pages: {
        'deals-supabase.html': {
            title: 'Сделки',
            icon: 'fa-handshake',
            permissions: ['view_own_deals']
        }
    },
    
    widgets: {
        'deals-summary': {
            title: 'Статистика сделок',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_own_deals']
        },
        'deals-pipeline': {
            title: 'Воронка продаж',
            component: null,
            defaultSize: { w: 3, h: 2 },
            permissions: ['view_team_deals']
        }
    },
    
    dependencies: [],
    
    onLoad: async () => {
        console.log('[deals-module] Модуль сделок загружен, инициализация...');
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
    
    onUnload: async () => {
        console.log('[deals-module] Модуль сделок выгружен');
    }
};

// Делаем глобальным
window.dealsModule = dealsModule;

console.log('[deals-module] Модуль готов к регистрации');
