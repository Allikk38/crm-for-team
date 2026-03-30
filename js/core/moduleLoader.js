/**
 * ============================================
 * ФАЙЛ: js/core/moduleLoader.js
 * РОЛЬ: Универсальный загрузчик модулей для всех страниц
 * 
 * ОСОБЕННОСТИ:
 *   - Автоматически определяет модуль по имени страницы
 *   - Загружает все необходимые зависимости
 *   - Инициализирует страницу через реестр модулей
 *   - Ждет загрузки пользователя перед проверкой прав
 *   - Загружает сервис дашбордов для главной страницы
 *   - Загружает виджеты для дашборда
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание универсального загрузчика
 *   - 30.03.2026: Исправлена загрузка модулей
 * ============================================
 */

console.log('[moduleLoader] Универсальный загрузчик модулей');

// Маппинг страниц на модули
const PAGE_TO_MODULE = {
    'tasks-supabase.html': 'tasks',
    'deals-supabase.html': 'deals',
    'complexes-supabase.html': 'complexes',
    'calendar-supabase.html': 'calendar',
    'index-supabase.html': 'index',
    'profile-supabase.html': 'profile',
    'manager-supabase.html': 'manager',
    'admin-supabase.html': 'admin',
    'counterparties-supabase.html': 'counterparties',
    'notifications-supabase.html': 'notifications',
    'dashboard-builder-supabase.html': 'dashboard-builder'
};

// Маппинг модулей на функции инициализации
const MODULE_INIT = {
    'tasks': () => import('../pages/tasks.js').then(m => m.initTasksPage()),
    'deals': () => import('../pages/deals.js').then(m => m.initDealsPage()),
    'complexes': () => import('../pages/complexes.js').then(m => m.initComplexesPage()),
    'calendar': () => import('../pages/calendar.js').then(m => m.initCalendarPage()),
    'index': () => import('../pages/index.js').then(m => m.initIndexPage()),
    'profile': () => import('../pages/profile.js').then(m => m.initProfilePage()),
    'manager': () => import('../pages/manager.js').then(m => m.initManagerPage()),
    'admin': () => import('../pages/admin.js').then(m => m.initAdminPage()),
    'counterparties': () => import('../pages/counterparties.js').then(m => m.initCounterpartiesPage()),
    'notifications': () => import('../pages/notifications.js').then(m => m.initNotificationsPage()),
    'dashboard-builder': () => import('../pages/dashboard-builder.js').then(m => m.initDashboardBuilder())
};

// Функция для получения имени текущей страницы
function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename;
}

