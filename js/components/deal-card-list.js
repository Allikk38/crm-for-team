/**
 * ============================================
 * ФАЙЛ: js/components/deal-card-list.js
 * РОЛЬ: Карточка сделки для списочного режима
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение всех индикаторов сделки
 *   - Прогресс-бар прохождения этапов
 *   - Предупреждения (просрочки/задержки) с цветовой индикацией
 *   - Кнопка перехода в детальный режим
 *   - Адаптивный дизайн
 * 
 * ЗАВИСИМОСТИ:
 *   - js/utils/helpers.js (escapeHtml, formatDate)
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Создание компонента
 *   - 09.04.2026: Исправлен конфликт BASE_PATH (убрано дублирование)
 * ============================================
 */

import { escapeHtml, formatDate } from '../utils/helpers.js';

/**
 * Получить тип сделки с иконкой
 */
function getTypeIcon(type) {
    const types = {
        'primary': { icon: '🏗️', label: 'Новостройка', color: '#4caf50' },
        'secondary': { icon: '🏠', label: 'Вторичка', color: '#2196f3' },
        'exchange': { icon: '🔄', label: 'Альтернатива', color: '#ff9800' },
        'urgent': { icon: '⚡', label: 'Срочный выкуп', color: '#f44336' },
        'new_building': { icon: '🏗️', label: 'Новостройка', color: '#4caf50' },
        'secondary_buy': { icon: '🏠', label: 'Вторичка (покупка)', color: '#2196f3' },
        'secondary_sell': { icon: '🏠', label: 'Вторичка (продажа)', color: '#2196f3' },
        'suburban': { icon: '🏡', label: 'Загородка', color: '#ff9800' }
    };
    return types[type] || { icon: '📋', label: 'Другое', color: '#9e9e9e' };
}

/**
 * Рассчитать прогресс прохождения этапов
 */
function calculateProgress(stages, stageOrder) {
    if (!stages || !stageOrder || stageOrder.length === 0) {
        return { completed: 0, total: 0, percent: 0 };
    }
    
    let completed = 0;
    for (const stageName of stageOrder) {
        if (stages[stageName]?.completed === true) {
            completed++;
        } else {
            break;
        }
    }
    
    const total = stageOrder.length;
    const percent = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percent };
}

/**
 * Получить текущий этап текстом
 */
function getCurrentStageText(stages, stageOrder) {
    if (!stages || !stageOrder) return '—';
    
    for (const stageName of stageOrder) {
        if (stages[stageName]?.completed !== true) {
            return getStageLabel(stageName);
        }
    }
    return '✅ Все этапы завершены';
}

/**
 * Получить название этапа
 */
function getStageLabel(stageName) {
    const labels = {
        'new': '🆕 Новая заявка',
        'selection': '🔍 Подбор',
        'matching': '🤝 Подбор',
        'showing': '👁️ Показ',
        'negotiation': '💬 Торг',
        'documents': '📄 Документы',
        'mortgage': '🏦 Ипотека',
        'booking': '📌 Бронирование',
        'registration': '📝 Регистрация',
        'deal': '✍️ Сделка',
        'keys': '🔑 Ключи',
        'utilities': '🔌 Коммуникации'
    };
    return labels[stageName] || stageName;
}

/**
 * Получить предупреждения для сделки
 */
