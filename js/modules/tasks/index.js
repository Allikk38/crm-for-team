/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/index.js
 * РОЛЬ: Модуль задач - логика и компоненты
 * ============================================
 */

console.log('[tasks-module] Загрузка модуля задач...');

// Определение модуля
const tasksModule = {
    id: 'tasks',
    name: 'Задачи',
    version: '2.0.0',
    description: 'Управление задачами с Kanban-доской, комментариями и @упоминаниями',
    
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
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_tasks']
        },
        'my-tasks': {
            title: 'Мои задачи',
            component: null,
            defaultSize: { w: 2, h: 3 },
            permissions: ['view_tasks']
        }
    },
    
    dependencies: [],
    
    onLoad: async () => {
        console.log('[tasks-module] Модуль задач загружен, инициализация...');
        // Динамически импортируем и инициализируем страницу
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

// Делаем глобальным
window.tasksModule = tasksModule;

console.log('[tasks-module] Модуль готов к регистрации');
