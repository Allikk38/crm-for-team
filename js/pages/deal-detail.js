/**
 * ============================================
 * ФАЙЛ: js/pages/deal-detail.js
 * РОЛЬ: Логика детального режима сделки
 * 
 * ОСОБЕННОСТИ:
 *   - Лестница этапов (горизонтальная/вертикальная)
 *   - Чек-листы для каждого этапа
 *   - Подсказки Спиры
 *   - История действий
 *   - Завершение этапа с проверкой чек-листа
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/deals-supabase.js
 *   - js/utils/helpers.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Создание файла
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import { getDealById, updateDeal, addDealLog } from '../services/deals-supabase.js';
import { escapeHtml, formatDate, showToast } from '../utils/helpers.js';

// Конфигурация этапов
const STAGE_LABELS = {
    'new': { name: 'Новая заявка', icon: '🆕', order: 1 },
    'selection': { name: 'Подбор', icon: '🔍', order: 2 },
    'matching': { name: 'Подбор', icon: '🤝', order: 2 },
    'showing': { name: 'Показ', icon: '👁️', order: 3 },
    'negotiation': { name: 'Торг', icon: '💬', order: 4 },
    'documents': { name: 'Документы', icon: '📄', order: 5 },
    'mortgage': { name: 'Ипотека', icon: '🏦', order: 6 },
    'booking': { name: 'Бронирование', icon: '📌', order: 4 },
    'registration': { name: 'Регистрация', icon: '📝', order: 7 },
    'deal': { name: 'Сделка', icon: '✍️', order: 7 },
    'keys': { name: 'Ключи', icon: '🔑', order: 8 },
    'utilities': { name: 'Коммуникации', icon: '🔌', order: 5 }
};

// Состояние страницы
let currentDeal = null;
let currentUser = null;
let currentStage = null;

/**
 * Получить порядок этапов для типа сделки
 */
function getStageOrder(deal) {
    if (!deal) return ['new', 'documents', 'deal'];
    
    const stageOrder = deal.stage_order?.[deal.type];
    if (stageOrder && Array.isArray(stageOrder)) {
        return stageOrder;
    }
    
    // Дефолтные порядки
    const defaults = {
        'new_building': ['new', 'selection', 'booking', 'documents', 'mortgage', 'registration', 'keys'],
        'secondary_buy': ['new', 'matching', 'showing', 'negotiation', 'documents', 'mortgage', 'deal', 'keys'],
        'secondary_sell': ['new', 'matching', 'documents', 'showing', 'negotiation', 'deal', 'keys'],
        'suburban': ['new', 'selection', 'utilities', 'documents', 'deal']
    };
    
    return defaults[deal.type] || ['new', 'selection', 'documents', 'deal'];
}

/**
 * Получить текущий активный этап (первый незавершенный)
 */
function getCurrentActiveStage(stages, stageOrder) {
    for (const stageName of stageOrder) {
        if (!stages[stageName]?.completed) {
            return stageName;
        }
    }
    return stageOrder[stageOrder.length - 1];
}

/**
 * Проверить, можно ли завершить этап (все чек-листы выполнены)
 */
function canCompleteStage(stageName, stages) {
    const stage = stages[stageName];
    if (!stage || stage.completed) return false;
    
    const checklist = stage.checklist || {};
    const allCompleted = Object.values(checklist).every(item => item.completed === true);
    
    return allCompleted;
}

/**
 * Получить подсказки Спиры для этапа
 */
