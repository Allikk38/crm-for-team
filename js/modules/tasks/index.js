/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/index.js
 * РОЛЬ: Модуль задач - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Публикация событий для других модулей
 *   - Опциональная интеграция с Deals
 *   - Виджеты для конструктора дашборда
 * 
 * ЗАВИСИМОСТИ:
 *   - js/components/widgets/my-tasks-widget.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля задач
 *   - 30.03.2026: Добавлена публикация событий через EventBus
 *   - 30.03.2026: Добавлены виджеты для дашборда
 * ============================================
 */

console.log('[tasks-module] Загрузка модуля задач...');

// Определение прав для задач
const TASK_PERMISSIONS = {
    VIEW_TASKS: 'view_tasks',
    CREATE_TASKS: 'create_tasks',
    EDIT_OWN_TASKS: 'edit_own_tasks',
    EDIT_ANY_TASK: 'edit_any_task',
    DELETE_OWN_TASKS: 'delete_own_tasks',
    DELETE_ANY_TASK: 'delete_any_task',
    ASSIGN_TASKS: 'assign_tasks',
    ADD_COMMENTS: 'add_comments'
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
    
    // Виджеты для конструктора дашборда
    widgets: {
        'my-tasks': {
            title: 'Мои задачи',
            description: 'Показывает ваши текущие задачи с возможностью быстрого завершения',
            component: 'MyTasksWidget',
            defaultSize: { w: 2, h: 3 },
            minSize: { w: 1, h: 2 },
            maxSize: { w: 4, h: 6 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS],
            settings: {
                limit: 10,
                showCompleted: false,
                statusFilter: 'pending,in_progress'
            }
        },
        'tasks-summary': {
            title: 'Сводка по задачам',
            description: 'KPI показатели: активные, завершенные, просроченные',
            component: 'TasksSummaryWidget',
            defaultSize: { w: 1, h: 1 },
            minSize: { w: 1, h: 1 },
            maxSize: { w: 2, h: 2 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS],
            settings: {}
        },
        'overdue-tasks': {
            title: 'Просроченные задачи',
            description: 'Список задач с истекшим сроком выполнения',
            component: 'OverdueTasksWidget',
            defaultSize: { w: 2, h: 2 },
            minSize: { w: 1, h: 1 },
            maxSize: { w: 3, h: 4 },
            permissions: [TASK_PERMISSIONS.VIEW_TASKS],
            settings: {
                limit: 5
            }
        }
    },
    
    onLoad: async () => {
        console.log('[tasks-module] Модуль задач загружен');
        
        // Регистрируем виджеты в глобальном объекте
        if (window.CRM?.Widgets) {
            try {
                // Динамическая загрузка виджетов
                const { default: MyTasksWidget } = await import('../../components/widgets/my-tasks-widget.js');
                window.CRM.Widgets.MyTasksWidget = MyTasksWidget;
                console.log('[tasks-module] Виджет MyTasksWidget зарегистрирован');
                
                // TODO: Загрузить другие виджеты по мере создания
                // const { default: TasksSummaryWidget } = await import('../../components/widgets/tasks-summary-widget.js');
                // window.CRM.Widgets.TasksSummaryWidget = TasksSummaryWidget;
                
                // const { default: OverdueTasksWidget } = await import('../../components/widgets/overdue-tasks-widget.js');
                // window.CRM.Widgets.OverdueTasksWidget = OverdueTasksWidget;
            } catch (error) {
                console.error('[tasks-module] Ошибка загрузки виджетов:', error);
            }
        }
        
        // Регистрируем обработчики для межмодульного взаимодействия
        if (window.CRM?.EventBus) {
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
            
            // Публикуем событие о готовности модуля
            window.CRM.EventBus.emit('module:tasks:ready', {
                moduleId: 'tasks',
                widgets: Object.keys(tasksModule.widgets)
            });
        }
        
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
            console.error('[tasks-module] Ошибка инициализации страницы:', error);
        }
        
        console.log('[tasks-module] Модуль задач полностью загружен');
    },
    
    onUnload: async () => {
        console.log('[tasks-module] Модуль задач выгружен');
        
        // Очищаем обработчики событий
        if (window.CRM?.EventBus) {
            // TODO: Отписаться от событий при необходимости
        }
        
        // Очищаем виджеты
        if (window.CRM?.Widgets) {
            delete window.CRM.Widgets.MyTasksWidget;
            // delete window.CRM.Widgets.TasksSummaryWidget;
            // delete window.CRM.Widgets.OverdueTasksWidget;
        }
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
    } else {
        // Временное решение - показать уведомление
        if (window.showToast) {
            window.showToast('info', `Создание задачи по сделке: ${dealData.dealName || dealData.dealId}`);
        }
    }
}

function enhanceTasksWithDeals() {
    console.log('[tasks-module] Включение интеграции с Deals');
    // Здесь можно добавить специфичную логику
    // Например, показывать сделки в карточке задачи
    // Или добавлять кнопку "Создать задачу из сделки"
}

// Экспортируем права
tasksModule.permissions = TASK_PERMISSIONS;

// Делаем глобальным для доступа из других скриптов
window.tasksModule = tasksModule;

console.log('[tasks-module] Модуль готов к регистрации');
