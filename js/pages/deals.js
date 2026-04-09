/**
 * ============================================
 * ФАЙЛ: js/pages/deals.js
 * РОЛЬ: Логика страницы управления заявками (сделки)
 * 
 * ОСОБЕННОСТИ:
 *   - Двухрежимный интерфейс: Kanban и Список
 *   - Группировка по этапам в списочном режиме
 *   - Drag-and-drop для Kanban
 *   - Создание/редактирование сделок
 *   - Фильтрация по поиску, типу, агенту
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/deals-supabase.js
 *   - js/components/kanban.js
 *   - js/components/deal-card-list.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Добавлен двухрежимный интерфейс
 *   - 30.03.2026: Создание файла
 *   - 09.04.2026: Исправлен путь для открытия деталей сделки (GitHub Pages)
 *   - 09.04.2026: Переименован BASE_PATH для избежания конфликта
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { 
    getDeals, 
    createDeal, 
    updateDeal, 
    deleteDeal, 
    updateDealStatus,
    addDealLog
} from '../services/deals-supabase.js';
import { createDealCard, setupDragAndDrop } from '../components/kanban.js';
import { createDealCardList, createStageGroup, updateDealCardList } from '../components/deal-card-list.js';

// ========== ОПРЕДЕЛЕНИЕ БАЗОВОГО ПУТИ ДЛЯ GITHUB PAGES ==========
function getDealsBasePath() {
    const fullPath = window.location.pathname;
    
    // Проверяем, находимся ли мы в репозитории crm-for-team
    if (fullPath.includes('/crm-for-team/')) {
        return '/crm-for-team';
    }
    
    // Для локальной разработки
    return '';
}

const DEALS_BASE_PATH = getDealsBasePath();
console.log('[deals] BASE_PATH:', DEALS_BASE_PATH);

function getDealDetailUrl(dealId) {
    if (DEALS_BASE_PATH) {
        return `${DEALS_BASE_PATH}/app/deal-detail.html?id=${dealId}`;
    }
    return `./deal-detail.html?id=${dealId}`;
}

// Состояние страницы
let dealsData = [];
let complexesData = [];
let counterpartiesData = [];
let usersData = [];
let currentUser = null;
let currentMode = localStorage.getItem('deals_view_mode') || 'kanban';
let currentGrouping = localStorage.getItem('deals_grouping') || 'stage';

// Статусы сделок для Kanban
const DEAL_STATUSES = [
    { id: 'new', name: 'Новая', icon: '🆕', color: '#9e9e9e' },
    { id: 'selection', name: 'Подбор', icon: '🔍', color: '#2196f3' },
    { id: 'matching', name: 'Подбор', icon: '🤝', color: '#2196f3' },
    { id: 'showing', name: 'Показ', icon: '👁️', color: '#ffc107' },
    { id: 'negotiation', name: 'Торг', icon: '💬', color: '#ff9800' },
    { id: 'documents', name: 'Документы', icon: '📄', color: '#4caf50' },
    { id: 'mortgage', name: 'Ипотека', icon: '🏦', color: '#9c27b0' },
    { id: 'deal', name: 'Сделка', icon: '✍️', color: '#00bcd4' },
    { id: 'keys', name: 'Ключи', icon: '🔑', color: '#8bc34a' },
    { id: 'closed', name: 'Закрыта', icon: '✅', color: '#4caf50' },
    { id: 'cancelled', name: 'Отказ', icon: '❌', color: '#9e9e9e' }
];

// Названия этапов для группировки
const STAGE_NAMES = {
    'new': 'Новая заявка',
    'selection': 'Подбор',
    'matching': 'Подбор',
    'showing': 'Показ',
    'negotiation': 'Торг',
    'documents': 'Документы',
    'mortgage': 'Ипотека',
    'deal': 'Сделка',
    'keys': 'Ключи',
    'closed': 'Закрыта',
    'cancelled': 'Отказ'
};

console.log('[deals.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadComplexes() {
    const { data, error } = await supabase.from('complexes').select('*');
    if (!error && data) {
        complexesData = data;
        console.log('[deals] Загружено объектов:', complexesData.length);
    }
}

async function loadCounterparties() {
    const { data, error } = await supabase.from('counterparties').select('*');
    if (!error && data) {
        counterpartiesData = data;
        console.log('[deals] Загружено контрагентов:', counterpartiesData.length);
    }
}

async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
        usersData = data;
        updateAgentSelects();
        updateAgentFilter();
        console.log('[deals] Загружено пользователей:', usersData.length);
    }
}

async function loadDealsData() {
    dealsData = await getDeals();
    console.log(`[deals] Загружено ${dealsData.length} сделок`);
    renderCurrentView();
}

function getComplexName(complexId) {
    const complex = complexesData.find(c => c.id == complexId);
    return complex ? complex.name : '—';
}

function getCounterpartyName(id) {
    const cp = counterpartiesData.find(c => c.id == id);
    return cp ? cp.name : '—';
}

function getUserName(agentId) {
    const user = usersData.find(u => u.github_username === agentId);
    return user ? user.name : agentId || '—';
}

function updateComplexSelect() {
    const select = document.getElementById('dealComplex');
    if (!select) return;
    select.innerHTML = '<option value="">Выберите объект</option>';
    for (const c of complexesData) {
        select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.address || '')})</option>`;
    }
}

function updateCounterpartySelects() {
    const sellerSelect = document.getElementById('dealSeller');
    const buyerSelect = document.getElementById('dealBuyer');
    
    if (sellerSelect) {
        sellerSelect.innerHTML = '<option value="">Выберите продавца</option>';
        for (const c of counterpartiesData) {
            if (c.type === 'seller') {
                sellerSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
            }
        }
    }
    
    if (buyerSelect) {
        buyerSelect.innerHTML = '<option value="">Выберите покупателя</option>';
        for (const c of counterpartiesData) {
            if (c.type === 'buyer') {
                buyerSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
            }
        }
    }
}

function updateAgentSelects() {
    const agentSelect = document.getElementById('dealAgent');
    if (!agentSelect) return;
    agentSelect.innerHTML = '<option value="">Выберите агента</option>';
    for (const u of usersData) {
        if (u.role === 'agent' || u.role === 'manager') {
            agentSelect.innerHTML += `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`;
        }
    }
    if (currentUser) {
        agentSelect.value = currentUser.github_username;
    }
}

function updateAgentFilter() {
    const filterSelect = document.getElementById('agentFilter');
    if (!filterSelect) return;
    filterSelect.innerHTML = '<option value="all">Все агенты</option>';
    for (const u of usersData) {
        if (u.role === 'agent' || u.role === 'manager') {
            filterSelect.innerHTML += `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`;
        }
    }
}

// ========== ФИЛЬТРАЦИЯ ==========

function getFilteredDeals() {
    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const agentFilter = document.getElementById('agentFilter')?.value || 'all';
    
    return dealsData.filter(deal => {
        const matchSearch = searchText === '' ||
            deal.id.toString().includes(searchText) ||
            getComplexName(deal.complex_id).toLowerCase().includes(searchText) ||
            getCounterpartyName(deal.seller_id).toLowerCase().includes(searchText) ||
            getCounterpartyName(deal.buyer_id).toLowerCase().includes(searchText);
        const matchType = typeFilter === 'all' || deal.type === typeFilter;
        const matchAgent = agentFilter === 'all' || deal.agent_id?.toLowerCase() === agentFilter?.toLowerCase();
        return matchSearch && matchType && matchAgent;
    });
}

// ========== KANBAN РЕЖИМ ==========

async function handleUpdateDealStatus(dealId, newStatus) {
    console.log(`[deals] Изменение статуса: ${dealId} → ${newStatus}`);
    
    const deal = dealsData.find(d => d.id == dealId);
    if (!deal || deal.status === newStatus) return;
    
    const oldStatus = deal.status;
    deal.status = newStatus;
    
    try {
        const updated = await updateDealStatus(dealId, newStatus);
        if (updated) {
            await addDealLog(dealId, 'status_changed', { old_status: oldStatus, new_status: newStatus });
            showToast('success', `Статус изменён на "${DEAL_STATUSES.find(s => s.id === newStatus)?.name || newStatus}"`);
            renderKanban();
        } else {
            deal.status = oldStatus;
            showToast('error', 'Ошибка изменения статуса');
        }
    } catch (error) {
        deal.status = oldStatus;
        console.error('[deals] Ошибка обновления статуса:', error);
        showToast('error', 'Ошибка изменения статуса');
    }
}

function renderKanban() {
    const container = document.getElementById('dealsContent');
    if (!container) return;
    
    const filteredDeals = getFilteredDeals();
    
    const dealsByStatus = {};
    for (const s of DEAL_STATUSES) dealsByStatus[s.id] = [];
    for (const deal of filteredDeals) {
        const status = deal.status || 'new';
        if (dealsByStatus[status]) {
            dealsByStatus[status].push(deal);
        } else {
            dealsByStatus['new'].push(deal);
        }
    }
    
    let html = '<div class="kanban-board-deals">';
    for (const status of DEAL_STATUSES) {
        const statusDeals = dealsByStatus[status.id] || [];
        html += `
            <div class="deal-column" data-status="${status.id}">
                <div class="deal-column-header" style="border-top: 3px solid ${status.color};">
                    <span><span class="status-icon">${status.icon}</span> ${status.name}</span>
                    <span class="count">${statusDeals.length}</span>
                </div>
                <div class="deals-container" data-status="${status.id}" id="container-${status.id}"></div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    for (const status of DEAL_STATUSES) {
        const containerEl = document.getElementById(`container-${status.id}`);
        if (containerEl) {
            const statusDeals = dealsByStatus[status.id] || [];
            for (const deal of statusDeals) {
                const dealWithNames = {
                    ...deal,
                    complex_name: getComplexName(deal.complex_id),
                    seller_name: getCounterpartyName(deal.seller_id),
                    buyer_name: getCounterpartyName(deal.buyer_id)
                };
                const card = createDealCard(dealWithNames, { canEdit: true });
                card.setAttribute('data-deal-id', deal.id);
                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('delete-deal') && !e.target.closest('.delete-deal')) {
                        openDealDetail(deal.id);
                    }
                });
                const deleteBtn = card.querySelector('.delete-deal');
                if (deleteBtn) {
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        window.deleteDeal(deal.id);
                    };
                }
                containerEl.appendChild(card);
            }
            if (statusDeals.length === 0) {
                containerEl.innerHTML = '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
            }
        }
    }
    
    setupDragAndDrop('.deals-container', async (dealId, newStatus) => {
        await handleUpdateDealStatus(dealId, newStatus);
    });
}

// ========== СПИСОЧНЫЙ РЕЖИМ ==========

function openDealDetail(dealId) {
    const url = getDealDetailUrl(dealId);
    console.log('[deals] Переход к деталям сделки:', url);
    window.location.href = url;
}

function renderListView() {
    const container = document.getElementById('dealsContent');
    if (!container) return;
    
    const filteredDeals = getFilteredDeals();
    
    if (currentGrouping === 'stage') {
        const groupedDeals = {};
        for (const deal of filteredDeals) {
            const stage = deal.status || 'new';
            if (!groupedDeals[stage]) {
                groupedDeals[stage] = [];
            }
            groupedDeals[stage].push(deal);
        }
        
        const stageOrder = ['new', 'selection', 'matching', 'showing', 'negotiation', 'documents', 'mortgage', 'deal', 'keys', 'closed', 'cancelled'];
        
        let html = '<div class="list-view-container">';
        for (const stageName of stageOrder) {
            const deals = groupedDeals[stageName];
            if (!deals || deals.length === 0) continue;
            
            const group = createStageGroup(STAGE_NAMES[stageName] || stageName, deals.length);
            const groupContent = group.querySelector('.stage-group-content');
            
            for (const deal of deals) {
                const dealWithNames = {
                    ...deal,
                    complex_name: getComplexName(deal.complex_id),
                    seller_name: getCounterpartyName(deal.seller_id),
                    buyer_name: getCounterpartyName(deal.buyer_id),
                    agent_name: getUserName(deal.agent_id)
                };
                const card = createDealCardList(dealWithNames, {
                    onOpen: (id) => openDealDetail(id),
                    stageOrder: deal.stage_order?.[deal.type]
                });
                groupContent.appendChild(card);
            }
            
            html += group.outerHTML;
        }
        
        if (Object.keys(groupedDeals).length === 0) {
            html += '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } else {
        let html = '<div class="ungrouped-view">';
        for (const deal of filteredDeals) {
            const dealWithNames = {
                ...deal,
                complex_name: getComplexName(deal.complex_id),
                seller_name: getCounterpartyName(deal.seller_id),
                buyer_name: getCounterpartyName(deal.buyer_id),
                agent_name: getUserName(deal.agent_id)
            };
            const card = createDealCardList(dealWithNames, {
                onOpen: (id) => openDealDetail(id),
                stageOrder: deal.stage_order?.[deal.type]
            });
            html += card.outerHTML;
        }
        if (filteredDeals.length === 0) {
            html += '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }
}

// ========== УПРАВЛЕНИЕ РЕЖИМАМИ ==========

function setMode(mode) {
    currentMode = mode;
    localStorage.setItem('deals_view_mode', mode);
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const groupingFilter = document.getElementById('groupingFilter');
    if (groupingFilter) {
        groupingFilter.style.display = mode === 'list' ? 'inline-block' : 'none';
    }
    
    renderCurrentView();
}

function setGrouping(grouping) {
    currentGrouping = grouping;
    localStorage.setItem('deals_grouping', grouping);
    renderCurrentView();
}

function renderCurrentView() {
    if (currentMode === 'kanban') {
        renderKanban();
    } else {
        renderListView();
    }
}

// ========== CRUD ОПЕРАЦИИ ==========

window.deleteDeal = async function(dealId) {
    const deal = dealsData.find(d => d.id == dealId);
    if (!deal) return;
    
    if (confirm(`Удалить заявку N${deal.id}?`)) {
        const success = await deleteDeal(dealId);
        if (success) {
            const index = dealsData.findIndex(d => d.id == dealId);
            if (index !== -1) dealsData.splice(index, 1);
            renderCurrentView();
            showToast('success', 'Заявка удалена');
        } else {
            showToast('error', 'Ошибка удаления');
        }
    }
};

// ========== МОДАЛЬНОЕ ОКНО ==========

async function openDealModal(dealId = null) {
    const modal = document.getElementById('dealModal');
    const modalTitle = document.getElementById('modalTitle');
    
    await loadComplexes();
    await loadCounterparties();
    await loadUsers();
    updateComplexSelect();
    updateCounterpartySelects();
    
    if (dealId) {
        modalTitle.textContent = 'Редактировать заявку';
        const deal = dealsData.find(d => d.id == dealId);
        if (deal) {
            document.getElementById('dealId').value = deal.id;
            document.getElementById('dealComplex').value = deal.complex_id || '';
            document.getElementById('dealApartment').value = deal.apartment || '';
            document.getElementById('dealSeller').value = deal.seller_id || '';
            document.getElementById('dealBuyer').value = deal.buyer_id || '';
            document.getElementById('dealType').value = deal.type;
            document.getElementById('dealAgent').value = deal.agent_id || '';
            document.getElementById('dealPriceInitial').value = deal.price_initial;
            document.getElementById('dealPriceCurrent').value = deal.price_current;
            document.getElementById('dealCommission').value = deal.commission;
            document.getElementById('dealDeadline').value = deal.deadline || '';
            document.getElementById('dealBank').value = deal.bank || '';
            document.getElementById('dealMortgageApproved').value = deal.mortgage_approved ? 'true' : 'false';
            document.getElementById('dealNotes').value = deal.notes || '';
        }
    } else {
        modalTitle.textContent = 'Создать заявку';
        document.getElementById('dealId').value = '';
        document.getElementById('dealComplex').value = '';
        document.getElementById('dealApartment').value = '';
        document.getElementById('dealSeller').value = '';
        document.getElementById('dealBuyer').value = '';
        document.getElementById('dealType').value = 'secondary';
        document.getElementById('dealAgent').value = currentUser?.github_username || '';
        document.getElementById('dealPriceInitial').value = '';
        document.getElementById('dealPriceCurrent').value = '';
        document.getElementById('dealCommission').value = '3';
        document.getElementById('dealDeadline').value = '';
        document.getElementById('dealBank').value = '';
        document.getElementById('dealMortgageApproved').value = 'false';
        document.getElementById('dealNotes').value = '';
    }
    
    modal.classList.add('active');
}

window.closeDealModal = function() {
    document.getElementById('dealModal').classList.remove('active');
};

window.saveDeal = async function() {
    const dealId = document.getElementById('dealId').value;
    const dealData = {
        complex_id: document.getElementById('dealComplex').value || null,
        apartment: document.getElementById('dealApartment').value,
        seller_id: document.getElementById('dealSeller').value || null,
        buyer_id: document.getElementById('dealBuyer').value || null,
        type: document.getElementById('dealType').value,
        agent_id: document.getElementById('dealAgent').value,
        price_initial: parseInt(document.getElementById('dealPriceInitial').value) || 0,
        price_current: parseInt(document.getElementById('dealPriceCurrent').value) || 0,
        commission: parseFloat(document.getElementById('dealCommission').value) || 3,
        deadline: document.getElementById('dealDeadline').value || null,
        bank: document.getElementById('dealBank').value || null,
        mortgage_approved: document.getElementById('dealMortgageApproved').value === 'true',
        notes: document.getElementById('dealNotes').value || null,
        status: 'new'
    };
    
    let result;
    if (dealId) {
        result = await updateDeal(dealId, dealData);
        if (result) {
            const index = dealsData.findIndex(d => d.id == dealId);
            if (index !== -1) {
                dealsData[index] = { ...dealsData[index], ...dealData };
            }
            window.closeDealModal();
            renderCurrentView();
            showToast('success', 'Заявка обновлена');
        }
    } else {
        result = await createDeal(dealData);
        if (result) {
            await loadDealsData();
            window.closeDealModal();
            showToast('success', 'Заявка создана');
        }
    }
    
    if (!result) {
        showToast('error', 'Ошибка сохранения');
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initDealsPage() {
    console.log('[deals] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[deals] Текущий пользователь:', currentUser?.name);
    
    await loadComplexes();
    await loadCounterparties();
    await loadUsers();
    await loadDealsData();
    
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
        });
    });
    
    const groupingFilter = document.getElementById('groupingFilter');
    if (groupingFilter) {
        groupingFilter.value = currentGrouping;
        groupingFilter.addEventListener('change', (e) => {
            setGrouping(e.target.value);
        });
    }
    
    const addBtn = document.getElementById('addDealBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openDealModal());
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderCurrentView());
    }
    
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => renderCurrentView());
    }
    
    const agentFilter = document.getElementById('agentFilter');
    if (agentFilter) {
        agentFilter.addEventListener('change', () => renderCurrentView());
    }
    
    setMode(currentMode);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[deals] Инициализация завершена');
}