function getWarnings(deal) {
    const warnings = [];
    
    if (deal.deadline) {
        const deadline = new Date(deal.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadline < today) {
            warnings.push({
                type: 'danger',
                text: `⚠️ Дедлайн просрочен на ${Math.ceil((today - deadline) / (1000 * 60 * 60 * 24))} дн.`
            });
        } else if (deadline - today <= 3 * 24 * 60 * 60 * 1000) {
            warnings.push({
                type: 'warning',
                text: `⏰ Дедлайн через ${Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))} дн.`
            });
        }
    }
    
    if (deal.stages && deal.updated_at) {
        const lastUpdate = new Date(deal.updated_at);
        const daysSinceUpdate = Math.ceil((new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceUpdate > 7) {
            warnings.push({
                type: 'warning',
                text: `⏳ Нет активности ${daysSinceUpdate} дн.`
            });
        }
    }
    
    return warnings;
}

/**
 * Создать карточку сделки
 */
export function createDealCardList(deal, options = {}) {
    const {
        onOpen = null,
        stageOrder = null
    } = options;
    
    const card = document.createElement('div');
    card.className = 'deal-list-card';
    card.setAttribute('data-deal-id', deal.id);
    
    const effectiveStageOrder = stageOrder || deal.stage_order?.[deal.type] || 
        ['new', 'selection', 'documents', 'deal'];
    
    const progress = calculateProgress(deal.stages, effectiveStageOrder);
    const currentStageText = getCurrentStageText(deal.stages, effectiveStageOrder);
    const warnings = getWarnings(deal);
    const typeInfo = getTypeIcon(deal.type);
    
    const priceFormatted = (deal.price_current || deal.price_initial || 0).toLocaleString('ru-RU');
    const commissionFormatted = (deal.commission_amount || 0).toLocaleString('ru-RU');
    
    const progressColor = progress.percent === 100 ? '#4caf50' : 
                          progress.percent >= 66 ? '#2196f3' : 
                          progress.percent >= 33 ? '#ff9800' : '#9e9e9e';
    
    card.innerHTML = `
        <div class="deal-list-card-header">
            <div class="deal-list-card-type" style="background: ${typeInfo.color}20; color: ${typeInfo.color};">
                ${typeInfo.icon} ${typeInfo.label}
            </div>
            <div class="deal-list-card-number">
                Заявка №${deal.id.substring(0, 8)}
            </div>
        </div>
        
        <div class="deal-list-card-address">
            <i class="fas fa-location-dot"></i>
            ${escapeHtml(deal.address || deal.complex_name || 'Адрес не указан')}
            ${deal.apartment ? `, кв. ${escapeHtml(deal.apartment)}` : ''}
        </div>
        
        <div class="deal-list-card-agent">
            <i class="fas fa-user-tie"></i>
            ${escapeHtml(deal.agent_name || deal.agent_id || 'Не назначен')}
        </div>
        
        <div class="deal-list-card-price">
            <div class="deal-price">
                <span class="price-label">Сумма:</span>
                <span class="price-value">${priceFormatted} ₽</span>
            </div>
            <div class="deal-commission">
                <span class="commission-label">Комиссия:</span>
                <span class="commission-value">${commissionFormatted} ₽</span>
                <span class="commission-percent">(${deal.commission || 0}%)</span>
            </div>
        </div>
        
        <div class="deal-list-card-progress">
            <div class="progress-header">
                <span class="progress-label">Прогресс сделки</span>
                <span class="progress-value">${progress.completed}/${progress.total} этапов</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${progress.percent}%; background: ${progressColor};"></div>
            </div>
            <div class="current-stage">
                <span class="stage-label">Текущий этап:</span>
                <span class="stage-value">${escapeHtml(currentStageText)}</span>
            </div>
        </div>
        
        <div class="deal-list-card-warnings">
            ${warnings.map(warning => `
                <div class="warning-badge warning-${warning.type}">
                    ${escapeHtml(warning.text)}
                </div>
            `).join('')}
        </div>
        
        <div class="deal-list-card-footer">
            <button class="open-deal-btn" data-deal-id="${deal.id}">
                <i class="fas fa-arrow-right"></i> Открыть сделку
            </button>
        </div>
    `;
    
    const openBtn = card.querySelector('.open-deal-btn');
    if (openBtn && onOpen) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onOpen(deal.id);
        });
    }
    
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.open-deal-btn') && onOpen) {
            onOpen(deal.id);
        }
    });
    
    return card;
}

/**
 * Обновить существующую карточку
 */
export function updateDealCardList(card, deal, options = {}) {
    if (!card || !deal) return;
    const newCard = createDealCardList(deal, options);
    card.replaceWith(newCard);
    return newCard;
}

/**
 * Создать контейнер для группировки сделок
 */
