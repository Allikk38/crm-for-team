/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/index.js (обновленный)
 * РОЛЬ: Модуль задач - публикует события для других модулей
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Добавлена публикация событий через EventBus
 * ============================================
 */

console.log('[tasks-module] Загрузка модуля задач...');

const tasksModule = {
    id: 'tasks',
    name: 'Задачи',
    version: '2.0.0',
    description: 'Управление задачами с Kanban-доской',
    
    dependencies: [],
    requiredPermissions: ['view_tasks'],
    requiredPlans: ['free', 'pro', 'business'],
    
    pages: {
        'tasks-supabase.html': {
            title: 'Доска задач',
            icon: 'fa-tasks',
            permissions: ['view_tasks']
        }
    },
    
    widgets: {
        'tasks-summary': {
            title: 'Статистика задач',
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_tasks']
        },
        'my-tasks': {
            title: 'Мои задачи',
            defaultSize: { w: 2, h: 3 },
            permissions: ['view_tasks']
        }
    },
    
    onLoad: async () => {
        console.log('[tasks-module] Модуль задач загружен');
        
        // Регистрируем обработчики для межмодульного взаимодействия
        window.CRM.EventBus.on('tasks:getByDealId', async (request) => {
            // Возвращаем задачи, связанные со сделкой
            const tasks = await getTasksByDealId(request.dealId);
            window.CRM.EventBus.emit(`tasks:getByDealId:response`, tasks);
            return tasks;
        });
        
        window.CRM.EventBus.on('task:create-from-deal', async (data) => {
            // Создаем задачу из сделки
            console.log('[tasks-module] Создание задачи из сделки:', data);
            // Открываем модалку с предзаполненными данными
            openTaskModalFromDeal(data);
        });
        
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
        return allTasks.filter(task => task.deal_id === dealId);
    } catch (error) {
        console.error('[tasks-module] Ошибка получения задач по сделке:', error);
        return [];
    }
}

function openTaskModalFromDeal(dealData) {
    // Открываем модалку создания задачи
    console.log('[tasks-module] Открытие модалки задачи из сделки:', dealData);
    // TODO: реализовать открытие модалки с предзаполненными данными
}

window.tasksModule = tasksModule;
console.log('[tasks-module] Модуль готов к регистрации');
