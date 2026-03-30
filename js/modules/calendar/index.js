/**
 * ============================================
 * ФАЙЛ: js/modules/calendar/index.js
 * РОЛЬ: Модуль календаря - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Интеграция с задачами через EventBus
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля календаря
 * ============================================
 */

console.log('[calendar-module] Загрузка модуля календаря...');

// Права для модуля календаря
const CALENDAR_PERMISSIONS = {
    VIEW_CALENDAR: 'view_calendar',
    CREATE_EVENTS: 'create_events',
    EDIT_OWN_EVENTS: 'edit_own_events',
    EDIT_ALL_EVENTS: 'edit_all_events',
    DELETE_EVENTS: 'delete_events',
    VIEW_TASKS_IN_CALENDAR: 'view_tasks_in_calendar'
};

// Определение модуля
const calendarModule = {
    id: 'calendar',
    name: 'Календарь',
    version: '2.0.0',
    description: 'Календарь задач с drag-and-drop для изменения дедлайнов',
    
    // Нет жестких зависимостей
    dependencies: [],
    
    // Необходимые разрешения
    requiredPermissions: [CALENDAR_PERMISSIONS.VIEW_CALENDAR],
    
    // Доступные тарифы
    requiredPlans: ['free', 'pro', 'business', 'enterprise'],
    
    // Страницы модуля
    pages: {
        'calendar-supabase.html': {
            title: 'Календарь',
            icon: 'fa-calendar-alt',
            permissions: [CALENDAR_PERMISSIONS.VIEW_CALENDAR]
        }
    },
    
    // Виджеты для дашборда
    widgets: {
        'calendar-mini': {
            title: 'Мини-календарь',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [CALENDAR_PERMISSIONS.VIEW_CALENDAR]
        },
        'upcoming-tasks': {
            title: 'Предстоящие задачи',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [CALENDAR_PERMISSIONS.VIEW_CALENDAR]
        },
        'overdue-tasks': {
            title: 'Просроченные задачи',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [CALENDAR_PERMISSIONS.VIEW_CALENDAR]
        }
    },
    
    // Опциональные расширения
    optionalExtensions: {
        'sync-with-tasks': {
            title: 'Синхронизация с задачами',
            requires: ['view_tasks']
        },
        'calendar-export': {
            title: 'Экспорт календаря',
            requires: []
        }
    },
    
    // Callback при загрузке модуля
    onLoad: async () => {
        console.log('[calendar-module] Модуль календаря загружен');
        
        // Проверяем, загружен ли Tasks модуль
        const tasksAvailable = window.CRM?.Registry?.isModuleAvailable('tasks');
        
        if (tasksAvailable) {
            console.log('[calendar-module] Модуль Tasks доступен, включаем синхронизацию');
            
            // Подписываемся на события от Tasks
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.on('task:created', (taskData) => {
                    console.log('[calendar-module] Новая задача, обновляем календарь');
                    refreshCalendar();
                });
                
                window.CRM.EventBus.on('task:updated', (taskData) => {
                    console.log('[calendar-module] Обновлена задача, обновляем календарь');
                    refreshCalendar();
                });
                
                window.CRM.EventBus.on('task:deleted', (taskId) => {
                    console.log('[calendar-module] Удалена задача, обновляем календарь');
                    refreshCalendar();
                });
            }
        } else {
            console.log('[calendar-module] Модуль Tasks не доступен, работаем в базовом режиме');
        }
        
        // Инициализируем страницу
        try {
            const { initCalendarPage } = await import('../../pages/calendar.js');
            if (typeof initCalendarPage === 'function') {
                await initCalendarPage();
                console.log('[calendar-module] Страница календаря инициализирована');
            }
        } catch (error) {
            console.error('[calendar-module] Ошибка инициализации:', error);
        }
    },
    
    // Callback при выгрузке модуля
    onUnload: async () => {
        console.log('[calendar-module] Модуль календаря выгружен');
    }
};

// Функция для обновления календаря
async function refreshCalendar() {
    try {
        // Отправляем событие на обновление календаря
        if (window.CRM?.EventBus) {
            window.CRM.EventBus.emit('calendar:refresh', {
                timestamp: new Date().toISOString()
            });
        }
        
        // Если на странице есть функция перерисовки, вызываем её
        if (typeof window.renderCalendar === 'function') {
            window.renderCalendar();
        } else if (typeof window.renderCalendarFromPage === 'function') {
            window.renderCalendarFromPage();
        }
    } catch (error) {
        console.error('[calendar-module] Ошибка обновления календаря:', error);
    }
}

// Делаем глобальным для доступа из других скриптов
window.calendarModule = calendarModule;

console.log('[calendar-module] Модуль готов к регистрации');
