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
 *   - 30.03.2026: Добавлена загрузка supabase-session
 *   - 30.03.2026: Добавлена загрузка сервиса дашбордов
 *   - 30.03.2026: Исправлен порядок загрузки зависимостей модулей
 *   - 30.03.2026: Добавлена загрузка виджетов для дашборда
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
        if (document.querySelector(`script[src="${src}"]`)) {
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
    const { checkSupabaseSession } = await import('./supabase-session.js');
    await checkSupabaseSession();
    
    console.log('[moduleLoader] Пользователь загружен:', window.currentSupabaseUser?.name);
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

// Функция для загрузки всех модулей (для зависимостей)
async function loadAllModules() {
    const modulesToLoad = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties'];
    
    for (const moduleId of modulesToLoad) {
        const moduleScript = `js/modules/${moduleId}/index.js`;
        try {
            await loadScript(moduleScript);
            console.log(`[moduleLoader] Модуль ${moduleId} загружен`);
        } catch (error) {
            console.warn(`[moduleLoader] Модуль ${moduleId} не найден или не загружен:`, error);
        }
    }
}

// Функция для регистрации всех модулей
async function registerAllModules() {
    const modulesToRegister = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties'];
    
    for (const moduleId of modulesToRegister) {
        const moduleVar = window[`${moduleId}Module`];
        if (moduleVar && window.CRM?.Registry) {
            window.CRM.Registry.registerModule(moduleVar);
            console.log(`[moduleLoader] Модуль ${moduleId} зарегистрирован в реестре`);
        }
    }
}

// Функция для загрузки виджетов (для дашборда)
async function loadWidgets() {
    console.log('[moduleLoader] Загрузка виджетов...');
    
    // Инициализируем глобальный объект для виджетов
    if (typeof window !== 'undefined') {
        window.CRM = window.CRM || {};
        window.CRM.Widgets = window.CRM.Widgets || {};
    }
    
    // Загружаем виджет MyTasksWidget
    try {
        const { default: MyTasksWidget } = await import('../components/widgets/my-tasks-widget.js');
        window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
        console.log('[moduleLoader] ✅ Виджет MyTasksWidget загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки MyTasksWidget:', error);
    }
    
    // TODO: Загрузить другие виджеты
    // try {
    //     const { default: TasksSummaryWidget } = await import('../components/widgets/tasks-summary-widget.js');
    //     window.CRM.Widgets.TasksSummaryWidget = TasksSummaryWidget;
    //     console.log('[moduleLoader] ✅ Виджет TasksSummaryWidget загружен');
    // } catch (error) {
    //     console.error('[moduleLoader] ❌ Ошибка загрузки TasksSummaryWidget:', error);
    // }
    
    console.log('[moduleLoader] Виджеты загружены, доступно:', Object.keys(window.CRM.Widgets));
}

// Основная функция загрузки
async function loadModule() {
    const pageName = getCurrentPage();
    const moduleId = PAGE_TO_MODULE[pageName];
    
    console.log(`[moduleLoader] Страница: ${pageName}, модуль: ${moduleId || 'нет модуля'}`);
    
    // Загружаем базовые зависимости
    const baseScripts = [
        'js/utils/helpers.js',
        'js/ui/animations.js'
    ];
    
    for (const script of baseScripts) {
        await loadScript(script);
    }
    
    // Загружаем core зависимости
    const coreScripts = [
        'js/core/supabase.js',
        'js/core/eventBus.js',
        'js/core/planManager.js',
        'js/core/permissions.js',
        'js/core/registry.js'
    ];
    
    for (const script of coreScripts) {
        const isModule = script === 'js/core/supabase.js';
        await loadScript(script, isModule);
    }
    
    // Загружаем пользователя
    await loadUser();
    
    // Загружаем сервисы
    await loadServices();
    
    // Загружаем ВСЕ модули для поддержки зависимостей
    await loadAllModules();
    
    // Регистрируем ВСЕ модули в реестре
    await registerAllModules();
    
    // Загружаем виджеты (особенно важно для дашборда)
    await loadWidgets();
    
    // Если есть модуль для текущей страницы
    if (moduleId && MODULE_INIT[moduleId]) {
        // Загружаем модуль страницы
        const moduleScript = `js/modules/${moduleId}/index.js`;
        await loadScript(moduleScript);
        
        // Ждем регистрации модуля в реестре
        let attempts = 0;
        const maxAttempts = 50;
        
        await new Promise((resolve) => {
            function checkModule() {
                attempts++;
                const moduleVar = window[`${moduleId}Module`];
                if (window.CRM?.Registry && moduleVar) {
                    console.log(`[moduleLoader] Модуль ${moduleId} загружен, регистрируем...`);
                    window.CRM.Registry.registerModule(moduleVar);
                    window.CRM.Registry.loadModule(moduleId).then(() => {
                        console.log(`[moduleLoader] Модуль ${moduleId} загружен через реестр`);
                        resolve();
                    }).catch((err) => {
                        console.error(`[moduleLoader] Ошибка загрузки модуля:`, err);
                        // Fallback
                        MODULE_INIT[moduleId]().then(resolve);
                    });
                } else if (attempts >= maxAttempts) {
                    console.warn(`[moduleLoader] Таймаут, используем fallback`);
                    MODULE_INIT[moduleId]().then(resolve);
                } else {
                    setTimeout(checkModule, 100);
                }
            }
            checkModule();
        });
    } else {
        // Если нет модуля, инициализируем страницу напрямую
        const initName = pageName.replace('-supabase.html', '');
        if (MODULE_INIT[initName]) {
            await MODULE_INIT[initName]();
        } else {
            console.log(`[moduleLoader] Нет модуля для страницы ${pageName}`);
        }
    }
    
    // После загрузки страницы, если это главная, инициализируем дашборд
    if (pageName === 'index-supabase.html' && window.CRM?.Dashboards) {
        try {
            const dashboard = await window.CRM.Dashboards.getActiveDashboard();
            if (dashboard) {
                console.log('[moduleLoader] Дашборд загружен:', dashboard.name);
                
                // Отправляем событие о загрузке дашборда
                if (window.CRM?.EventBus) {
                    window.CRM.EventBus.emit('dashboard:loaded', dashboard);
                }
                
                // Если есть виджеты, можно их отобразить
                if (window.CRM.Widgets && dashboard.layout?.widgets) {
                    console.log('[moduleLoader] Виджеты для отображения:', dashboard.layout.widgets.length);
                }
            }
        } catch (error) {
            console.error('[moduleLoader] Ошибка загрузки дашборда:', error);
        }
    }
    
    console.log(`[moduleLoader] Страница ${pageName} загружена`);
}

// Запускаем загрузчик
loadModule().catch(err => {
    console.error('[moduleLoader] Ошибка загрузки страницы:', err);
});
