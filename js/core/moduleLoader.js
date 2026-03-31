/**
 * ============================================
 * ФАЙЛ: js/core/moduleLoader.js
 * РОЛЬ: Универсальный загрузчик модулей для всех страниц
 * 
 * ОСОБЕННОСТИ:
 *   - Полностью на динамических импортах (import())
 *   - Автоматически определяет модуль по имени страницы
 *   - Регистрирует модули в Registry с полными метаданными
 *   - Инициализирует страницу через реестр модулей
 *   - Ждет загрузки пользователя перед проверкой прав
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Добавлена регистрация модулей с метаданными
 *   - 31.03.2026: Убран navigation из core модулей
 *   - 30.03.2026: Создание универсального загрузчика
 * ============================================
 */

console.log('[moduleLoader] Универсальный загрузчик модулей');

// ========== МЕТАДАННЫЕ МОДУЛЕЙ ==========

const MODULE_METADATA = {
    // Основные модули
    'dashboard': {
        name: 'Дашборд',
        icon: 'fa-home',
        category: 'essentials',
        order: 0,
        mainPage: '/app/dashboard.html',
        requiredPermissions: []
    },
    'tasks': {
        name: 'Задачи',
        icon: 'fa-tasks',
        category: 'business',
        order: 10,
        mainPage: '/app/tasks.html',
        requiredPermissions: ['view_tasks']
    },
    'calendar': {
        name: 'Календарь',
        icon: 'fa-calendar-alt',
        category: 'business',
        order: 20,
        mainPage: '/app/calendar.html',
        requiredPermissions: ['view_calendar']
    },
    'deals': {
        name: 'Сделки',
        icon: 'fa-handshake',
        category: 'business',
        order: 30,
        mainPage: '/app/deals.html',
        requiredPermissions: ['view_own_deals']
    },
    'complexes': {
        name: 'Объекты',
        icon: 'fa-building',
        category: 'business',
        order: 40,
        mainPage: '/app/complexes.html',
        requiredPermissions: ['view_complexes']
    },
    'counterparties': {
        name: 'Контрагенты',
        icon: 'fa-users',
        category: 'business',
        order: 50,
        mainPage: '/app/counterparties.html',
        requiredPermissions: ['view_counterparties']
    },
    
    // Личные модули
    'notes': {
        name: 'Заметки',
        icon: 'fa-sticky-note',
        category: 'personal',
        order: 100,
        mainPage: '/app/notes.html',
        requiredPermissions: ['view_notes']
    },
    'habits': {
        name: 'Привычки',
        icon: 'fa-calendar-check',
        category: 'personal',
        order: 110,
        mainPage: '/app/habits.html',
        requiredPermissions: []
    },
    'pomodoro': {
        name: 'Помодоро',
        icon: 'fa-clock',
        category: 'personal',
        order: 120,
        mainPage: '/app/pomodoro.html',
        requiredPermissions: []
    },
    'profile': {
        name: 'Профиль',
        icon: 'fa-user',
        category: 'personal',
        order: 130,
        mainPage: '/app/profile.html',
        requiredPermissions: ['view_profile']
    },
    'notifications': {
        name: 'Уведомления',
        icon: 'fa-bell',
        category: 'personal',
        order: 140,
        mainPage: '/app/notifications.html',
        requiredPermissions: []
    },
    
    // Командные модули
    'team': {
        name: 'Команда',
        icon: 'fa-users',
        category: 'tools',
        order: 200,
        mainPage: '/app/team.html',
        requiredPermissions: [],
        requiredRoles: ['admin', 'manager']
    },
    
    // Магазин
    'marketplace': {
        name: 'Маркетплейс',
        icon: 'fa-store',
        category: 'tools',
        order: 300,
        mainPage: '/app/marketplace.html',
        requiredPermissions: []
    },
    'my-modules': {
        name: 'Мои модули',
        icon: 'fa-puzzle-piece',
        category: 'tools',
        order: 310,
        mainPage: '/app/my-modules.html',
        requiredPermissions: []
    },
    
    // Администрирование
    'admin': {
        name: 'Управление',
        icon: 'fa-users-cog',
        category: 'admin',
        order: 400,
        mainPage: '/app/admin.html',
        requiredPermissions: ['manage_users'],
        requiredRoles: ['admin']
    },
    
    // Дополнительные модули (будут добавлены позже)
    'analytics': {
        name: 'Аналитика',
        icon: 'fa-chart-line',
        category: 'business',
        order: 60,
        mainPage: '/app/analytics.html',
        requiredPermissions: ['view_statistics']
    },
    'reports': {
        name: 'Отчеты',
        icon: 'fa-file-alt',
        category: 'business',
        order: 70,
        mainPage: '/app/reports.html',
        requiredPermissions: ['view_statistics']
    },
    'chat': {
        name: 'Чат',
        icon: 'fa-comments',
        category: 'tools',
        order: 210,
        mainPage: '/app/chat.html',
        requiredPermissions: []
    },
    'documents': {
        name: 'Документы',
        icon: 'fa-file-pdf',
        category: 'business',
        order: 80,
        mainPage: '/app/documents.html',
        requiredPermissions: []
    },
    'invoices': {
        name: 'Счета',
        icon: 'fa-file-invoice-dollar',
        category: 'business',
        order: 90,
        mainPage: '/app/invoices.html',
        requiredPermissions: []
    }
};

