/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/index.js
 * РОЛЬ: Модуль задач - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Публикация событий для других модулей
 *   - Опциональная интеграция с Deals
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля задач
 *   - 30.03.2026: Добавлена публикация событий через EventBus
 * ============================================
 */

console.log('[tasks-module] Загрузка модуля задач...');

// Определение прав для задач (можно вынести в отдельный файл)
const TASK_PERMISSIONS = {
    VIEW_TASKS: 'view_tasks',
    CREATE_TASKS: 'create_tasks',
    EDIT_OWN_TASKS: 'edit_own_tasks',
    EDIT_ANY_TASK: 'edit_any_task',
    DELETE_OWN_TASKS: 'delete_own_tasks',
    DELETE_ANY_TASK: 'delete_any_task',
    ASSIGN_TASKS: 'assign_tasks'
};

// Определение модуля
const tasksModule = {
    id: 'tasks',
    name: 'Задачи',
    version: '2.0.0',
    description: 'Управление задачами с Kanban-доской, комментариями и @упоминаниями',
    
    dependencies: [],
    requiredPermissions: [TASK_PERMISSIONS.VIEW_TASKS],
    requiredPlans: ['free', 'pro', 'business', 'enterprise'],
    
    pages: {
        'tasks-supabase.html': {
            title: 'Доска задач',
            icon: 'fa-tasks',
            permissions: [TASK_PERMISSIONS.VIEW_TASKS]
        }
    },
    
    widgets: {
        'tasks-summary': {
            title: 'Статистика задач',
            defaultSize: { w: 2, h: 2 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS]
        },
        'my-tasks': {
            title: 'Мои задачи',
            defaultSize: { w: 2, h: 3 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS]
        },
        'overdue-tasks': {
            title: 'Просроченные задачи',
            defaultSize: { w: 2, h: 2 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS]
        }
    },
    
    onLoad: async () => {
        console.log('[tasks-module] Модуль задач загружен');
        
        // Регистрируем обработчики для межмодульного взаимодействия
        window.CRM.EventBus.on('tasks:getByDealId', async (request) => {
            console.log('[tasks-module] Запрос задач по сделке:', request);
            const tasks = await getTasksByDealId(request.dealId);
            // Отправляем ответ
            window.CRM.EventBus.emit(`tasks:getByDealId:response`, tasks);
            return tasks;
        });
        
        window.CRM.EventBus.on('task:create-from-deal', async (data) => {
            console.log('[tasks-module] Создание задачи из сделки:', data);
            await openTaskModalFromDeal(data);
        });
        
        // Проверяем, доступен ли Deals модуль
        const dealsAvailable = window.CRM?.Registry?.isModuleAvailable('deals');
        if (dealsAvailable) {
            console.log('[tasks-module] Модуль Deals доступен, включаем интеграцию');
            enhanceTasksWithDeals();
        }
        
        // Инициализируем страницу
        try {
            const { initTasksPage } = await import('../../pages/tasks.js');
            if (typeof initTasksPage === 'function') {
                await initTasksPage();
                console.log('[tasks-module] Страница задач инициализирована');
            }
        } catch (error) {
            console.error('[tasks-module] Ошибка инициализации:', error);
        }
    },
    
    onUnload: async () => {
        console.log('[tasks-module] Модуль задач выгружен');
    }
};

// Вспомогательные функции
async function getTasksByDealId(dealId) {
    try {
        const { getTasks } = await import('../../services/tasks-supabase.js');
        const allTasks = await getTasks();
        // Предполагаем, что у задачи есть поле deal_id для связи со сделкой
        return allTasks.filter(task => task.deal_id === dealId);
    } catch (error) {
        console.error('[tasks-module] Ошибка получения задач по сделке:', error);
        return [];
    }
}

async function openTaskModalFromDeal(dealData) {
    console.log('[tasks-module] Открытие модалки задачи из сделки:', dealData);
    // TODO: открыть модалку с предзаполненными данными
    // Можно использовать глобальную функцию если доступна
    if (window.openTaskModal) {
        window.openTaskModal(null, {
            title: `Задача по сделке ${dealData.dealName || dealData.dealId}`,
            deal_id: dealData.dealId
        });
    }
}

function enhanceTasksWithDeals() {
    console.log('[tasks-module] Включение интеграции с Deals');
    // Здесь можно добавить специфичную логику
    // Например, показывать сделки в карточке задачи
}

// Экспортируем права
tasksModule.permissions = TASK_PERMISSIONS;

// Делаем глобальным
window.tasksModule = tasksModule;

console.log('[tasks-module] Модуль готов к регистрации');