function getSpiraTips(stageName, deal, stages) {
    const tips = [];
    
    switch (stageName) {
        case 'documents':
            const checklist = stages.documents?.checklist || {};
            const pendingDocs = Object.entries(checklist).filter(([_, item]) => !item.completed);
            if (pendingDocs.length > 0) {
                tips.push(`📋 Осталось собрать документов: ${pendingDocs.length}. Начни с самых важных.`);
            }
            
            const buyerIncome = checklist.buyer_income;
            if (buyerIncome && !buyerIncome.completed && deal.mortgage_approved) {
                tips.push(`⚠️ Для ипотеки нужна справка 2-НДФЛ. Напомни клиенту завтра утром.`);
            }
            break;
            
        case 'negotiation':
            if (deal.price_current < deal.price_initial * 0.9) {
                tips.push(`💰 Текущая цена ${deal.price_current?.toLocaleString()}₽ (${Math.round(deal.price_current / deal.price_initial * 100)}% от начальной). Хороший торг!`);
            } else if (deal.price_current === deal.price_initial) {
                tips.push(`💡 Цена не изменилась. Попробуй предложить скидку за быстрый выход на сделку.`);
            }
            break;
            
        case 'mortgage':
            if (!deal.bank) {
                tips.push(`🏦 Выбери банк для ипотеки. Сбербанк и ВТБ дают лучшие условия.`);
            }
            break;
            
        case 'deal':
            if (deal.deadline && new Date(deal.deadline) < new Date()) {
                tips.push(`⏰ Дедлайн сделки просрочен! Срочно свяжись с участниками.`);
            }
            break;
    }
    
    // Общие подсказки
    if (deal.deadline) {
        const deadline = new Date(deal.deadline);
        const daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 3 && daysLeft > 0) {
            tips.push(`⏰ До дедлайна осталось ${daysLeft} дня. Проверь все документы.`);
        }
    }
    
    if (tips.length === 0) {
        tips.push(`✨ Всё в порядке! Продолжай работать над сделкой.`);
    }
    
    return tips;
}

/**
 * Завершить этап
 */
async function completeStage(stageName) {
    if (!currentDeal) return;
    
    const stages = { ...currentDeal.stages };
    const stageOrder = getStageOrder(currentDeal);
    
    if (!canCompleteStage(stageName, stages)) {
        showToast('warning', '❌ Завершите все пункты чек-листа перед переходом на следующий этап');
        return;
    }
    
    // Завершаем текущий этап
    stages[stageName] = {
        ...stages[stageName],
        completed: true,
        completedAt: new Date().toISOString()
    };
    
    // Находим следующий этап
    const currentIndex = stageOrder.indexOf(stageName);
    const nextStage = stageOrder[currentIndex + 1];
    
    // Обновляем статус сделки (stage) на следующий этап
    const newStage = nextStage || stageName;
    
    try {
        const updated = await updateDeal(currentDeal.id, {
            stages: stages,
            stage: newStage
        });
        
        if (updated) {
            // Добавляем лог
            await addDealLog(currentDeal.id, 'stage_completed', {
                stage: stageName,
                next_stage: nextStage
            });
            
            currentDeal = updated;
            showToast('success', `✅ Этап "${STAGE_LABELS[stageName]?.name || stageName}" завершен!`);
            
            // Обновляем UI
            renderDealDetail();
        } else {
            showToast('error', 'Ошибка при завершении этапа');
        }
    } catch (error) {
        console.error('[deal-detail] Ошибка завершения этапа:', error);
        showToast('error', 'Ошибка при завершении этапа');
    }
}

/**
 * Обновить чек-лист
 */
async function updateChecklist(stageName, itemKey, completed) {
    if (!currentDeal) return;
    
    const stages = { ...currentDeal.stages };
    const stage = stages[stageName];
    
    if (!stage) return;
    
    stage.checklist = stage.checklist || {};
    stage.checklist[itemKey] = {
        ...stage.checklist[itemKey],
        completed: completed,
        completedAt: completed ? new Date().toISOString() : null
    };
    
    try {
        const updated = await updateDeal(currentDeal.id, { stages });
        
        if (updated) {
            currentDeal = updated;
            
            // Добавляем лог
            await addDealLog(currentDeal.id, 'checklist_updated', {
                stage: stageName,
                item: itemKey,
                completed: completed
            });
            
            // Обновляем кнопку завершения этапа
            const completeBtn = document.getElementById('completeStageBtn');
            if (completeBtn) {
                const canComplete = canCompleteStage(currentStage, currentDeal.stages);
                completeBtn.disabled = !canComplete;
            }
            
            // Показываем подсказку если чек-лист выполнен
            if (completed && canCompleteStage(stageName, stages)) {
                showToast('success', `🎉 Все пункты этапа "${STAGE_LABELS[stageName]?.name || stageName}" выполнены! Можно завершать этап.`);
            }
        }
    } catch (error) {
        console.error('[deal-detail] Ошибка обновления чек-листа:', error);
        showToast('error', 'Ошибка при обновлении');
    }
}