// Функция для загрузки скрипта
function loadScript(src, isModule = false) {
    return new Promise((resolve, reject) => {
        // Проверяем, не загружен ли уже
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        if (isModule) script.type = 'module';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Функция для загрузки пользователя
async function loadUser() {
    // Загружаем supabase-session как модуль
    await loadScript('js/core/supabase-session.js', true);
    
    // Импортируем и вызываем checkSupabaseSession
    try {
        const { checkSupabaseSession } = await import('./supabase-session.js');
        await checkSupabaseSession();
        console.log('[moduleLoader] Пользователь загружен:', window.currentSupabaseUser?.name);
    } catch (error) {
        console.error('[moduleLoader] Ошибка загрузки пользователя:', error);
    }
}

// Функция для загрузки сервисов
async function loadServices() {
    const services = [
        'js/services/dashboards-supabase.js'
    ];
    
    for (const service of services) {
        await loadScript(service, true);
        console.log(`[moduleLoader] Сервис загружен: ${service}`);
    }
}

// Функция для загрузки модулей
async function loadModuleFiles() {
    const modulesToLoad = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties'];
    
    for (const moduleId of modulesToLoad) {
        const moduleScript = `js/modules/${moduleId}/index.js`;
        try {
            await loadScript(moduleScript);
            console.log(`[moduleLoader] Модуль ${moduleId} загружен`);
        } catch (error) {
            console.warn(`[moduleLoader] Модуль ${moduleId} не загружен:`, error);
        }
    }
}

// Функция для регистрации модулей
async function registerModules() {
    const modulesToRegister = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties'];
    
    for (const moduleId of modulesToRegister) {
        const moduleVar = window[`${moduleId}Module`];
        if (moduleVar && window.CRM?.Registry) {
            window.CRM.Registry.registerModule(moduleVar);
            console.log(`[moduleLoader] Модуль ${moduleId} зарегистрирован`);
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
    
    try {
        const { default: MyTasksWidget } = await import('../components/widgets/my-tasks-widget.js');
        window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
        console.log('[moduleLoader] ✅ Виджет MyTasksWidget загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки MyTasksWidget:', error);
    }
    
    try {
        const { default: KpiSummaryWidget } = await import('../components/widgets/kpi-summary-widget.js');
        window.CRM.Widgets.KpiSummaryWidget = KpiSummaryWidget;
        console.log('[moduleLoader] ✅ Виджет KpiSummaryWidget загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки KpiSummaryWidget:', error);
    }
    
    try {
        const { default: ProjectProgressWidget } = await import('../components/widgets/project-progress-widget.js');
        window.CRM.Widgets.ProjectProgressWidget = ProjectProgressWidget;
        console.log('[moduleLoader] ✅ Виджет ProjectProgressWidget загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки ProjectProgressWidget:', error);
    }
    
    try {
        const { default: WelcomeWidget } = await import('../components/widgets/welcome-widget.js');
        window.CRM.Widgets.WelcomeWidget = WelcomeWidget;
        console.log('[moduleLoader] ✅ Виджет WelcomeWidget загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки WelcomeWidget:', error);
    }
    
    console.log('[moduleLoader] Виджеты загружены, доступно:', Object.keys(window.CRM.Widgets || {}));
}

// Основная функция загрузки
async function loadModule() {
    const pageName = getCurrentPage();
    const moduleId = PAGE_TO_MODULE[pageName];
    
    console.log(`[moduleLoader] Страница: ${pageName}, модуль: ${moduleId || 'нет модуля'}`);
    
    // Загружаем базовые зависимости (не модули)
    const baseScripts = [
        'js/ui/animations.js'
    ];
    
    for (const script of baseScripts) {
        await loadScript(script);
    }
    
    // Загружаем core зависимости как модули
    const coreScripts = [
        'js/core/supabase.js',
        'js/core/eventBus.js',
        'js/core/planManager.js',
        'js/core/permissions.js',
        'js/core/registry.js'
    ];
    
    for (const script of coreScripts) {
        await loadScript(script, true);
    }
    
    // Ждем инициализации CRM
    let attempts = 0;
    while (!window.CRM && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    
    // Загружаем пользователя
    await loadUser();
    
    // Загружаем сервисы
    await loadServices();
    
    // Загружаем файлы модулей
    await loadModuleFiles();
    
    // Регистрируем модули
    await registerModules();
    
    // Загружаем виджеты
    await loadWidgets();
    
    // Если есть модуль для текущей страницы
    if (moduleId && MODULE_INIT[moduleId]) {
        // Загружаем модуль страницы
        const moduleScript = `js/modules/${moduleId}/index.js`;
        await loadScript(moduleScript);
        
        // Ждем регистрации
        attempts = 0;
        while (!window[`${moduleId}Module`] && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        
        const moduleVar = window[`${moduleId}Module`];
        if (moduleVar && window.CRM?.Registry) {
            window.CRM.Registry.registerModule(moduleVar);
            await window.CRM.Registry.loadModule(moduleId);
        } else {
            await MODULE_INIT[moduleId]();
        }
    } else {
        // Если нет модуля, инициализируем страницу напрямую
        const initName = pageName.replace('-supabase.html', '');
        if (MODULE_INIT[initName]) {
            await MODULE_INIT[initName]();
        }
    }
    
    console.log(`[moduleLoader] Страница ${pageName} загружена`);
    
    // Отправляем событие о готовности
    if (window.CRM?.EventBus) {
        window.CRM.EventBus.emit('page:loaded', { page: pageName, module: moduleId });
    }
}

// Запускаем загрузчик
loadModule().catch(err => {
    console.error('[moduleLoader] Ошибка загрузки страницы:', err);
});