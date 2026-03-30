/**
 * ============================================
 * ФАЙЛ: js/modules/deals/index.js
 * РОЛЬ: Модуль сделок - с опциональной интеграцией с Tasks
 * 
 * ОСОБЕННОСТИ:
 *   - Не зависит от Tasks (нет в dependencies)
 *   - Использует EventBus для опционального взаимодействия
 *   - Если Tasks загружен - показываем дополнительные функции
 *   - Если Tasks не загружен - работаем в базовом режиме
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля с опциональной интеграцией
 * ============================================
 */

console.log('[deals-module] Загрузка модуля сделок...');

// Определение модуля
const dealsModule = {
    id: 'deals',
    name: 'Сделки',
    version: '2.0.0',
    description: 'Управление заявками и сделками',
    
    // Нет жестких зависимостей - модуль работает сам по себе
    dependencies: [],
    
    requiredPermissions: ['view_own_deals'],
    requiredPlans: ['pro', 'business'],
    
    pages: {
        'deals-supabase.html': {
            title: 'Сделки',
            icon: 'fa-handshake',
            permissions: ['view_own_deals']
        }
    },
    
    widgets: {
        'deals-summary': {
            title: 'Статистика сделок',
            defaultSize: { w: 2, h: 2 },
            permissions: ['view_own_deals']
        },
        'deals-pipeline': {
            title: 'Воронка сделок',
            defaultSize: { w: 3, h: 3 },
            permissions: ['view_own_deals']
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
    
    onLoad: async () => {
        console.log('[deals-module] Модуль сделок загружен');
        
        // Проверяем, загружен ли Tasks модуль
        const tasksAvailable = window.CRM.Registry.isModuleAvailable('tasks');
        
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
    
    onUnload: async () => {
        console.log('[deals-module] Модуль сделок выгружен');
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
                dealCard.querySelector('.deal-meta').appendChild(tasksBadge);
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

// Делаем глобальным
window.dealsModule = dealsModule;

console.log('[deals-module] Модуль готов к регистрации');
