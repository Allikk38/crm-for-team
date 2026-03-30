/**
 * ============================================
 * ФАЙЛ: js/modules/complexes/index.js
 * РОЛЬ: Модуль объектов - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Интеграция с задачами через EventBus
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 *   - ./permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля объектов
 * ============================================
 */

console.log('[complexes-module] Загрузка модуля объектов...');

// Импортируем локальные права
import { COMPLEX_PERMISSIONS, canViewComplex, canEditComplex, canDeleteComplex } from './permissions.js';

// Определение модуля
const complexesModule = {
    id: 'complexes',
    name: 'Объекты',
    version: '2.0.0',
    description: 'Управление объектами недвижимости с карточками, фильтрацией и прогрессом задач',
    
    // Нет жестких зависимостей - модуль работает сам по себе
    dependencies: [],
    
    // Необходимые разрешения
    requiredPermissions: [COMPLEX_PERMISSIONS.VIEW_COMPLEXES],
    
    // Доступные тарифы
    requiredPlans: ['pro', 'business', 'enterprise'],
    
    // Страницы модуля
    pages: {
        'complexes-supabase.html': {
            title: 'Объекты',
            icon: 'fa-building',
            permissions: [COMPLEX_PERMISSIONS.VIEW_COMPLEXES]
        }
    },
    
    // Виджеты для дашборда
    widgets: {
        'complexes-summary': {
            title: 'Статистика объектов',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [COMPLEX_PERMISSIONS.VIEW_COMPLEXES]
        },
        'complexes-map': {
            title: 'Карта объектов',
            component: null,
            defaultSize: { w: 3, h: 3 },
            permissions: [COMPLEX_PERMISSIONS.VIEW_COMPLEXES]
        },
        'my-complexes': {
            title: 'Мои объекты',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [COMPLEX_PERMISSIONS.VIEW_COMPLEXES]
        }
    },
    
    // Опциональные расширения
    optionalExtensions: {
        'show-tasks-for-complex': {
            title: 'Задачи по объекту',
            requires: ['view_tasks']
        },
        'create-task-from-complex': {
            title: 'Создать задачу из объекта',
            requires: ['create_tasks']
        }
    },
    
    // Callback при загрузке модуля
    onLoad: async () => {
        console.log('[complexes-module] Модуль объектов загружен');
        
        // Проверяем, загружен ли Tasks модуль
        const tasksAvailable = window.CRM?.Registry?.isModuleAvailable('tasks');
        
        if (tasksAvailable) {
            console.log('[complexes-module] Модуль Tasks доступен, включаем расширенную функциональность');
            
            // Подписываемся на события от Tasks
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.on('task:created', (taskData) => {
                    if (taskData.complex_id) {
                        console.log('[complexes-module] Создана задача для объекта:', taskData.complex_id);
                        // Обновляем прогресс объекта
                        updateComplexProgress(taskData.complex_id);
                    }
                });
                
                window.CRM.EventBus.on('task:updated', (taskData) => {
                    if (taskData.complex_id) {
                        console.log('[complexes-module] Обновлена задача объекта:', taskData.complex_id);
                        updateComplexProgress(taskData.complex_id);
                    }
                });
            }
        } else {
            console.log('[complexes-module] Модуль Tasks не доступен, работаем в базовом режиме');
        }
        
        // Инициализируем страницу
        try {
            const { initComplexesPage } = await import('../../pages/complexes.js');
            if (typeof initComplexesPage === 'function') {
                await initComplexesPage();
                console.log('[complexes-module] Страница объектов инициализирована');
            }
        } catch (error) {
            console.error('[complexes-module] Ошибка инициализации:', error);
        }
    },
    
    // Callback при выгрузке модуля
    onUnload: async () => {
        console.log('[complexes-module] Модуль объектов выгружен');
    }
};

// Функция для обновления прогресса объекта
async function updateComplexProgress(complexId) {
    try {
        const { supabase } = window;
        if (!supabase) return;
        
        // Получаем задачи по объекту
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('complex_id', complexId);
        
        if (tasks && tasks.length > 0) {
            const completed = tasks.filter(t => t.status === 'completed').length;
            const percent = Math.round((completed / tasks.length) * 100);
            
            // Отправляем событие об обновлении прогресса
            if (window.CRM?.EventBus) {
                window.CRM.EventBus.emit('complex:progress-updated', {
                    complexId,
                    tasksCount: tasks.length,
                    completedCount: completed,
                    percent: percent
                });
            }
        }
    } catch (error) {
        console.error('[complexes-module] Ошибка обновления прогресса:', error);
    }
}

// Экспортируем также права для использования в других модулях
complexesModule.permissions = COMPLEX_PERMISSIONS;
complexesModule.canViewComplex = canViewComplex;
complexesModule.canEditComplex = canEditComplex;
complexesModule.canDeleteComplex = canDeleteComplex;

// Делаем глобальным для доступа из других скриптов
window.complexesModule = complexesModule;

console.log('[complexes-module] Модуль готов к регистрации');
