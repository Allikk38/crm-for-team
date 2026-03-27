/**
 * ============================================
 * ФАЙЛ: js/components/kanban.js
 * РОЛЬ: Универсальный компонент для рендеринга канбан-досок
 * ЗАВИСИМОСТИ:
 *   - js/utils/helpers.js (escapeHtml, showToast)
 * ИСПОЛЬЗУЕТСЯ В:
 *   - tasks-supabase.html
 *   - deals-supabase.html
 * 
 * КОНФИГУРАЦИЯ:
 *   columns: [
 *     { id: 'pending', title: 'To Do', icon: 'fa-circle', color: '#9e9e9e' },
 *     { id: 'in_progress', title: 'В работе', icon: 'fa-spinner fa-pulse', color: '#2196f3' },
 *     { id: 'completed', title: 'Готово', icon: 'fa-check-circle', color: '#4caf50' }
 *   ]
 * ============================================
 */

window.CRM = window.CRM || {};
window.CRM.Kanban = window.CRM.Kanban || {};

/**
 * Рендеринг канбан-доски
 * @param {Object} config - Конфигурация
 * @param {Array} config.columns - Массив колонок
 * @param {Array} items - Элементы для отображения
 * @param {Function} renderItem - Функция рендеринга карточки
 * @param {Function} onStatusChange - Коллбэк при изменении статуса
 * @param {Object} options - Дополнительные опции
 */
function renderKanban(config, items, renderItem, onStatusChange, options = {}) {
    const container = document.getElementById(config.containerId || 'kanbanBoard');
    if (!container) return;

    // Группируем элементы по статусу
    const itemsByStatus = {};
    config.columns.forEach(col => {
        itemsByStatus[col.id] = [];
    });
    
    items.forEach(item => {
        const status = item.status || config.defaultStatus || config.columns[0].id;
        if (itemsByStatus[status]) {
            itemsByStatus[status].push(item);
        } else {
            itemsByStatus[config.columns[0].id].push(item);
        }
    });

    // Рендерим колонки
    let html = '';
    for (const column of config.columns) {
        const columnItems = itemsByStatus[column.id] || [];
        html += `
            <div class="kanban-column" data-status="${column.id}" style="border-top: 3px solid ${column.color};">
                <div class="column-header">
                    <span><i class="fas ${column.icon}"></i> ${column.title}</span>
                    <span class="count">${columnItems.length}</span>
                </div>
                <div class="tasks-container" data-status="${column.id}" id="container-${column.id}"></div>
                ${config.showAddButton !== false ? `
                <button class="add-task-btn" data-status="${column.id}">
                    <i class="fas fa-plus"></i> Добавить
                </button>
                ` : ''}
            </div>
        `;
    }
    container.innerHTML = html;

    // Заполняем контейнеры карточками
    for (const column of config.columns) {
        const columnContainer = document.getElementById(`container-${column.id}`);
        if (columnContainer) {
            const columnItems = itemsByStatus[column.id] || [];
            for (const item of columnItems) {
                const card = renderItem(item);
                columnContainer.appendChild(card);
            }
            
            if (columnItems.length === 0 && config.showEmptyMessage) {
                columnContainer.innerHTML = `<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет элементов</p></div>`;
            }
        }
    }

    // Настраиваем drag-and-drop
    setupDragAndDrop(config, onStatusChange);
}

/**
 * Настройка drag-and-drop
 */
function setupDragAndDrop(config, onStatusChange) {
    const containers = document.querySelectorAll('.tasks-container');
    
    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const itemId = e.dataTransfer.getData('text/plain');
            const newStatus = container.getAttribute('data-status');
            
            if (itemId && newStatus && onStatusChange) {
                await onStatusChange(itemId, newStatus);
            }
        });
    });
}

/**
 * Создание карточки для задачи (шаблон)
 */
function createTaskCard(task, options = {}) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-task-id', task.id);
    card.draggable = true;
    
    // Получаем цвета приоритета
    const priorityColors = {
        high: '#ff6b6b',
        medium: '#ffc107',
        low: '#4caf50'
    };
    card.style.borderLeftColor = priorityColors[task.priority] || '#ffc107';
    
    const privateBadge = task.is_private ? '<span class="private-badge"><i class="fas fa-lock"></i> Приватная</span>' : '';
    const dueDate = task.due_date ? window.formatDate(task.due_date, 'DD.MM.YYYY') : 'без срока';
    
    // Текст приоритета
    const priorityTexts = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const priorityText = priorityTexts[task.priority] || 'Средний';
    
    card.innerHTML = `
        <div class="task-title">${window.escapeHtml(task.title)}${privateBadge}</div>
        <div class="task-description">${window.escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}">${priorityText}</span>
            <span class="task-assignee"><i class="fas fa-user"></i> ${window.escapeHtml(task.assigned_to || 'Не назначен')}</span>
        </div>
        <div class="task-meta">
            <span><i class="fas fa-calendar"></i> ${dueDate}</span>
            ${options.showDelete !== false ? `
            <button class="delete-task" data-id="${task.id}">
                <i class="fas fa-trash"></i>
            </button>
            ` : ''}
        </div>
    `;
    
    // Обработчик drag-start
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });
    
    return card;
}

/**
 * Создание карточки для сделки (шаблон)
 */
function createDealCard(deal, options = {}) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.setAttribute('data-deal-id', deal.id);
    card.draggable = true;
    
    const typeLabels = {
        primary: '🏗️ Первичка',
        secondary: '🏠 Вторичка',
        exchange: '🔄 Альтернатива',
        urgent: '⚡ Срочный выкуп'
    };
    const typeText = typeLabels[deal.type] || 'Вторичка';
    
    const priceFormatted = (deal.price_current || deal.price_initial || 0).toLocaleString();
    
    card.innerHTML = `
        <div class="deal-title">
            <span>Заявка N${deal.id}</span>
            <span class="deal-number">${window.escapeHtml(deal.complex_name || '—')}</span>
        </div>
        <div class="deal-participants">
            <span>S: ${window.escapeHtml(deal.seller_name || '—')}</span>
            <span>→</span>
            <span>B: ${window.escapeHtml(deal.buyer_name || '—')}</span>
        </div>
        <div class="deal-price">
            <span class="deal-type type-secondary">${typeText}</span>
            <span>${priceFormatted} RUB</span>
        </div>
        <div class="deal-meta">
            <span><i class="fas fa-user-tie"></i> ${window.escapeHtml(deal.agent_id || '—')}</span>
            <span><i class="fas fa-calendar"></i> ${deal.deadline ? window.formatDate(deal.deadline, 'DD.MM.YYYY') : '—'}</span>
        </div>
    `;
    
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', deal.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });
    
    return card;
}

// Экспорт в глобальный объект
window.CRM.Kanban = {
    render: renderKanban,
    createTaskCard: createTaskCard,
    createDealCard: createDealCard,
    setupDragAndDrop: setupDragAndDrop
};

// Для обратной совместимости
window.renderKanban = renderKanban;

console.log('[kanban.js] Загружен компонент канбан-доски');