/**
 * Рендер хлебных крошек
 */
function renderBreadcrumb() {
    if (!currentDeal) return '';
    
    return `
        <div class="breadcrumb">
            <a href="/app/deals.html">← К списку сделок</a>
            <i class="fas fa-chevron-right"></i>
            <span>Сделка №${currentDeal.id}</span>
            <i class="fas fa-chevron-right"></i>
            <span>${escapeHtml(currentDeal.address || currentDeal.complex_name || 'Детали')}</span>
        </div>
    `;
}

/**
 * Рендер информационной карточки
 */
function renderInfoCard() {
    if (!currentDeal) return '';
    
    const typeLabel = STAGE_LABELS[currentDeal.type]?.name || currentDeal.type;
    const priceFormatted = (currentDeal.price_current || currentDeal.price_initial || 0).toLocaleString('ru-RU');
    const commissionFormatted = (currentDeal.commission_amount || 0).toLocaleString('ru-RU');
    const forecast = currentDeal.predicted_close ? formatDate(currentDeal.predicted_close, 'DD.MM.YYYY') : '—';
    
    return `
        <div class="deal-info-card">
            <div class="deal-info-header">
                <div class="deal-title">
                    <h1>${escapeHtml(currentDeal.address || currentDeal.complex_name || 'Сделка')}</h1>
                    <div class="deal-address">
                        <i class="fas fa-map-marker-alt"></i> 
                        ${escapeHtml(currentDeal.address || currentDeal.complex_name || 'Адрес не указан')}
                        ${currentDeal.apartment ? `, кв. ${escapeHtml(currentDeal.apartment)}` : ''}
                    </div>
                </div>
                <div class="deal-badges">
                    <span class="badge badge-type">${typeLabel}</span>
                    <span class="badge badge-status">${currentDeal.status === 'closed' ? '✅ Закрыта' : '🔄 В работе'}</span>
                </div>
            </div>
            
            <div class="deal-stats">
                <div class="stat-item">
                    <div class="stat-label">Сумма сделки</div>
                    <div class="stat-value">${priceFormatted} ₽</div>
                    <div class="stat-sub">${currentDeal.commission}% комиссия</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Комиссия</div>
                    <div class="stat-value">${commissionFormatted} ₽</div>
                    <div class="stat-sub">агентская</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Прогноз</div>
                    <div class="stat-value">${forecast}</div>
                    <div class="stat-sub">ожидаемая дата</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Ответственный</div>
                    <div class="stat-value">${escapeHtml(currentDeal.agent_name || currentDeal.agent_id || 'Не назначен')}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Рендер вертикальной навигации (десктоп)
 */
function renderVerticalStages() {
    const stageOrder = getStageOrder(currentDeal);
    const stages = currentDeal.stages || {};
    const currentActive = getCurrentActiveStage(stages, stageOrder);
    
    let html = '<div class="stages-vertical">';
    
    for (const stageName of stageOrder) {
        const stageInfo = STAGE_LABELS[stageName] || { name: stageName, icon: '📌' };
        const stage = stages[stageName];
        const isCompleted = stage?.completed === true;
        const isActive = stageName === currentActive;
        
        html += `
            <div class="stage-vertical-item ${isCompleted ? 'completed' : ''} ${isActive ? 'current active' : ''}" data-stage="${stageName}">
                <div class="stage-icon">${stageInfo.icon}</div>
                <div class="stage-info">
                    <div class="stage-name">${escapeHtml(stageInfo.name)}</div>
                    <div class="stage-status">${isCompleted ? '✅ Завершен' : (isActive ? '🔵 В работе' : '⚪ Ожидает')}</div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Рендер горизонтальной навигации (мобильные)
 */
function renderHorizontalStages() {
    const stageOrder = getStageOrder(currentDeal);
    const stages = currentDeal.stages || {};
    const currentActive = getCurrentActiveStage(stages, stageOrder);
    
    let html = '<div class="stages-horizontal">';
    
    for (const stageName of stageOrder) {
        const stageInfo = STAGE_LABELS[stageName] || { name: stageName, icon: '📌' };
        const stage = stages[stageName];
        const isCompleted = stage?.completed === true;
        const isActive = stageName === currentActive;
        
        html += `
            <div class="stage-horizontal-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}" data-stage="${stageName}">
                ${stageInfo.icon} ${escapeHtml(stageInfo.name)}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Рендер чек-листа для этапа
 */
function renderChecklist(stageName) {
    const stages = currentDeal.stages || {};
    const stage = stages[stageName];
    
    if (!stage || !stage.checklist || Object.keys(stage.checklist).length === 0) {
        return `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-check-circle" style="font-size: 2rem;"></i>
                <p>Для этого этапа нет обязательных пунктов</p>
            </div>
        `;
    }
    
    const checklist = stage.checklist;
    const total = Object.keys(checklist).length;
    const completed = Object.values(checklist).filter(item => item.completed === true).length;
    const percent = total > 0 ? (completed / total) * 100 : 0;
    
    // Группируем по типу (продавец/покупатель)
    const sellerItems = {};
    const buyerItems = {};
    const otherItems = {};
    
    for (const [key, item] of Object.entries(checklist)) {
        if (key.includes('seller')) {
            sellerItems[key] = item;
        } else if (key.includes('buyer')) {
            buyerItems[key] = item;
        } else {
            otherItems[key] = item;
        }
    }
    
    let html = `
        <div class="checklist-section">
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Выполнено: ${completed}/${total}</span>
                    <span>${Math.round(percent)}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${percent}%; background: var(--accent);"></div>
                </div>
            </div>
    `;
    
    // Рендер группы продавца
    if (Object.keys(sellerItems).length > 0) {
        html += renderChecklistGroup('ПРОДАВЕЦ', sellerItems);
    }
    
    // Рендер группы покупателя
    if (Object.keys(buyerItems).length > 0) {
        html += renderChecklistGroup('ПОКУПАТЕЛЬ', buyerItems);
    }
    
    // Рендер остальных
    if (Object.keys(otherItems).length > 0) {
        html += renderChecklistGroup('ДОПОЛНИТЕЛЬНО', otherItems);
    }
    
    html += '</div>';
    return html;
}

/**
 * Рендер группы чек-листа
 */
function renderChecklistGroup(title, items) {
    const isExpanded = localStorage.getItem(`checklist_${title}`) !== 'collapsed';
    
    let html = `
        <div class="checklist-header" data-group="checklist_${title}">
            <div class="checklist-title">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                <span>▸ ${escapeHtml(title)}</span>
                <span class="checklist-count">(${Object.values(items).filter(i => i.completed).length}/${Object.keys(items).length})</span>
            </div>
        </div>
        <div class="checklist-items" style="display: ${isExpanded ? 'block' : 'none'};">
    `;
    
    for (const [key, item] of Object.entries(items)) {
        const isCompleted = item.completed === true;
        const completedDate = item.completedAt ? formatDate(item.completedAt, 'DD.MM.YYYY') : '';
        
        html += `
            <div class="checklist-item ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" class="checklist-checkbox" data-stage="${currentStage}" data-item="${key}" ${isCompleted ? 'checked' : ''}>
                <div class="checklist-text">${escapeHtml(item.title || key)}</div>
                ${completedDate ? `<div class="checklist-date">✅ ${completedDate}</div>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Рендер подсказок Спиры
 */
function renderSpiraTips() {
    const tips = getSpiraTips(currentStage, currentDeal, currentDeal.stages || {});
    
    return `
        <div class="spira-tip">
            <div class="spira-icon">💡</div>
            <div class="spira-text">
                <strong>Спира советует:</strong><br>
                ${tips.map(tip => `• ${escapeHtml(tip)}`).join('<br>')}
            </div>
        </div>
    `;
}

/**
 * Рендер содержимого этапа
 */
function renderStageContent() {
    if (!currentStage) return '<div class="loading-state">Загрузка...</div>';
    
    const stageInfo = STAGE_LABELS[currentStage] || { name: currentStage, icon: '📌' };
    const stages = currentDeal.stages || {};
    const stage = stages[currentStage];
    const canComplete = canCompleteStage(currentStage, stages);
    const isCompleted = stage?.completed === true;
    
    return `
        <div class="stage-panel">
            <div class="stage-panel-header">
                <h2><i class="fas fa-layer-group"></i> ЭТАП: ${escapeHtml(stageInfo.name)}</h2>
                ${!isCompleted ? `
                    <button id="completeStageBtn" class="complete-stage-btn" ${!canComplete ? 'disabled' : ''}>
                        <i class="fas fa-check-circle"></i> Завершить этап
                    </button>
                ` : `
                    <div class="complete-stage-btn" style="background: #4caf50; cursor: default;">
                        <i class="fas fa-check"></i> Этап завершен
                    </div>
                `}
            </div>
            <div class="stage-panel-body">
                ${renderChecklist(currentStage)}
                ${renderSpiraTips()}
            </div>
        </div>
    `;
}

/**
 * Рендер истории действий
 */
function renderHistory(history) {
    if (!history || history.length === 0) {
        return `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                <i class="fas fa-history"></i>
                <p>История действий пуста</p>
            </div>
        `;
    }
    
    let html = '';
    for (const log of history) {
        let icon = 'fa-info-circle';
        let actionText = log.action;
        
        if (log.action === 'stage_completed') {
            icon = 'fa-check-circle';
            actionText = `Завершен этап "${log.data?.stage}" → "${log.data?.next_stage || 'завершение'}"`;
        } else if (log.action === 'checklist_updated') {
            icon = 'fa-list-check';
            actionText = `${log.data?.completed ? '✅ Выполнен' : '⬜ Отменен'} пункт "${log.data?.item}" в этапе "${log.data?.stage}"`;
        } else if (log.action === 'deal_created') {
            icon = 'fa-plus-circle';
            actionText = 'Сделка создана';
        }
        
        html += `
            <div class="history-item">
                <div class="history-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="history-detail">
                    <div class="history-action">${escapeHtml(actionText)}</div>
                    <div class="history-time">${formatDate(log.created_at, 'DD.MM.YYYY HH:MM')}</div>
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Загрузить историю сделки
 */
async function loadDealHistory(dealId) {
    try {
        const { data, error } = await supabase
            .from('deal_logs')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[deal-detail] Ошибка загрузки истории:', error);
        return [];
    }
}

/**
 * Основной рендер страницы
 */
async function renderDealDetail() {
    const container = document.getElementById('dealDetailContainer');
    if (!container) return;
    
    const stageOrder = getStageOrder(currentDeal);
    const stages = currentDeal.stages || {};
    currentStage = getCurrentActiveStage(stages, stageOrder);
    
    const history = await loadDealHistory(currentDeal.id);
    const isHistoryExpanded = localStorage.getItem('deal_history_expanded') !== 'collapsed';
    
    container.innerHTML = `
        ${renderBreadcrumb()}
        ${renderInfoCard()}
        
        <div class="deal-detail-main">
            <div class="stages-sidebar">
                ${renderVerticalStages()}
            </div>
            <div class="stage-content">
                ${renderHorizontalStages()}
                ${renderStageContent()}
                
                <div class="deal-history">
                    <div class="history-header" id="historyHeader">
                        <span><i class="fas fa-history"></i> История действий</span>
                        <i class="fas fa-chevron-${isHistoryExpanded ? 'down' : 'right'}"></i>
                    </div>
                    <div class="history-content" id="historyContent" style="display: ${isHistoryExpanded ? 'block' : 'none'};">
                        ${renderHistory(history)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем обработчики
    attachEventHandlers();
}

/**
 * Прикрепить обработчики событий
 */
function attachEventHandlers() {
    // Вертикальная навигация
    document.querySelectorAll('.stage-vertical-item').forEach(el => {
        el.addEventListener('click', () => {
            const stage = el.dataset.stage;
            if (stage) {
                currentStage = stage;
                renderDealDetail();
            }
        });
    });
    
    // Горизонтальная навигация
    document.querySelectorAll('.stage-horizontal-item').forEach(el => {
        el.addEventListener('click', () => {
            const stage = el.dataset.stage;
            if (stage) {
                currentStage = stage;
                renderDealDetail();
            }
        });
    });
    
    // Кнопка завершения этапа
    const completeBtn = document.getElementById('completeStageBtn');
    if (completeBtn && !completeBtn.disabled) {
        completeBtn.addEventListener('click', () => completeStage(currentStage));
    }
    
    // Чек-листы
    document.querySelectorAll('.checklist-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const stage = checkbox.dataset.stage;
            const item = checkbox.dataset.item;
            const completed = checkbox.checked;
            if (stage && item) {
                updateChecklist(stage, item, completed);
            }
        });
    });
    
    // Сворачивание групп чек-листа
    document.querySelectorAll('.checklist-header').forEach(header => {
        header.addEventListener('click', () => {
            const groupId = header.dataset.group;
            const content = header.parentElement?.querySelector('.checklist-items');
            const icon = header.querySelector('.fa-chevron-down, .fa-chevron-right');
            
            if (content) {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon?.classList.remove('fa-chevron-right');
                    icon?.classList.add('fa-chevron-down');
                    localStorage.setItem(groupId, 'expanded');
                } else {
                    content.style.display = 'none';
                    icon?.classList.remove('fa-chevron-down');
                    icon?.classList.add('fa-chevron-right');
                    localStorage.setItem(groupId, 'collapsed');
                }
            }
        });
    });
    
    // История
    const historyHeader = document.getElementById('historyHeader');
    if (historyHeader) {
        historyHeader.addEventListener('click', () => {
            const content = document.getElementById('historyContent');
            const icon = historyHeader.querySelector('.fa-chevron-down, .fa-chevron-right');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon?.classList.remove('fa-chevron-right');
                icon?.classList.add('fa-chevron-down');
                localStorage.setItem('deal_history_expanded', 'expanded');
            } else {
                content.style.display = 'none';
                icon?.classList.remove('fa-chevron-down');
                icon?.classList.add('fa-chevron-right');
                localStorage.setItem('deal_history_expanded', 'collapsed');
            }
        });
    }
    
    // Кнопка назад
    const backBtn = document.getElementById('backToListBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/app/deals.html';
        });
    }
}

/**
 * Инициализация страницы
 */
export async function initDealDetailPage(dealId) {
    console.log('[deal-detail] Инициализация страницы, ID:', dealId);
    
    currentUser = getCurrentSupabaseUser();
    
    // Загружаем данные сделки
    currentDeal = await getDealById(dealId);
    
    if (!currentDeal) {
        console.error('[deal-detail] Сделка не найдена');
        showToast('error', 'Сделка не найдена');
        setTimeout(() => {
            window.location.href = '/app/deals.html';
        }, 2000);
        return;
    }
    
    console.log('[deal-detail] Сделка загружена:', currentDeal);
    
    // Рендерим страницу
    await renderDealDetail();
    
    console.log('[deal-detail] Инициализация завершена');
}