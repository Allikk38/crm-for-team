/**
 * ============================================
 * ФАЙЛ: js/pages/deals.js
 * РОЛЬ: Логика страницы управления заявками (сделки) - Kanban
 * 
 * ОСОБЕННОСТИ:
 *   - Kanban-доска с 6 статусами (new, showing, negotiation, documents, closed, cancelled)
 *   - Drag-and-drop для изменения статуса
 *   - Создание/редактирование сделок
 *   - Фильтрация по поиску, типу, агенту
 *   - Связь с объектами и контрагентами
 *   - Оптимизированное обновление карточек (без полного перерендера)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/deals-supabase.js
 *   - js/components/kanban.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из deals-supabase.html
 *   - 30.03.2026: Переход на чистые импорты из kanban.js
 *   - 30.03.2026: Оптимизация обновления карточек, сохранение анимаций
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
    updateDealStatus 
} from '../services/deals-supabase.js';
import { createDealCard, setupDragAndDrop } from '../components/kanban.js';

// Состояние страницы
let dealsData = [];
let complexesData = [];
let counterpartiesData = [];
let usersData = [];
let currentUser = null;

// Статусы сделок
const DEAL_STATUSES = [
    { id: 'new', name: 'Новая', icon: 'N', color: '#9e9e9e' },
    { id: 'showing', name: 'Показ', icon: 'V', color: '#2196f3' },
    { id: 'negotiation', name: 'Торг', icon: 'R', color: '#ffc107' },
    { id: 'documents', name: 'Документы', icon: 'P', color: '#ff9800' },
    { id: 'closed', name: 'Закрыта', icon: 'C', color: '#4caf50' },
    { id: 'cancelled', name: 'Отказ', icon: 'X', color: '#9e9e9e' }
];

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
    renderKanban();
}

function getComplexName(complexId) {
    const complex = complexesData.find(c => c.id == complexId);
    return complex ? complex.name : '—';
}

function getCounterpartyName(id) {
    const cp = counterpartiesData.find(c => c.id == id);
    return cp ? cp.name : '—';
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

// ========== ОБНОВЛЕНИЕ КАРТОЧЕК (ОПТИМИЗИРОВАННОЕ) ==========

/**
 * Обновляет карточку на доске без полного перерендера
 */
function updateDealCard(dealId, newStatus) {
    const card = document.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
    if (!card) return;
    
    const oldContainer = card.closest('.deals-container');
    const newContainer = document.querySelector(`.deals-container[data-status="${newStatus}"]`);
    
    if (!newContainer) return;
    
    // Удаляем из старого контейнера
    card.remove();
    
    // Добавляем в новый контейнер
    newContainer.appendChild(card);
    
    // Обновляем счетчики
    updateColumnCounters();
    
    // Если старый контейнер стал пустым, добавляем сообщение "Нет заявок"
    if (oldContainer && oldContainer.children.length === 0) {
        oldContainer.innerHTML = '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
    }
    
    // Удаляем сообщение "Нет заявок" из нового контейнера, если оно есть
    const emptyDiv = newContainer.querySelector('.empty-deals');
    if (emptyDiv && newContainer.children.length > 1) {
        emptyDiv.remove();
    }
}

/**
 * Обновляет счетчики в колонках
 */
function updateColumnCounters() {
    for (const status of DEAL_STATUSES) {
        const container = document.querySelector(`.deals-container[data-status="${status.id}"]`);
        const count = container?.children.length || 0;
        // Убираем из подсчета элемент empty-deals
        const emptyDeals = container?.querySelector('.empty-deals');
        const actualCount = emptyDeals ? 0 : count;
        
        const countElement = document.querySelector(`.deal-column[data-status="${status.id}"] .count`);
        if (countElement) {
            countElement.textContent = actualCount;
        }
    }
}

// ========== CRUD ==========

async function handleUpdateDealStatus(dealId, newStatus) {
    console.log(`[deals] Изменение статуса: ${dealId} → ${newStatus}`);
    
    const deal = dealsData.find(d => d.id == dealId);
    if (!deal || deal.status === newStatus) return;
    
    // Сохраняем старый статус для отката
    const oldStatus = deal.status;
    
    // Оптимистичное обновление UI
    deal.status = newStatus;
    updateDealCard(dealId, newStatus);
    
    try {
        const updated = await updateDealStatus(dealId, newStatus);
        if (updated) {
            showToast('success', `Статус изменён на "${DEAL_STATUSES.find(s => s.id === newStatus)?.name}"`);
        } else {
            // Откат при ошибке
            deal.status = oldStatus;
            updateDealCard(dealId, oldStatus);
            console.error(`[deals] Ошибка обновления статуса ${dealId}`);
            showToast('error', 'Ошибка изменения статуса');
        }
    } catch (error) {
        // Откат при ошибке
        deal.status = oldStatus;
        updateDealCard(dealId, oldStatus);
        console.error(`[deals] Ошибка обновления статуса ${dealId}:`, error);
        showToast('error', 'Ошибка изменения статуса');
    }
}