// ========== РЕГИСТРАЦИЯ МОДУЛЯ ==========

async function registerModuleWithMetadata(moduleId) {
    if (!window.CRM?.Registry) {
        console.warn(`[moduleLoader] Registry не загружен, пропускаем регистрацию ${moduleId}`);
        return false;
    }
    
    const metadata = MODULE_METADATA[moduleId];
    if (!metadata) {
        console.warn(`[moduleLoader] Нет метаданных для модуля ${moduleId}`);
        return false;
    }
    
    // Получаем права пользователя для проверки доступности
    const userRole = window.currentSupabaseUser?.role;
    const userPermissions = window.CRM.Permissions?.getUserPermissions() || [];
    const isAdmin = userRole === 'admin';
    
    // Проверяем доступность модуля
    let isAvailable = true;
    
    if (metadata.requiredRoles && metadata.requiredRoles.length > 0) {
        if (!isAdmin && !metadata.requiredRoles.includes(userRole)) {
            isAvailable = false;
        }
    }
    
    if (metadata.requiredPermissions && metadata.requiredPermissions.length > 0) {
        if (!isAdmin) {
            const hasPermission = metadata.requiredPermissions.some(p => userPermissions.includes(p));
            if (!hasPermission) {
                isAvailable = false;
            }
        }
    }
    
    // Регистрируем модуль
    const moduleDef = {
        id: moduleId,
        name: metadata.name,
        version: '1.0.0',
        icon: metadata.icon,
        category: metadata.category,
        order: metadata.order,
        mainPage: metadata.mainPage,
        pages: {
            [metadata.mainPage]: {
                title: metadata.name,
                permissions: metadata.requiredPermissions
            }
        },
        requiredPermissions: metadata.requiredPermissions || [],
        requiredRoles: metadata.requiredRoles || null,
        available: isAvailable,
        onLoad: async () => {
            console.log(`[moduleLoader] Модуль ${moduleId} загружен`);
            return true;
        }
    };
    
    const result = window.CRM.Registry.registerModule(moduleDef);
    
    if (result) {
        console.log(`[moduleLoader] ✅ Модуль ${moduleId} зарегистрирован (${metadata.name}, ${metadata.category})`);
    }
    
    return result;
}

// ========== ЗАГРУЗКА МОДУЛЕЙ ==========

