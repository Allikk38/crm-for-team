/**
 * ============================================
 * ФАЙЛ: js/components/kanban.js
 * РОЛЬ: Универсальный компонент для рендеринга канбан-досок
 * 
 * ОСОБЕННОСТИ:
 *   - Создание карточек задач и сделок
 *   - Drag-and-drop для изменения статуса
 *   - Чистые экспорты для модульной архитектуры
 * 
 * ЗАВИСИМОСТИ:
 *   - js/utils/helpers.js (escapeHtml, formatDate)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Переход на чистые импорты/экспорты
 * ============================================
 */

import { escapeHtml, formatDate } from '../utils/helpers.js';

console.log('[kanban.js] Загрузка компонента...');

/**
 * Создание карточки для задачи
 * @param {Object} task - Данные задачи
 * @param {Object} options - Опции { showDelete, onDelete }
 */
export function createTaskCard(task, options = {}) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-task-id', task.id);
    card.draggable = true;
    card.setAttribute('draggable', 'true');
    
    card.ondragstart = function(e) {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
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
    const dueDate = task.due_date ? formatDate(task.due_date, 'DD.MM.YYYY') : 'без срока';
    
    const priorityTexts = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const priorityText = priorityTexts[task.priority] || 'Средний';
    
    let deleteButtonHtml = '';
    if (options.showDelete !== false) {
        deleteButtonHtml = `<button class="delete-task" data-id="${task.id}"><i class="fas fa-trash"></i></button>`;
    }
    
    card.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}${privateBadge}</div>
        <div class="task-description">${escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}">${priorityText}</span>
            <span class="task-assignee"><i class="fas fa-user"></i> ${escapeHtml(task.assigned_to || 'Не назначен')}</span>
        </div>
        <div class="task-meta">
            <span><i class="fas fa-calendar"></i> ${dueDate}</span>
            ${deleteButtonHtml}
        </div>
    `;
    
    return card;
}

/**
 * Создание карточки для сделки
 * @param {Object} deal - Данные сделки
 * @param {Object} options - Опции { canEdit }
 */
export function createDealCard(deal, options = {}) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.setAttribute('data-deal-id', deal.id);
    
    const canEdit = options.canEdit === true;
    
    // Включаем стандартный drag-and-drop
    card.draggable = canEdit;
    card.setAttribute('draggable', canEdit ? 'true' : 'false');
    
    if (canEdit) {
        card.ondragstart = function(e) {
            card.classList.add('dragging');
            card.classList.add('drag-ghost');
            e.dataTransfer.setData('text/plain', deal.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(new Image(), 0, 0);
            return true;
        };
        
        card.ondragend = function() {
            card.classList.remove('dragging');
            card.classList.remove('drag-ghost');
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
            <span class="deal-number">${escapeHtml(deal.complex_name || '—')}</span>
        </div>
        <div class="deal-participants">
            <span>S: ${escapeHtml(deal.seller_name || '—')}</span>
            <span>→</span>
            <span>B: ${escapeHtml(deal.buyer_name || '—')}</span>
        </div>
        <div class="deal-price">
            <span class="deal-type type-secondary">${typeText}</span>
            <span>${priceFormatted} RUB</span>
        </div>
        <div class="deal-meta">
            <span><i class="fas fa-user-tie"></i> ${escapeHtml(deal.agent_id || '—')}</span>
            <span><i class="fas fa-calendar"></i> ${deal.deadline ? formatDate(deal.deadline, 'DD.MM.YYYY') : '—'}</span>
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
export function setupDragAndDrop(containerSelector, onDrop) {
    const containers = document.querySelectorAll(containerSelector);
    console.log(`[kanban.js] Настройка drag-and-drop для ${containers.length} контейнеров`);
    
    containers.forEach(container => {
        function handleDragOver(e) {
            e.preventDefault();
            container.classList.add('drag-over');
            container.classList.add('drag-over-pulse');
            
            // Эффект для пустого контейнера
            const emptyDiv = container.querySelector('.empty-deals');
            if (emptyDiv) {
                emptyDiv.style.transform = 'translateY(-4px)';
                const icon = emptyDiv.querySelector('i');
                if (icon) icon.style.animation = 'bounceIcon 0.4s ease infinite';
            }
        }
        
        function handleDragLeave() {
            container.classList.remove('drag-over');
            container.classList.remove('drag-over-pulse');
            
            // Сбрасываем эффект для пустого контейнера
            const emptyDiv = container.querySelector('.empty-deals');
            if (emptyDiv) {
                emptyDiv.style.transform = '';
                const icon = emptyDiv.querySelector('i');
                if (icon) icon.style.animation = '';
            }
        }
        
        async function handleDrop(e) {
            e.preventDefault();
            container.classList.remove('drag-over');
            container.classList.remove('drag-over-pulse');
            
            // Сбрасываем эффект для пустого контейнера
            const emptyDiv = container.querySelector('.empty-deals');
            if (emptyDiv) {
                emptyDiv.style.transform = '';
                const icon = emptyDiv.querySelector('i');
                if (icon) icon.style.animation = '';
            }
            
            const dealId = e.dataTransfer.getData('text/plain');
            const newStatus = container.getAttribute('data-status');
            
            if (dealId && newStatus && onDrop) {
                console.log(`[kanban.js] Drop: deal ${dealId} → ${newStatus}`);
                
                // Находим карточку и добавляем анимацию
                const card = document.querySelector(`[data-deal-id="${dealId}"]`);
                if (card) {
                    card.classList.add('status-updating');
                }
                
                try {
                    await onDrop(dealId, newStatus);
                    
                    // Анимация успеха
                    if (card) {
                        card.classList.remove('status-updating');
                        card.classList.add('status-success');
                        card.classList.add('card-dropped');
                        setTimeout(() => {
                            card.classList.remove('status-success');
                            card.classList.remove('card-dropped');
                        }, 400);
                    }
                } catch (error) {
                    console.error('[kanban.js] Ошибка при drop:', error);
                    
                    // Анимация ошибки
                    if (card) {
                        card.classList.remove('status-updating');
                        card.classList.add('status-error');
                        setTimeout(() => card.classList.remove('status-error'), 300);
                    }
                }
            }
        }
        
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
        
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
    });
}

// Для обратной совместимости регистрируем в глобальный объект
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Kanban = {
        createTaskCard,
        createDealCard,
        setupDragAndDrop
    };
}

console.log('[kanban.js] ✅ Компонент загружен');