export function createStageGroup(stageName, count = 0) {
    const group = document.createElement('div');
    group.className = 'stage-group';
    group.setAttribute('data-stage', stageName);
    
    const groupId = `group-${stageName}`;
    const isExpanded = localStorage.getItem(groupId) !== 'collapsed';
    
    group.innerHTML = `
        <div class="stage-group-header" data-group="${groupId}">
            <div class="stage-group-title">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} group-toggle-icon"></i>
                <span class="stage-name">${escapeHtml(getStageLabel(stageName))}</span>
                <span class="stage-count">${count}</span>
            </div>
        </div>
        <div class="stage-group-content" style="display: ${isExpanded ? 'block' : 'none'};">
        </div>
    `;
    
    const header = group.querySelector('.stage-group-header');
    const content = group.querySelector('.stage-group-content');
    const icon = group.querySelector('.group-toggle-icon');
    
    header.addEventListener('click', () => {
        const isCollapsed = content.style.display === 'none';
        if (isCollapsed) {
            content.style.display = 'block';
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
            localStorage.setItem(groupId, 'expanded');
        } else {
            content.style.display = 'none';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
            localStorage.setItem(groupId, 'collapsed');
        }
    });
    
    return group;
}

// Добавляем стили динамически
const style = document.createElement('style');
style.textContent = `
    .deal-list-card {
        background: var(--card-bg);
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--card-border);
        transition: all 0.2s ease;
        cursor: pointer;
    }
    
    .deal-list-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: var(--accent);
    }
    
    .deal-list-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
    }
    
    .deal-list-card-type {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 500;
    }
    
    .deal-list-card-number {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-family: monospace;
    }
    
    .deal-list-card-address {
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary);
        font-size: 1rem;
    }
    
    .deal-list-card-address i {
        margin-right: 8px;
        color: var(--accent);
    }
    
    .deal-list-card-agent {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 12px;
    }
    
    .deal-list-card-agent i {
        margin-right: 6px;
        width: 16px;
    }
    
    .deal-list-card-price {
        background: var(--input-bg);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 12px;
    }
    
    .deal-price, .deal-commission {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
    }
    
    .deal-price {
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--card-border);
    }
    
    .price-label, .commission-label {
        color: var(--text-muted);
    }
    
    .price-value, .commission-value {
        font-weight: 600;
        color: var(--accent);
    }
    
    .commission-percent {
        font-size: 0.7rem;
        color: var(--text-muted);
        margin-left: 4px;
    }
    
    .deal-list-card-progress {
        margin-bottom: 12px;
    }
    
    .progress-header {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        margin-bottom: 6px;
        color: var(--text-muted);
    }
    
    .progress-bar-container {
        background: var(--input-bg);
        border-radius: 10px;
        height: 6px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    
    .progress-bar-fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.3s ease;
    }
    
    .current-stage {
        font-size: 0.7rem;
        color: var(--text-muted);
        display: flex;
        gap: 8px;
    }
    
    .stage-value {
        color: var(--text-primary);
        font-weight: 500;
    }
    
    .deal-list-card-warnings {
        margin-bottom: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    
    .warning-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 500;
    }
    
    .warning-danger {
        background: rgba(244, 67, 54, 0.15);
        color: #f44336;
        border-left: 3px solid #f44336;
    }
    
    .warning-warning {
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
        border-left: 3px solid #ff9800;
    }
    
    .deal-list-card-footer {
        text-align: right;
    }
    
    .open-deal-btn {
        background: var(--accent);
        border: none;
        padding: 8px 16px;
        border-radius: 40px;
        color: white;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 500;
        transition: all 0.2s ease;
    }
    
    .open-deal-btn:hover {
        transform: translateX(4px);
        background: var(--accent-hover);
    }
    
    .stage-group {
        margin-bottom: 20px;
        border: 1px solid var(--card-border);
        border-radius: 16px;
        overflow: hidden;
    }
    
    .stage-group-header {
        background: var(--input-bg);
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    
    .stage-group-header:hover {
        background: var(--hover-bg);
    }
    
    .stage-group-title {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .group-toggle-icon {
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    
    .stage-name {
        font-weight: 600;
        font-size: 1rem;
    }
    
    .stage-count {
        background: var(--accent);
        color: white;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 500;
    }
    
    .stage-group-content {
        padding: 16px;
    }
    
    @media (max-width: 768px) {
        .deal-list-card-header {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .stage-group-title {
            flex-wrap: wrap;
        }
    }
`;

if (!document.querySelector('style[data-deal-card-list]')) {
    style.setAttribute('data-deal-card-list', 'true');
    document.head.appendChild(style);
}

console.log('[deal-card-list.js] Компонент загружен');
