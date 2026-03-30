/**
 * ============================================
 * ФАЙЛ: js/modules/tasks/index.js
 * РОЛЬ: Модуль задач - логика и компоненты
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Экспорт компонентов и виджетов
 *   - Определение прав доступа
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля задач
 * ============================================
 */

console.log('[tasks-module] Загрузка модуля задач...');

// Импортируем существующую логику (пока используем старую)
// Позже будем разбивать на компоненты
import { initTasksPage } from '../../pages/tasks.js';

// Определение модуля
export const tasksModule = {
    id: 'tasks',
    name: 'Задачи',
    version: '2.0.0',
    description: 'Управление задачами с Kanban-доской, комментариями и @упоминаниями',
    
    // Необходимые разрешения
    requiredPermissions: ['view_tasks'],
    
    // Доступные тарифы
    requiredPlans: ['free', 'pro', 'business'],
    
    // Страницы модуля
    pages: {
        'tasks-supabase.html': {
            title: 'Доска задач',
            icon: 'fa-tasks',
            init: initTasksPage,
            permissions: ['view_tasks']
        }
    },
    
    // Виджеты для дашборда
    widgets: {
        'tasks-summary': {
            title: 'Статистика задач',
            component: null, // TODO: создать компонент
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_tasks']
        },
        'my-tasks': {
            title: 'Мои задачи',
            component: null, // TODO: создать компонент
            defaultSize: { w: 2, h: 3 },
            permissions: ['view_tasks']
        },
        'overdue-tasks': {
            title: 'Просроченные задачи',
            component: null, // TODO: создать компонент
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_tasks']
        }
    },
    
    // Зависимости от других модулей
    dependencies: [],
    
    // Callback при загрузке модуля
    onLoad: async () => {
        console.log('[tasks-module] Модуль задач загружен');
        // Здесь можно предзагрузить данные или настроить события
    },
    
    // Callback при выгрузке модуля
    onUnload: async () => {
        console.log('[tasks-module] Модуль задач выгружен');
        // Очистка событий и данных
    }
};

// Автоматическая регистрация при загрузке
if (typeof window !== 'undefined' && window.CRM?.Registry) {
    window.CRM.Registry.registerModule(tasksModule);
    console.log('[tasks-module] Модуль зарегистрирован в реестре');
}

export default tasksModule;