window.deleteDeal = async function(dealId) {
    const deal = dealsData.find(d => d.id == dealId);
    if (!deal) return;
    
    if (confirm(`Удалить заявку N${deal.id}?`)) {
        console.log(`[deals] Удаление сделки ${dealId}`);
        
        // Оптимистичное удаление
        const card = document.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
        if (card) {
            card.classList.add('card-removing');
            await new Promise(r => setTimeout(r, 200));
        }
        
        const success = await deleteDeal(dealId);
        if (success) {
            // Удаляем из данных
            const index = dealsData.findIndex(d => d.id == dealId);
            if (index !== -1) dealsData.splice(index, 1);
            
            // Удаляем карточку из DOM
            if (card) card.remove();
            
            // Обновляем счетчики и проверяем пустые контейнеры
            updateColumnCounters();
            
            // Добавляем сообщение "Нет заявок" в пустые контейнеры
            for (const status of DEAL_STATUSES) {
                const container = document.querySelector(`.deals-container[data-status="${status.id}"]`);
                if (container && container.children.length === 0) {
                    container.innerHTML = '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
                }
            }
            
            showToast('success', 'Заявка удалена');
        } else {
            console.error('[deals] Ошибка удаления');
            showToast('error', 'Ошибка удаления');
        }
    }
};

// ========== СОЗДАНИЕ КАРТОЧКИ ==========

function createDealCardWithData(deal) {
    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';
    const isAgentMatch = deal.agent_id?.toLowerCase() === currentUser?.github_username?.toLowerCase();
    const canEdit = (isAdmin || isManager || isAgentMatch) === true;
    
    console.log(`[deals] Карточка ${deal.id}, canEdit: ${canEdit}`);
    
    const dealWithNames = {
        ...deal,
        complex_name: getComplexName(deal.complex_id),
        seller_name: getCounterpartyName(deal.seller_id),
        buyer_name: getCounterpartyName(deal.buyer_id),
        price_current: deal.price_current || deal.price_initial,
        deadline: deal.deadline
    };
    
    const card = createDealCard(dealWithNames, { canEdit });
    card.setAttribute('data-deal-id', deal.id);
    
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-deal') && 
            !e.target.closest('.delete-deal')) {
            openDealModal(deal.id);
        }
    });
    
    const deleteBtn = card.querySelector('.delete-deal');
    if (deleteBtn) {
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            window.deleteDeal(deal.id);
        };
    }
    
    return card;
}

// ========== РЕНДЕРИНГ КАНБАНА ==========

function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    
    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const agentFilter = document.getElementById('agentFilter')?.value || 'all';
    
    let filteredDeals = dealsData.filter(deal => {
        const matchSearch = searchText === '' ||
            deal.id.toString().includes(searchText) ||
            getComplexName(deal.complex_id).toLowerCase().includes(searchText) ||
            getCounterpartyName(deal.seller_id).toLowerCase().includes(searchText) ||
            getCounterpartyName(deal.buyer_id).toLowerCase().includes(searchText);
        const matchType = typeFilter === 'all' || deal.type === typeFilter;
        const matchAgent = agentFilter === 'all' || deal.agent_id?.toLowerCase() === agentFilter?.toLowerCase();
        return matchSearch && matchType && matchAgent;
    });
    
    const dealsByStatus = {};
    for (const s of DEAL_STATUSES) dealsByStatus[s.id] = [];
    for (const deal of filteredDeals) {
        if (dealsByStatus[deal.status]) {
            dealsByStatus[deal.status].push(deal);
        } else {
            dealsByStatus['new'].push(deal);
        }
    }
    
    let html = '';
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
    board.innerHTML = html;
    
    for (const status of DEAL_STATUSES) {
        const container = document.getElementById(`container-${status.id}`);
        if (container) {
            const statusDeals = dealsByStatus[status.id] || [];
            for (const deal of statusDeals) {
                container.appendChild(createDealCardWithData(deal));
            }
            if (statusDeals.length === 0) {
                container.innerHTML = '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
            }
        }
    }
    
    setupDragAndDrop('.deals-container', async (dealId, newStatus) => {
        await handleUpdateDealStatus(dealId, newStatus);
    });
}

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
    console.log('[deals] Модальное окно открыто, режим:', dealId ? 'редактирование' : 'создание');
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
    
    console.log('[deals] Сохранение сделки:', dealId || 'новая');
    
    let result;
    if (dealId) {
        result = await updateDeal(dealId, dealData);
        if (result) {
            // Обновляем данные в массиве
            const index = dealsData.findIndex(d => d.id == dealId);
            if (index !== -1) {
                dealsData[index] = { ...dealsData[index], ...dealData };
                // Обновляем карточку
                const card = document.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
                if (card) {
                    const newCard = createDealCardWithData(dealsData[index]);
                    card.replaceWith(newCard);
                }
            }
            window.closeDealModal();
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
        console.error('[deals] Ошибка сохранения');
        alert('Ошибка сохранения');
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initDealsPage() {
    console.log('[deals] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[deals] Текущий пользователь:', currentUser?.name, 'роль:', currentUser?.role);
    
    await loadComplexes();
    await loadCounterparties();
    await loadUsers();
    await loadDealsData();
    
    const addBtn = document.getElementById('addDealBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openDealModal());
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderKanban());
    }
    
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => renderKanban());
    }
    
    const agentFilter = document.getElementById('agentFilter');
    if (agentFilter) {
        agentFilter.addEventListener('change', () => renderKanban());
    }
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[deals] Анимации инициализированы');
    }
    
    console.log('[deals] Инициализация завершена');
}