async function loadAndRegisterModules() {
    console.log('[moduleLoader] Загрузка и регистрация модулей...');
    
    // Регистрируем все модули из метаданных
    const moduleIds = Object.keys(MODULE_METADATA);
    
    for (const moduleId of moduleIds) {
        await registerModuleWithMetadata(moduleId);
    }
    
    // Дополнительно загружаем модули из папки modules (если есть)
    const dynamicModules = ['tasks', 'deals', 'complexes', 'calendar', 'counterparties'];
    
    for (const moduleId of dynamicModules) {
        try {
            const module = await import(`../modules/${moduleId}/index.js`);
            const moduleVar = module.default || module[`${moduleId}Module`];
            if (moduleVar && window.CRM?.Registry) {
                // Обогащаем метаданными, если их нет
                if (!moduleVar.category) {
                    moduleVar.category = MODULE_METADATA[moduleId]?.category || 'other';
                    moduleVar.icon = MODULE_METADATA[moduleId]?.icon || 'fa-puzzle-piece';
                    moduleVar.order = MODULE_METADATA[moduleId]?.order || 500;
                }
                window.CRM.Registry.registerModule(moduleVar);
                console.log(`[moduleLoader] ✅ Модуль ${moduleId} зарегистрирован из папки modules`);
            }
        } catch (error) {
            // Модуль может не существовать в папке modules, это нормально
            console.debug(`[moduleLoader] Модуль ${moduleId} не найден в папке modules`);
        }
    }
    
    console.log('[moduleLoader] Регистрация модулей завершена');
}

// ========== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ==========

async function initPage(moduleId, pageName) {
    if (moduleId && MODULE_INIT[moduleId]) {
        try {
            // Пытаемся загрузить модуль через Registry
            if (window.CRM?.Registry) {
                await window.CRM.Registry.loadModule(moduleId);
            }
            
            // Вызываем инициализацию страницы
            await MODULE_INIT[moduleId]();
        } catch (error) {
            console.warn(`[moduleLoader] Ошибка загрузки модуля ${moduleId}:`, error);
            if (MODULE_INIT[moduleId]) {
                await MODULE_INIT[moduleId]();
            }
        }
    } else {
        const initName = pageName.replace('-supabase.html', '').replace('.html', '');
        if (MODULE_INIT[initName]) {
            await MODULE_INIT[initName]();
        } else {
            console.warn(`[moduleLoader] Нет инициализатора для ${pageName}`);
        }
    }
}

// ========== МАППИНГ СТРАНИЦ НА МОДУЛИ ==========

const PAGE_TO_MODULE = {
    'navigator.html': 'navigator',
    'dashboard.html': 'dashboard',
    'tasks.html': 'tasks',
    'deals.html': 'deals',
    'complexes.html': 'complexes',
    'calendar.html': 'calendar',
    'profile.html': 'profile',
    'admin.html': 'admin',
    'counterparties.html': 'counterparties',
    'notifications.html': 'notifications',
    'team.html': 'team',
    'marketplace.html': 'marketplace',
    'my-modules.html': 'my-modules',
    'notes.html': 'notes',
    'habits.html': 'habits',
    'pomodoro.html': 'pomodoro',
    // Старые названия для обратной совместимости
    'tasks-supabase.html': 'tasks',
    'deals-supabase.html': 'deals',
    'complexes-supabase.html': 'complexes',
    'calendar-supabase.html': 'calendar',
    'index-supabase.html': 'dashboard',
    'profile-supabase.html': 'profile',
    'manager-supabase.html': 'team',
    'admin-supabase.html': 'admin',
    'counterparties-supabase.html': 'counterparties',
    'notifications-supabase.html': 'notifications'
};

// ========== ФУНКЦИИ ИНИЦИАЛИЗАЦИИ СТРАНИЦ ==========

