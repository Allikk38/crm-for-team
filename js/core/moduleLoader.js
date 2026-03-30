/**
 * ============================================
 * ФАЙЛ: js/core/moduleLoader.js
 * РОЛЬ: Универсальный загрузчик модулей для всех страниц
 * 
 * ОСОБЕННОСТИ:
 *   - Полностью на динамических импортах (import())
 *   - Автоматически определяет модуль по имени страницы
 *   - Инициализирует страницу через реестр модулей
 *   - Ждет загрузки пользователя перед проверкой прав
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание универсального загрузчика
 *   - 30.03.2026: Переход на чистые динамические импорты
 * ============================================
 */

console.log('[moduleLoader] Универсальный загрузчик модулей (чистые импорты)');

// Маппинг страниц на модули
const PAGE_TO_MODULE = {
    'tasks-supabase.html': 'tasks',
    'deals-supabase.html': 'deals',
    'complexes-supabase.html': 'complexes',
    'calendar-supabase.html': 'calendar',
    'index-supabase.html': 'index',
    'profile-supabase.html': 'profile',
    'team-supabase.html': 'team',
    'admin-supabase.html': 'admin',
    'counterparties-supabase.html': 'counterparties',
    'notifications-supabase.html': 'notifications',
    'marketplace-supabase.html': 'marketplace',
    'my-modules-supabase.html': 'my-modules',
    'invite-supabase.html': 'invite'
};

// Маппинг модулей на функции инициализации
const MODULE_INIT = {
    'tasks': () => import('../pages/tasks.js').then(m => m.initTasksPage()),
    'deals': () => import('../pages/deals.js').then(m => m.initDealsPage()),
    'complexes': () => import('../pages/complexes.js').then(m => m.initComplexesPage()),
    'calendar': () => import('../pages/calendar.js').then(m => m.initCalendarPage()),
    'index': () => import('../pages/index.js').then(m => m.initIndexPage()),
    'profile': () => import('../pages/profile.js').then(m => m.initProfilePage()),
    'team': () => import('../pages/team.js').then(m => m.initTeamPage()),
    'admin': () => import('../pages/admin.js').then(m => m.initAdminPage()),
    'counterparties': () => import('../pages/counterparties.js').then(m => m.initCounterpartiesPage()),
    'notifications': () => import('../pages/notifications.js').then(m => m.initNotificationsPage()),
    'marketplace': () => import('../pages/marketplace.js').then(m => m.initMarketplacePage()),
    'my-modules': () => import('../pages/my-modules.js').then(m => m.initMyModulesPage()),
    'invite': () => import('../pages/invite.js').then(m => m.initInvitePage())
};

// Функция для получения имени текущей страницы
function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename;
}

// Функция для загрузки пользователя через импорт
async function loadUser() {
    try {
        const { checkSupabaseSession } = await import('./supabase-session.js');
        await checkSupabaseSession();
        console.log('[moduleLoader] Пользователь загружен:', window.currentSupabaseUser?.name);
        return true;
    } catch (error) {
        console.error('[moduleLoader] Ошибка загрузки пользователя:', error);
        return false;
    }
}

// Функция для загрузки сервисов
async function loadServices() {
    try {
        await import('../services/dashboards-supabase.js');
        console.log('[moduleLoader] ✅ Сервис dashboards-supabase загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки dashboards-supabase:', error);
    }
}

// Функция для загрузки core модулей
async function loadCore() {
    const coreModules = [
        'supabase',
        'eventBus',
        'planManager',
        'permissions',
        'registry'
    ];
    
    for (const module of coreModules) {
        try {
            await import(`./${module}.js`);
            console.log(`[moduleLoader] ✅ Core модуль ${module} загружен`);
        } catch (error) {
            console.error(`[moduleLoader] ❌ Ошибка загрузки core модуля ${module}:`, error);
        }
    }
}

