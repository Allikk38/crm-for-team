/**
 * ============================================
 * ФАЙЛ: js/components/kanban.js
 * РОЛЬ: Универсальный компонент для рендеринга канбан-досок
 * ЗАВИСИМОСТИ:
 *   - js/utils/helpers.js (escapeHtml, showToast, formatDate)
 * ИСПОЛЬЗУЕТСЯ В:
 *   - tasks-supabase.html
 *   - deals-supabase.html
 * ============================================
 */

window.CRM = window.CRM || {};
window.CRM.Kanban = window.CRM.Kanban || {};

/**
 * Создание карточки для задачи (шаблон)
 * @param {Object} task - Данные задачи
 * @param {Object} options - Опции { showDelete, onDelete }
 */
function createTaskCard(task, options = {}) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-task-id', task.id);
    card.draggable = true;
    card.setAttribute('draggable', 'true');
    
    // Отключаем выделение текста при drag
    card.ondragstart = function(e) {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        // Убираем стандартную картинку перетаскивания
        e.dataTransfer.setDragImage(new Image(), 0, 0);
        return true;
    };
    
    card.ondragend = function() {
        card.classList.remove('dragging');
    };
    
    const priorityColors = {
        high: '#ff6b6b',
        medium: '#ffc107',
        low: '#4caf50'
    };
    card.style.borderLeftColor = priorityColors[task.priority] || '#ffc107';
    
    const privateBadge = task.is_private ? '<span class="private-badge"><i class="fas fa-lock"></i> Приватная</span>' : '';
    const dueDate = task.due_date ? window.formatDate(task.due_date, 'DD.MM.YYYY') : 'без срока';
    
    const priorityTexts = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const priorityText = priorityTexts[task.priority] || 'Средний';
    
    let deleteButtonHtml = '';
    if (options.showDelete !== false) {
        deleteButtonHtml = `<button class="delete-task" data-id="${task.id}"><i class="fas fa-trash"></i></button>`;
    }
    
    card.innerHTML = `
        <div class="task-title">${window.escapeHtml(task.title)}${privateBadge}</div>
        <div class="task-description">${window.escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}">${priorityText}</span>
            <span class="task-assignee"><i class="fas fa-user"></i> ${window.escapeHtml(task.assigned_to || 'Не назначен')}</span>
        </div>
        <div class="task-meta">
            <span><i class="fas fa-calendar"></i> ${dueDate}</span>
            ${deleteButtonHtml}
        </div>
    `;
    
    return card;
}

/**
 * Создание карточки для сделки (шаблон)
 * @param {Object} deal - Данные сделки
 * @param {Object} options - Опции { canEdit, onDelete }
 */
function createDealCard(deal, options = {}) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.setAttribute('data-deal-id', deal.id);
    
    const canEdit = options.canEdit === true;
    card.draggable = canEdit;
    card.setAttribute('draggable', canEdit ? 'true' : 'false');
    
    // Отключаем выделение текста при drag
    if (canEdit) {
        card.ondragstart = function(e) {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', deal.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(new Image(), 0, 0);
            return true;
        };
        
        card.ondragend = function() {
            card.classList.remove('dragging');
        };
    }
    
    const typeLabels = {
        primary: '🏗️ Первичка',
        secondary: '🏠 Вторичка',
        exchange: '🔄 Альтернатива',
        urgent: '⚡ Срочный выкуп'
    };
    const typeText = typeLabels[deal.type] || 'Вторичка';
    
    const priceFormatted = (deal.price_current || deal.price_initial || 0).toLocaleString();
    
    let deleteButtonHtml = '';
    if (canEdit) {
        deleteButtonHtml = `<button class="delete-deal" data-id="${deal.id}"><i class="fas fa-trash"></i> Удалить</button>`;
    }
    
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
        <div class="deal-meta" style="margin-top: 8px;">
            ${deleteButtonHtml}
        </div>
    `;
    
    return card;
}

/**
 * Настройка drag-and-drop для контейнеров
 * @param {string} containerSelector - Селектор контейнеров
 * @param {Function} onDrop - Коллбэк при drop (dealId, newStatus)
 */
function setupDragAndDrop(containerSelector, onDrop) {
    const containers = document.querySelectorAll(containerSelector);
    console.log(`[kanban.js] Настройка drag-and-drop для ${containers.length} контейнеров`);
    
    containers.forEach(container => {
        // НЕ клонируем контейнер! Просто добавляем обработчики
        
        function handleDragOver(e) {
            e.preventDefault();
            container.classList.add('drag-over');
        }
        
        function handleDragLeave() {
            container.classList.remove('drag-over');
        }
        
        async function handleDrop(e) {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const dealId = e.dataTransfer.getData('text/plain');
            const newStatus = container.getAttribute('data-status');
            
            if (dealId && newStatus && onDrop) {
                console.log(`[kanban.js] Drop: deal ${dealId} → ${newStatus}`);
                await onDrop(dealId, newStatus);
            }
        }
        
        // Удаляем старые обработчики, если есть
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
        
        // Добавляем новые
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
    });
}

// Экспорт в глобальный объект
window.CRM.Kanban = {
    createTaskCard: createTaskCard,
    createDealCard: createDealCard,
    setupDragAndDrop: setupDragAndDrop
};

console.log('[kanban.js] Загружен компонент канбан-доски');
