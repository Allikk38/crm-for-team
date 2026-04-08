/**
 * ============================================
 * ФАЙЛ: js/components/kanban.js
 * РОЛЬ: Универсальный компонент для рендеринга канбан-досок
 * 
 * ОСОБЕННОСТИ:
 *   - Создание карточек задач и сделок
 *   - Drag-and-drop для изменения статуса
 *   - Отображение категорий и важных задач
 * 
 * ЗАВИСИМОСТИ:
 *   - js/utils/helpers.js (escapeHtml, formatDate)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Переход на чистые импорты/экспорты
 *   - 08.04.2026: Добавлены категории и важное в карточки задач
 * ============================================
 */

import { escapeHtml, formatDate } from '../utils/helpers.js';
import { TASK_CATEGORIES } from '../services/tasks-supabase.js';

console.log('[kanban.js] Загрузка компонента...');

/**
 * Создание карточки для задачи
 * @param {Object} task - Данные задачи
 * @param {Object} options - Опции { showDelete, showEdit, onEdit, onDelete }
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
    
    // Цветовая индикация: важное = золотой, обычное = синий
    if (task.is_important) {
        card.style.borderLeftColor = '#fbbf24';
        card.style.borderLeftWidth = '4px';
        card.style.borderLeftStyle = 'solid';
    } else {
        card.style.borderLeftColor = '#3b82f6';
        card.style.borderLeftWidth = '4px';
        card.style.borderLeftStyle = 'solid';
    }
    
    // Категория
    const categoryInfo = TASK_CATEGORIES[task.category] || TASK_CATEGORIES.other;
    
    // Статус (только иконка Font Awesome)
    const statusIcons = {
        pending: '<i class="far fa-circle"></i>',
        in_progress: '<i class="fas fa-spinner fa-pulse"></i>',
        completed: '<i class="fas fa-check-circle"></i>'
    };
    const statusIcon = statusIcons[task.status] || statusIcons.pending;
    
    // Форматирование даты
    const dueDate = task.due_date ? formatDate(task.due_date, 'DD.MM.YYYY') : 'Без срока';
    
    // Просрочена ли задача
    const isOverdue = task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();
    const dueDateClass = isOverdue ? 'task-due-date overdue' : 'task-due-date';
    
    // Важное (звезда)
    const importantStar = task.is_important 
        ? '<i class="fas fa-star" style="color: #fbbf24; margin-left: 6px;" title="Важное"></i>' 
        : '';
    
    // Кнопки действий
    let actionsHtml = '<div class="task-actions">';
    
    if (options.showEdit !== false) {
        actionsHtml += `
            <button class="task-btn task-edit-btn" data-id="${task.id}" title="Редактировать">
                <i class="fas fa-pencil-alt"></i>
            </button>
        `;
    }
    
    if (options.showDelete !== false) {
        actionsHtml += `
            <button class="task-btn task-delete-btn" data-id="${task.id}" title="Удалить">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
    }
    
    actionsHtml += '</div>';
    
    // Карточка
    card.innerHTML = `
        <div class="task-header">
            <div class="task-status-icon">${statusIcon}</div>
            <div class="task-title-wrapper">
                <span class="task-title">${escapeHtml(task.title)}</span>
                ${importantStar}
            </div>
        </div>
        
        <div class="task-category">
            <i class="fas ${categoryInfo.icon}"></i>
            <span>${categoryInfo.label}</span>
        </div>
        
        ${task.description ? `
            <div class="task-description">
                ${escapeHtml(task.description.substring(0, 80))}
                ${task.description.length > 80 ? '...' : ''}
            </div>
        ` : ''}
        
        <div class="task-meta">
            <span class="${dueDateClass}">
                <i class="far fa-calendar-alt"></i> ${dueDate}
            </span>
        </div>
        
        ${actionsHtml}
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
        primary: 'Первичка',
        secondary: 'Вторичка',
        exchange: 'Альтернатива',
        urgent: 'Срочный выкуп'
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
 */
export function setupDragAndDrop(containerSelector, onDrop) {
    const containers = document.querySelectorAll(containerSelector);
    console.log(`[kanban.js] Настройка drag-and-drop для ${containers.length} контейнеров`);
    
    containers.forEach(container => {
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
                console.log(`[kanban.js] Drop: ${dealId} → ${newStatus}`);
                await onDrop(dealId, newStatus);
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

// Глобальный объект для обратной совместимости
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Kanban = {
        createTaskCard,
        createDealCard,
        setupDragAndDrop
    };
}

console.log('[kanban.js] Компонент загружен');
