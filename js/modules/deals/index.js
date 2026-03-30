/**
 * ============================================
 * ФАЙЛ: js/modules/deals/index.js
 * РОЛЬ: Модуль сделок - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Инициализация Kanban-доски со сделками
 *   - Использует отдельный файл permissions.js для прав
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 *   - js/services/deals-supabase.js
 *   - ./permissions.js (локальный)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля сделок
 *   - 30.03.2026: Интеграция с локальным permissions.js
 * ============================================
 */

console.log('[deals-module] Загрузка модуля сделок...');

// Импортируем локальные права
import { DEAL_PERMISSIONS, canViewDeal, canEditDeal } from './permissions.js';

// Определение модуля
const dealsModule = {
    id: 'deals',
    name: 'Сделки',
    version: '2.0.0',
    description: 'Управление заявками и сделками с Kanban-доской на 6 статусов',
    
    // Нет жестких зависимостей - модуль работает сам по себе
    dependencies: [],
    
    // Необходимые разрешения (из локального файла)
    requiredPermissions: [DEAL_PERMISSIONS.VIEW_OWN_DEALS],
    
    // Доступные тарифы
    requiredPlans: ['pro', 'business', 'enterprise'],
    
    // Страницы модуля
    pages: {
        'deals-supabase.html': {
            title: 'Сделки',
            icon: 'fa-handshake',
            permissions: [DEAL_PERMISSIONS.VIEW_OWN_DEALS]
        }
    },
    
    // Виджеты для дашборда
    widgets: {
        'deals-summary': {
            title: 'Статистика сделок',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [DEAL_PERMISSIONS.VIEW_OWN_DEALS]
        },
        'deals-pipeline': {
            title: 'Воронка сделок',
            component: null,
            defaultSize: { w: 3, h: 3 },
            permissions: [DEAL_PERMISSIONS.VIEW_OWN_DEALS]
        },
        'overdue-deals': {
            title: 'Просроченные сделки',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [DEAL_PERMISSIONS.VIEW_OWN_DEALS]
        }
    },
    
    // Опциональные расширения (если Tasks загружен)
    optionalExtensions: {
        'show-tasks-for-deal': {
            title: 'Задачи по сделке',
            requires: ['view_tasks']
        },
        'create-task-from-deal': {
            title: 'Создать задачу из сделки',
            requires: ['create_tasks']
        }
    },
    
    // Callback при загрузке модуля
    onLoad: async () => {
        console.log('[deals-module] Модуль сделок загружен');
        
        // Проверяем, загружен ли Tasks модуль
        const tasksAvailable = window.CRM?.Registry?.isModuleAvailable('tasks');
        
        if (tasksAvailable) {
            console.log('[deals-module] Модуль Tasks доступен, включаем расширенную функциональность');
            
            // Подписываемся на события от Tasks
            window.CRM.EventBus.on('task:created', (taskData) => {
                console.log('[deals-module] Создана задача, связанная со сделкой:', taskData);
                // Обновляем UI если нужно
            });
            
            // Добавляем дополнительные кнопки и функции
            enhanceDealsWithTasks();
        } else {
            console.log('[deals-module] Модуль Tasks не доступен, работаем в базовом режиме');
        }
        
        // Инициализируем страницу
        try {
            const { initDealsPage } = await import('../../pages/deals.js');
            if (typeof initDealsPage === 'function') {
                await initDealsPage();
                console.log('[deals-module] Страница сделок инициализирована');
            }
        } catch (error) {
            console.error('[deals-module] Ошибка инициализации:', error);
        }
    },
    
    // Callback при выгрузке модуля
    onUnload: async () => {
        console.log('[deals-module] Модуль сделок выгружен');
        // Очистка событий и данных
    }
};

// Функция для расширения функциональности при наличии Tasks
function enhanceDealsWithTasks() {
    // Добавляем обработчики для отображения задач в карточке сделки
    window.CRM.EventBus.on('deal:card:render', (dealCard) => {
        const dealId = dealCard.dataset.dealId;
        
        // Проверяем, есть ли задачи у сделки
        window.CRM.EventBus.ask('tasks:getByDealId', { dealId }).then(tasks => {
            if (tasks && tasks.length > 0) {
                // Добавляем индикатор задач в карточку
                const tasksBadge = document.createElement('div');
                tasksBadge.className = 'tasks-badge';
                tasksBadge.innerHTML = `<i class="fas fa-tasks"></i> ${tasks.length}`;
                const metaDiv = dealCard.querySelector('.deal-meta');
                if (metaDiv) {
                    metaDiv.appendChild(tasksBadge);
                }
            }
        });
    });
    
    // Добавляем кнопку "Создать задачу" в модальное окно сделки
    window.CRM.EventBus.on('deal:modal:open', (modalData) => {
        const buttonsContainer = modalData.querySelector('.modal-buttons');
        if (buttonsContainer && !buttonsContainer.querySelector('.create-task-from-deal')) {
            const taskButton = document.createElement('button');
            taskButton.className = 'create-task-from-deal';
            taskButton.innerHTML = '<i class="fas fa-plus"></i> Создать задачу';
            taskButton.onclick = () => {
                window.CRM.EventBus.emit('task:create-from-deal', {
                    dealId: modalData.dataset.dealId,
                    dealName: modalData.dataset.dealName
                });
            };
            buttonsContainer.insertBefore(taskButton, buttonsContainer.firstChild);
        }
    });
}

// Экспортируем также права для использования в других модулях
dealsModule.permissions = DEAL_PERMISSIONS;
dealsModule.canViewDeal = canViewDeal;
dealsModule.canEditDeal = canEditDeal;

// Делаем глобальным для доступа из других скриптов
window.dealsModule = dealsModule;

console.log('[deals-module] Модуль готов к регистрации');
