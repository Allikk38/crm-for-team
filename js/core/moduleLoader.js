/**
 * ============================================
 * ФАЙЛ: js/core/moduleLoader.js
 * РОЛЬ: Универсальный загрузчик модулей для всех страниц
 * 
 * ОСОБЕННОСТИ:
 *   - Автоматически определяет модуль по имени страницы
 *   - Загружает все необходимые зависимости
 *   - Инициализирует страницу через реестр модулей
 *   - Работает с любой страницей без дублирования кода
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   В HTML странице достаточно:
 *   <script type="module" src="js/core/moduleLoader.js"></script>
 *   <script src="layout.js"></script>
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание универсального загрузчика
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
    'notifications-supabase.html': 'notifications'
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
    'notifications': () => import('../pages/notifications.js').then(m => m.initNotificationsPage())
};

// Функция для получения имени текущей страницы
function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename;
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
        await new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${script}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = script;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    
    // Если есть модуль, загружаем через реестр
    if (moduleId && MODULE_INIT[moduleId]) {
        // Загружаем core зависимости
        const coreScripts = [
            'js/core/supabase.js',
            'js/core/eventBus.js',
            'js/core/planManager.js',
            'js/core/permissions.js',
            'js/core/registry.js'
        ];
        
        for (const script of coreScripts) {
            await new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${script}"]`)) {
                    resolve();
                    return;
                }
                const s = document.createElement('script');
                s.src = script;
                if (script === 'js/core/supabase.js') {
                    s.type = 'module';
                }
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        
        // Загружаем модуль
        const moduleScript = `js/modules/${moduleId}/index.js`;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = moduleScript;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
        
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
        if (MODULE_INIT[pageName.replace('-supabase.html', '')]) {
            const initName = pageName.replace('-supabase.html', '');
            await MODULE_INIT[initName]();
        } else {
            console.log(`[moduleLoader] Нет модуля для страницы ${pageName}`);
        }
    }
    
    console.log(`[moduleLoader] Страница ${pageName} загружена`);
}

// Запускаем загрузчик
loadModule().catch(err => {
    console.error('[moduleLoader] Ошибка загрузки страницы:', err);
});