const MODULE_INIT = {
    'navigator': () => import('../pages/navigator.js').then(m => m.initNavigatorPage()),
    'dashboard': () => import('../pages/index.js').then(m => m.initIndexPage()),
    'tasks': () => import('../pages/tasks.js').then(m => m.initTasksPage()),
    'deals': () => import('../pages/deals.js').then(m => m.initDealsPage()),
    'complexes': () => import('../pages/complexes.js').then(m => m.initComplexesPage()),
    'calendar': () => import('../pages/calendar.js').then(m => m.initCalendarPage()),
    'profile': () => import('../pages/profile.js').then(m => m.initProfilePage()),
    'admin': () => import('../pages/admin.js').then(m => m.initAdminPage()),
    'counterparties': () => import('../pages/counterparties.js').then(m => m.initCounterpartiesPage()),
    'notifications': () => import('../pages/notifications.js').then(m => m.initNotificationsPage()),
    'team': () => import('../pages/team.js').then(m => m.initTeamPage()),
    'marketplace': () => import('../pages/marketplace.js').then(m => m.initMarketplacePage()),
    'my-modules': () => import('../pages/my-modules.js').then(m => m.initMyModulesPage()),
'notes': () => import('../pages/notes.js').then(m => m.initNotesPage()),
    'habits': () => import('../pages/habits.js').then(m => m.initHabitsPage()),
    'pomodoro': () => import('../pages/pomodoro.js').then(m => m.initPomodoroPage())
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename;
}

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

async function loadCoreModules() {
    const coreModules = [
        'supabase',
        'eventBus',
        'planManager',
        'permissions',
        'registry'
        // navigator не загружаем как core - он будет загружаться на странице
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

async function loadServices() {
    const services = [
        '../services/dashboards-supabase.js',
        '../services/license-supabase.js'
    ];
    
    for (const service of services) {
        try {
            await import(service);
            console.log(`[moduleLoader] ✅ Сервис ${service} загружен`);
        } catch (error) {
            console.error(`[moduleLoader] ❌ Ошибка загрузки ${service}:`, error);
        }
    }
}

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
    
    console.log('[moduleLoader] Виджеты загружены, доступно:', Object.keys(window.CRM.Widgets || {}).length);
}

async function loadComponents() {
    const components = [
        '../components/kanban.js',
        '../components/deal-card-list.js'
    ];
    
    for (const component of components) {
        try {
            await import(component);
            console.log(`[moduleLoader] ✅ Компонент ${component.split('/').pop()} загружен`);
        } catch (error) {
            console.warn(`[moduleLoader] ⚠️ Компонент ${component} не загружен:`, error);
        }
    }
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ==========

async function loadModule() {
    const pageName = getCurrentPage();
    const moduleId = PAGE_TO_MODULE[pageName];
    
    console.log(`[moduleLoader] Страница: ${pageName}, модуль: ${moduleId || 'нет модуля'}`);
    
    // Загружаем анимации
    try {
        await import('../ui/animations.js');
        console.log('[moduleLoader] ✅ animations загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки animations:', error);
    }
    
    // Загружаем helpers (необходим для других модулей)
    try {
        await import('../utils/helpers.js');
        console.log('[moduleLoader] ✅ helpers загружен');
    } catch (error) {
        console.error('[moduleLoader] ❌ Ошибка загрузки helpers:', error);
    }
    
    // Загружаем core модули
    await loadCoreModules();
    
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
    
    // Регистрируем модули
    await loadAndRegisterModules();
    
    // Загружаем сервисы
    await loadServices();
    
    // Загружаем компоненты
    await loadComponents();
    
    // Загружаем виджеты
    await loadWidgets();
    
    // Инициализируем страницу
    await initPage(moduleId, pageName);
    
    console.log(`[moduleLoader] ✅ Страница ${pageName} загружена`);
    
    // Отправляем событие о загрузке страницы
    if (window.CRM?.EventBus) {
        window.CRM.EventBus.emit('page:loaded', { page: pageName, module: moduleId });
    }
}

// Запускаем загрузку
loadModule().catch(err => {
    console.error('[moduleLoader] ❌ Ошибка загрузки страницы:', err);
});