// Функция для загрузки модулей
async function loadModules() {
    const modulesToLoad = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties', 'index'];
    
    for (const moduleId of modulesToLoad) {
        try {
            const module = await import(`../modules/${moduleId}/index.js`);
            const moduleVar = module.default || module[`${moduleId}Module`];
            if (moduleVar && window.CRM?.Registry) {
                window.CRM.Registry.registerModule(moduleVar);
                console.log(`[moduleLoader] ✅ Модуль ${moduleId} зарегистрирован`);
            }
        } catch (error) {
            console.warn(`[moduleLoader] ⚠️ Модуль ${moduleId} не загружен:`, error);
        }
    }
}

// Функция для загрузки виджетов
async function loadWidgets() {
    console.log('[moduleLoader] Загрузка виджетов...');
    
    if (typeof window !== 'undefined') {
        window.CRM = window.CRM || {};
        window.CRM.Widgets = window.CRM.Widgets || {};
    }
    
    const widgets = [
        { name: 'MyTasksWidget', path: '../components/widgets/my-tasks-widget.js' },
        { name: 'KpiSummaryWidget', path: '../components/widgets/kpi-summary-widget.js' },
        { name: 'ProjectProgressWidget', path: '../components/widgets/project-progress-widget.js' },
        { name: 'WelcomeWidget', path: '../components/widgets/welcome-widget.js' },
        { name: 'AgentRankingWidget', path: '../components/widgets/agent-ranking-widget.js' },
        { name: 'TeamAnalyticsWidget', path: '../components/widgets/team-analytics-widget.js' }
    ];
    
    for (const widget of widgets) {
        try {
            const module = await import(widget.path);
            window.CRM.Widgets[widget.name] = module.default;
            console.log(`[moduleLoader] ✅ Виджет ${widget.name} загружен`);
        } catch (error) {
            console.error(`[moduleLoader] ❌ Ошибка загрузки виджета ${widget.name}:`, error);
        }
    }
    
    console.log('[moduleLoader] Виджеты загружены, доступно:', Object.keys(window.CRM.Widgets || {}));
}

// Функция для инициализации страницы
async function initPage(moduleId, pageName) {
    if (moduleId && MODULE_INIT[moduleId]) {
        try {
            // Пытаемся загрузить через модуль
            const module = await import(`../modules/${moduleId}/index.js`);
            const moduleVar = module.default || module[`${moduleId}Module`];
            if (moduleVar && window.CRM?.Registry) {
                window.CRM.Registry.registerModule(moduleVar);
                await window.CRM.Registry.loadModule(moduleId);
            } else {
                await MODULE_INIT[moduleId]();
            }
        } catch (error) {
            console.warn(`[moduleLoader] Модуль ${moduleId} не найден, используем прямой импорт`);
            await MODULE_INIT[moduleId]();
        }
    } else {
        // Если нет модуля, инициализируем страницу напрямую
        const initName = pageName.replace('-supabase.html', '');
        if (MODULE_INIT[initName]) {
            await MODULE_INIT[initName]();
        }
    }
}

// Основная функция загрузки
async function loadModule() {
    const pageName = getCurrentPage();
    const moduleId = PAGE_TO_MODULE[pageName];
    
    console.log(`[moduleLoader] Страница: ${pageName}, модуль: ${moduleId || 'нет модуля'}`);
    
    // Загружаем базовые зависимости
    try {
        await import('../ui/animations.js');
        console.log('[moduleLoader] ✅ animations загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки animations:', error);
    }
    
    // Загружаем core модули
    await loadCore();
    
    // Ждем инициализации CRM
    let attempts = 0;
    while (!window.CRM && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    
    // Загружаем пользователя
    const userLoaded = await loadUser();
    if (!userLoaded) {
        console.error('[moduleLoader] Пользователь не загружен');
        return;
    }
    
    // Загружаем сервисы
    await loadServices();
    
    // Загружаем модули
    await loadModules();
    
    // Загружаем виджеты
    await loadWidgets();
    
    // Инициализируем страницу
    await initPage(moduleId, pageName);
    
    console.log(`[moduleLoader] ✅ Страница ${pageName} загружена`);
    
    // Отправляем событие о готовности
    if (window.CRM?.EventBus) {
        window.CRM.EventBus.emit('page:loaded', { page: pageName, module: moduleId });
    }
}

// Запускаем загрузчик
loadModule().catch(err => {
    console.error('[moduleLoader] ❌ Ошибка загрузки страницы:', err);
});