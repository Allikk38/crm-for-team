/**
 * ============================================
 * ФАЙЛ: js/modules/manager/index.js
 * РОЛЬ: Модуль панели менеджера - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - KPI показатели, нагрузка агентов, графики
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля панели менеджера
 * ============================================
 */

console.log('[manager-module] Загрузка модуля панели менеджера...');

// Права для модуля менеджера
const MANAGER_PERMISSIONS = {
    VIEW_MANAGER_PANEL: 'view_team_kpi',
    VIEW_TEAM_TASKS: 'view_team_tasks',
    VIEW_TEAM_DEALS: 'view_team_deals',
    MANAGE_TEAM: 'manage_team',
    ASSIGN_TASKS: 'assign_tasks'
};

// Определение модуля
const managerModule = {
    id: 'manager',
    name: 'Панель менеджера',
    version: '2.0.0',
    description: 'Аналитика работы команды: KPI, нагрузка агентов, просроченные задачи, графики активности',
    
    dependencies: ['tasks'],
    requiredPermissions: [MANAGER_PERMISSIONS.VIEW_MANAGER_PANEL],
    requiredPlans: ['pro', 'business', 'enterprise'],
    
    pages: {
        'manager-supabase.html': {
            title: 'Панель менеджера',
            icon: 'fa-chart-simple',
            permissions: [MANAGER_PERMISSIONS.VIEW_MANAGER_PANEL]
        }
    },
    
    widgets: {
        'manager-kpi': {
            title: 'KPI команды',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [MANAGER_PERMISSIONS.VIEW_MANAGER_PANEL]
        },
        'agent-load': {
            title: 'Нагрузка агентов',
            component: null,
            defaultSize: { w: 2, h: 3 },
            permissions: [MANAGER_PERMISSIONS.VIEW_MANAGER_PANEL]
        },
        'overdue-tasks-summary': {
            title: 'Просроченные задачи',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [MANAGER_PERMISSIONS.VIEW_MANAGER_PANEL]
        }
    },
    
    onLoad: async () => {
        console.log('[manager-module] Модуль панели менеджера загружен');
        
        // Проверяем права доступа
        const user = window.currentSupabaseUser;
        if (user?.role !== 'admin' && user?.role !== 'manager') {
            console.warn('[manager-module] Доступ запрещен: требуется роль менеджера или администратора');
            // Показываем сообщение на странице
            const main = document.querySelector('.main-content');
            if (main) {
                main.innerHTML = `
                    <div class="info-panel" style="text-align: center; padding: 60px;">
                        <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h2>Доступ ограничен</h2>
                        <p>Эта страница доступна только менеджерам и администраторам.</p>
                        <a href="index-supabase.html" class="nav-btn" style="margin-top: 20px; display: inline-block; padding: 10px 20px; background: var(--accent); border-radius: 40px; color: white; text-decoration: none;">Вернуться на главную</a>
                    </div>
                `;
            }
            return;
        }
        
        // Инициализируем страницу
        try {
            const { initManagerPage } = await import('../../pages/manager.js');
            if (typeof initManagerPage === 'function') {
                await initManagerPage();
                console.log('[manager-module] Страница панели менеджера инициализирована');
            }
        } catch (error) {
            console.error('[manager-module] Ошибка инициализации:', error);
        }
    },
    
    onUnload: async () => {
        console.log('[manager-module] Модуль панели менеджера выгружен');
    }
};

// Делаем глобальным для доступа из других скриптов
window.managerModule = managerModule;

console.log('[manager-module] Модуль готов к регистрации');
