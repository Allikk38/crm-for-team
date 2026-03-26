/**
 * ============================================
 * ФАЙЛ: deals.js
 * РОЛЬ: Логика управления заявками (Kanban-доска)
 * СВЯЗИ:
 *   - core.js: loadCSV(), utils.saveCSVToGitHub()
 *   - auth.js: auth.getCurrentUser(), auth.hasPermission()
 *   - Данные: data/deals.csv, data/counterparties.csv, data/complexes.csv, data/users.csv
 * МЕХАНИКА:
 *   1. Загрузка заявок, контрагентов, объектов, пользователей
 *   2. Отображение Kanban-доски с 9 статусами
 *   3. Drag-and-drop для изменения статуса заявки
 *   4. CRUD операции с заявками
 *   5. Фильтрация по роли пользователя
 *   6. Интеграция с объектами и контрагентами
 *   7. Сохранение всех изменений в GitHub
 * ============================================
 */

// Глобальные переменные
var deals = [];
var counterparties = [];
var complexes = [];
var users = [];
var currentUser = null;
var draggedDeal = null;

// Статусы заявок (порядок важен для Kanban)
var DEAL_STATUSES = [
    { id: 'new', name: 'Новая', icon: '🆕', color: '#9e9e9e' },
    { id: 'showing', name: 'Показ', icon: '👁️', color: '#2196f3' },
    { id: 'negotiation', name: 'Торг', icon: '💰', color: '#ffc107' },
    { id: 'deposit', name: 'Задаток', icon: '💎', color: '#9c27b0' },
    { id: 'documents', name: 'Документы', icon: '📋', color: '#ff9800' },
    { id: 'contract', name: 'Договор', icon: '✍️', color: '#f44336' },
    { id: 'payment', name: 'Расчёт', icon: '💵', color: '#4caf50' },
    { id: 'closed', name: 'Закрыта', icon: '✅', color: '#607d8b' },
    { id: 'cancelled', name: 'Отказ', icon: '❌', color: '#9e9e9e' }
];

// Типы сделок
var DEAL_TYPES = {
    primary: { name: 'Первичка', icon: '🏗️', class: 'type-primary' },
    secondary: { name: 'Вторичка', icon: '🏠', class: 'type-secondary' },
    exchange: { name: 'Альтернатива', icon: '🔄', class: 'type-exchange' },
    urgent: { name: 'Срочный выкуп', icon: '⚡', class: 'type-urgent' }
};

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadDeals() {
    console.log('[deals.js] Загрузка заявок...');
    try {
        var dealsData = await loadCSV('data/deals.csv');
        deals = [];
        if (dealsData && dealsData.length > 0) {
            for (var i = 0; i < dealsData.length; i++) {
                var d = dealsData[i];
                deals.push({
                    id: parseInt(d.id),
                    complex_id: parseInt(d.complex_id) || null,
                    apartment: d.apartment || '',
                    seller_id: parseInt(d.seller_id) || null,
                    buyer_id: parseInt(d.buyer_id) || null,
                    agent_id: d.agent_id || '',
                    type: d.type || 'secondary',
                    status: d.status || 'new',
                    price_initial: parseInt(d.price_initial) || 0,
                    price_current: parseInt(d.price_current) || 0,
                    commission: parseFloat(d.commission) || 3,
                    deadline: d.deadline || '',
                    bank: d.bank || '',
                    mortgage_approved: d.mortgage_approved === 'true',
                    notes: d.notes || '',
                    created_at: d.created_at || '',
                    updated_at: d.updated_at || ''
                });
            }
        }
        console.log('[deals.js] Загружено заявок:', deals.length);
    } catch (error) {
        console.error('[deals.js] Ошибка загрузки заявок:', error);
        deals = [];
    }
}

async function loadCounterparties() {
    console.log('[deals.js] Загрузка контрагентов...');
    try {
        var data = await loadCSV('data/counterparties.csv');
        counterparties = [];
        if (data && data.length > 0) {
            for (var i = 0; i < data.length; i++) {
                var c = data[i];
                counterparties.push({
                    id: parseInt(c.id),
                    type: c.type || 'seller',
                    person_type: c.person_type || 'individual',
                    name: c.name || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    notes: c.notes || '',
                    created_at: c.created_at || ''
                });
            }
        }
        console.log('[deals.js] Загружено контрагентов:', counterparties.length);
    } catch (error) {
        console.error('[deals.js] Ошибка загрузки контрагентов:', error);
        counterparties = [];
    }
}

async function loadComplexesForDeals() {
    console.log('[deals.js] Загрузка объектов...');
    try {
        complexes = await loadCSV('data/complexes.csv');
        console.log('[deals.js] Загружено объектов:', complexes.length);
        
        // Заполняем выпадающий список объектов в модальном окне
        var complexSelect = document.getElementById('dealComplex');
        if (complexSelect) {
            complexSelect.innerHTML = '<option value="">Выберите объект</option>';
            for (var i = 0; i < complexes.length; i++) {
                var c = complexes[i];
                var option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.title + ' (' + c.address + ')';
                complexSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('[deals.js] Ошибка загрузки объектов:', error);
        complexes = [];
    }
}

async function loadUsersForDeals() {
    console.log('[deals.js] Загрузка пользователей...');
    try {
        users = await loadCSV('data/users.csv');
        console.log('[deals.js] Загружено пользователей:', users.length);
        
        // Заполняем выпадающий список агентов
        var agentSelect = document.getElementById('dealAgent');
        if (agentSelect) {
            agentSelect.innerHTML = '<option value="">Выберите агента</option>';
            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                if (u.role === 'agent' || u.role === 'manager' || u.role === 'admin') {
                    var option = document.createElement('option');
                    option.value = u.github_username;
                    option.textContent = u.name + ' (' + u.role + ')';
                    agentSelect.appendChild(option);
                }
            }
        }
        
        // Заполняем выпадающие списки продавцов и покупателей
        updateCounterpartySelects();
    } catch (error) {
        console.error('[deals.js] Ошибка загрузки пользователей:', error);
        users = [];
    }
}

function updateCounterpartySelects() {
    var sellerSelect = document.getElementById('dealSeller');
    var buyerSelect = document.getElementById('dealBuyer');
    
    if (sellerSelect) {
        sellerSelect.innerHTML = '<option value="">Выберите продавца</option>';
        for (var i = 0; i < counterparties.length; i++) {
            var c = counterparties[i];
            if (c.type === 'seller' || c.type === 'developer') {
                var option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.name + (c.phone ? ' (' + c.phone + ')' : '');
                sellerSelect.appendChild(option);
            }
        }
    }
    
    if (buyerSelect) {
        buyerSelect.innerHTML = '<option value="">Выберите покупателя</option>';
        for (var i = 0; i < counterparties.length; i++) {
            var c = counterparties[i];
            if (c.type === 'buyer' || c.type === 'investor') {
                var option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.name + (c.phone ? ' (' + c.phone + ')' : '');
                buyerSelect.appendChild(option);
            }
        }
    }
}

// ========== ФИЛЬТРАЦИЯ ПО РОЛИ ==========

function filterDealsByRole() {
    if (!currentUser) return [];
    
    // Админ и менеджер видят всё
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return deals;
    }
    
    // Агент видит только свои заявки
    if (currentUser.role === 'agent') {
        return deals.filter(function(deal) {
            return deal.agent_id === currentUser.github_username;
        });
    }
    
    // Наблюдатель видит только закрытые и открытые (но не может редактировать)
    return deals.filter(function(deal) {
        return deal.status === 'closed' || deal.status === 'cancelled';
    });
}

// ========== RENDER KANBAN ==========

function renderKanban() {
    console.log('[deals.js] Рендеринг Kanban-доски...');
    var board = document.getElementById('kanbanBoard');
    if (!board) return;
    
    var filteredDeals = filterDealsByRole();
    var searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    var typeFilter = document.getElementById('typeFilter')?.value || 'all';
    var agentFilter = document.getElementById('agentFilter')?.value || 'all';
    
    // Фильтрация
    var displayDeals = filteredDeals.filter(function(deal) {
        var complex = getComplexById(deal.complex_id);
        var seller = getCounterpartyById(deal.seller_id);
        var buyer = getCounterpartyById(deal.buyer_id);
        
        var matchSearch = searchText === '' ||
            deal.id.toString().includes(searchText) ||
            (complex && complex.title.toLowerCase().includes(searchText)) ||
            (seller && seller.name.toLowerCase().includes(searchText)) ||
            (buyer && buyer.name.toLowerCase().includes(searchText));
        
        var matchType = typeFilter === 'all' || deal.type === typeFilter;
        var matchAgent = agentFilter === 'all' || deal.agent_id === agentFilter;
        
        return matchSearch && matchType && matchAgent;
    });
    
    // Группировка по статусам
    var dealsByStatus = {};
    for (var i = 0; i < DEAL_STATUSES.length; i++) {
        dealsByStatus[DEAL_STATUSES[i].id] = [];
    }
    
    for (var i = 0; i < displayDeals.length; i++) {
        var deal = displayDeals[i];
        if (dealsByStatus[deal.status]) {
            dealsByStatus[deal.status].push(deal);
        } else {
            dealsByStatus['new'].push(deal);
        }
    }
    
    // Построение HTML
    var html = '';
    for (var i = 0; i < DEAL_STATUSES.length; i++) {
        var status = DEAL_STATUSES[i];
        var statusDeals = dealsByStatus[status.id] || [];
        
        html += '<div class="deal-column" data-status="' + status.id + '">' +
            '<div class="deal-column-header" style="border-top: 3px solid ' + status.color + ';">' +
                '<span><span class="status-icon">' + status.icon + '</span> ' + status.name + '</span>' +
                '<span class="count">' + statusDeals.length + '</span>' +
            '</div>' +
            '<div class="deals-container" data-status="' + status.id + '">';
        
        for (var j = 0; j < statusDeals.length; j++) {
            html += createDealCard(statusDeals[j]);
        }
        
        if (statusDeals.length === 0) {
            html += '<div class="empty-deals"><i class="fas fa-inbox"></i><p>Нет заявок</p></div>';
        }
        
        html += '</div></div>';
    }
    
    board.innerHTML = html;
    
    // Добавляем обработчики drag-and-drop
    setupDragAndDrop();
    
    // Добавляем обработчики кликов на карточки
    document.querySelectorAll('.deal-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.delete-deal')) {
                var dealId = parseInt(this.getAttribute('data-deal-id'));
                openDealModal(dealId);
            }
        });
    });
    
    // Обновляем фильтр агентов
    updateAgentFilter();
    
    console.log('[deals.js] Рендеринг завершён');
}

function createDealCard(deal) {
    var complex = getComplexById(deal.complex_id);
    var seller = getCounterpartyById(deal.seller_id);
    var buyer = getCounterpartyById(deal.buyer_id);
    var dealType = DEAL_TYPES[deal.type] || DEAL_TYPES.secondary;
    
    var priceFormatted = (deal.price_current || deal.price_initial).toLocaleString();
    var deadlineClass = '';
    if (deal.deadline) {
        var today = new Date().toISOString().split('T')[0];
        if (deal.deadline < today && deal.status !== 'closed' && deal.status !== 'cancelled') {
            deadlineClass = 'overdue';
        }
    }
    
    var canEdit = canEditDeal(deal);
    
    return '<div class="deal-card" data-deal-id="' + deal.id + '" draggable="' + canEdit + '">' +
        '<div class="deal-title">' +
            '<span>Заявка №' + deal.id + '</span>' +
            '<span class="deal-number">' + (complex ? complex.title : '—') + '</span>' +
        '</div>' +
        '<div class="deal-participants">' +
            '<span title="Продавец">🏠 ' + (seller ? escapeHtml(seller.name) : '—') + '</span>' +
            '<span>→</span>' +
            '<span title="Покупатель">👤 ' + (buyer ? escapeHtml(buyer.name) : '—') + '</span>' +
        '</div>' +
        '<div class="deal-price">' +
            '<span class="deal-type ' + dealType.class + '">' + dealType.icon + ' ' + dealType.name + '</span>' +
            '<span>' + priceFormatted + ' ₽</span>' +
        '</div>' +
        '<div class="deal-meta">' +
            '<span><i class="fas fa-user-tie"></i> ' + (deal.agent_id || '—') + '</span>' +
            '<span class="' + deadlineClass + '"><i class="fas fa-calendar"></i> ' + (deal.deadline || '—') + '</span>' +
        '</div>' +
        (canEdit ? '<div class="deal-meta" style="margin-top: 8px;"><button class="delete-deal" onclick="event.stopPropagation(); deleteDeal(' + deal.id + ')"><i class="fas fa-trash"></i> Удалить</button></div>' : '') +
    '</div>';
}

function getComplexById(id) {
    if (!id) return null;
    for (var i = 0; i < complexes.length; i++) {
        if (complexes[i].id == id) return complexes[i];
    }
    return null;
}

function getCounterpartyById(id) {
    if (!id) return null;
    for (var i = 0; i < counterparties.length; i++) {
        if (counterparties[i].id == id) return counterparties[i];
    }
    return null;
}

// ========== DRAG AND DROP ==========

function setupDragAndDrop() {
    var cards = document.querySelectorAll('.deal-card[draggable="true"]');
    var containers = document.querySelectorAll('.deals-container');
    
    cards.forEach(function(card) {
        card.removeEventListener('dragstart', handleDragStart);
        card.removeEventListener('dragend', handleDragEnd);
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    containers.forEach(function(container) {
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('drop', handleDrop);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedDeal = e.target.closest('.deal-card');
    if (draggedDeal) {
        draggedDeal.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedDeal.getAttribute('data-deal-id'));
    }
}

function handleDragEnd(e) {
    if (draggedDeal) {
        draggedDeal.classList.remove('dragging');
        draggedDeal = null;
    }
}

function handleDragOver(e) {
    e.preventDefault();
}

async function handleDrop(e) {
    e.preventDefault();
    var dealId = e.dataTransfer.getData('text/plain');
    var newStatus = e.target.closest('.deal-column')?.getAttribute('data-status');
    
    if (dealId && newStatus) {
        await updateDealStatus(parseInt(dealId), newStatus);
    }
}

async function updateDealStatus(dealId, newStatus) {
    console.log('[deals.js] Обновление статуса заявки', dealId, '->', newStatus);
    var deal = null;
    for (var i = 0; i < deals.length; i++) {
        if (deals[i].id === dealId) {
            deal = deals[i];
            break;
        }
    }
    
    if (!deal) return;
    
    if (!canEditDeal(deal)) {
        showToast('error', 'У вас нет прав на изменение этой заявки');
        return;
    }
    
    if (deal.status !== newStatus) {
        deal.status = newStatus;
        deal.updated_at = new Date().toISOString().split('T')[0];
        await saveDealsToGitHub();
        renderKanban();
        showToast('success', 'Статус заявки №' + dealId + ' изменён на "' + getStatusName(newStatus) + '"');
    }
}

function getStatusName(statusId) {
    for (var i = 0; i < DEAL_STATUSES.length; i++) {
        if (DEAL_STATUSES[i].id === statusId) return DEAL_STATUSES[i].name;
    }
    return statusId;
}

// ========== CRUD ЗАЯВОК ==========

function canEditDeal(deal) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'manager') return true;
    if (currentUser.role === 'agent') {
        return deal.agent_id === currentUser.github_username;
    }
    return false;
}

function openDealModal(dealId) {
    var modal = document.getElementById('dealModal');
    var modalTitle = document.getElementById('modalTitle');
    
    if (dealId) {
        modalTitle.textContent = 'Редактировать заявку';
        var deal = null;
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].id === dealId) {
                deal = deals[i];
                break;
            }
        }
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

function closeDealModal() {
    document.getElementById('dealModal').classList.remove('active');
}

async function saveDeal() {
    var dealId = document.getElementById('dealId').value;
    var dealData = {
        complex_id: document.getElementById('dealComplex').value ? parseInt(document.getElementById('dealComplex').value) : null,
        apartment: document.getElementById('dealApartment').value,
        seller_id: document.getElementById('dealSeller').value ? parseInt(document.getElementById('dealSeller').value) : null,
        buyer_id: document.getElementById('dealBuyer').value ? parseInt(document.getElementById('dealBuyer').value) : null,
        type: document.getElementById('dealType').value,
        agent_id: document.getElementById('dealAgent').value,
        price_initial: parseInt(document.getElementById('dealPriceInitial').value) || 0,
        price_current: parseInt(document.getElementById('dealPriceCurrent').value) || 0,
        commission: parseFloat(document.getElementById('dealCommission').value) || 3,
        deadline: document.getElementById('dealDeadline').value,
        bank: document.getElementById('dealBank').value,
        mortgage_approved: document.getElementById('dealMortgageApproved').value === 'true',
        notes: document.getElementById('dealNotes').value
    };
    
    if (!dealData.complex_id) {
        alert('Выберите объект');
        return;
    }
    
    if (dealId) {
        await updateDeal(parseInt(dealId), dealData);
    } else {
        await createDeal(dealData);
    }
    
    closeDealModal();
}

async function createDeal(dealData) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'agent')) {
        showToast('error', 'У вас нет прав на создание заявок');
        return;
    }
    
    var maxId = 0;
    for (var i = 0; i < deals.length; i++) {
        if (deals[i].id > maxId) maxId = deals[i].id;
    }
    var newId = maxId + 1;
    
    var newDeal = {
        id: newId,
        complex_id: dealData.complex_id,
        apartment: dealData.apartment,
        seller_id: dealData.seller_id,
        buyer_id: dealData.buyer_id,
        agent_id: dealData.agent_id || currentUser.github_username,
        type: dealData.type,
        status: 'new',
        price_initial: dealData.price_initial,
        price_current: dealData.price_current || dealData.price_initial,
        commission: dealData.commission,
        deadline: dealData.deadline,
        bank: dealData.bank,
        mortgage_approved: dealData.mortgage_approved,
        notes: dealData.notes,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0]
    };
    
    deals.push(newDeal);
    await saveDealsToGitHub();
    renderKanban();
    showToast('success', 'Заявка №' + newId + ' создана');
}

async function updateDeal(dealId, dealData) {
    var dealIndex = -1;
    for (var i = 0; i < deals.length; i++) {
        if (deals[i].id === dealId) {
            dealIndex = i;
            break;
        }
    }
    
    if (dealIndex !== -1) {
        var deal = deals[dealIndex];
        
        if (!canEditDeal(deal)) {
            showToast('error', 'У вас нет прав на редактирование этой заявки');
            return;
        }
        
        deals[dealIndex] = {
            ...deal,
            complex_id: dealData.complex_id,
            apartment: dealData.apartment,
            seller_id: dealData.seller_id,
            buyer_id: dealData.buyer_id,
            agent_id: dealData.agent_id,
            type: dealData.type,
            price_initial: dealData.price_initial,
            price_current: dealData.price_current,
            commission: dealData.commission,
            deadline: dealData.deadline,
            bank: dealData.bank,
            mortgage_approved: dealData.mortgage_approved,
            notes: dealData.notes,
            updated_at: new Date().toISOString().split('T')[0]
        };
        
        await saveDealsToGitHub();
        renderKanban();
        showToast('success', 'Заявка №' + dealId + ' обновлена');
    }
}

async function deleteDeal(dealId) {
    var deal = null;
    for (var i = 0; i < deals.length; i++) {
        if (deals[i].id === dealId) {
            deal = deals[i];
            break;
        }
    }
    
    if (!deal) return;
    
    if (!canEditDeal(deal)) {
        showToast('error', 'У вас нет прав на удаление этой заявки');
        return;
    }
    
    if (confirm('Вы уверены, что хотите удалить заявку №' + dealId + '?')) {
        var newDeals = [];
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].id !== dealId) newDeals.push(deals[i]);
        }
        deals = newDeals;
        await saveDealsToGitHub();
        renderKanban();
        showToast('success', 'Заявка №' + dealId + ' удалена');
    }
}

async function saveDealsToGitHub() {
    if (!currentUser) return false;
    
    var dealsToSave = [];
    for (var i = 0; i < deals.length; i++) {
        var d = deals[i];
        dealsToSave.push({
            id: d.id,
            complex_id: d.complex_id || '',
            apartment: d.apartment,
            seller_id: d.seller_id || '',
            buyer_id: d.buyer_id || '',
            agent_id: d.agent_id,
            type: d.type,
            status: d.status,
            price_initial: d.price_initial,
            price_current: d.price_current,
            commission: d.commission,
            deadline: d.deadline || '',
            bank: d.bank || '',
            mortgage_approved: d.mortgage_approved ? 'true' : 'false',
            notes: d.notes || '',
            created_at: d.created_at,
            updated_at: d.updated_at
        });
    }
    
    return await window.utils.saveCSVToGitHub(
        'data/deals.csv',
        dealsToSave,
        'Update deals by ' + currentUser.name
    );
}

// ========== КОНТРАГЕНТЫ (быстрое создание) ==========

function openCounterpartyModal(type) {
    document.getElementById('counterpartyType').value = type;
    document.getElementById('counterpartyModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Новый ' + (type === 'seller' ? 'продавец' : 'покупатель');
    document.getElementById('counterpartyModal').classList.add('active');
}

function closeCounterpartyModal() {
    document.getElementById('counterpartyModal').classList.remove('active');
    document.getElementById('counterpartyName').value = '';
    document.getElementById('counterpartyPhone').value = '';
    document.getElementById('counterpartyEmail').value = '';
    document.getElementById('counterpartyNotes').value = '';
}

async function saveCounterparty() {
    var type = document.getElementById('counterpartyType').value;
    var name = document.getElementById('counterpartyName').value.trim();
    var phone = document.getElementById('counterpartyPhone').value.trim();
    var email = document.getElementById('counterpartyEmail').value.trim();
    var personType = document.getElementById('counterpartyPersonType').value;
    var notes = document.getElementById('counterpartyNotes').value.trim();
    
    if (!name) {
        alert('Введите имя/название');
        return;
    }
    
    var maxId = 0;
    for (var i = 0; i < counterparties.length; i++) {
        if (counterparties[i].id > maxId) maxId = counterparties[i].id;
    }
    var newId = maxId + 1;
    
    var newCounterparty = {
        id: newId,
        type: type,
        person_type: personType,
        name: name,
        phone: phone,
        email: email,
        notes: notes,
        created_at: new Date().toISOString().split('T')[0]
    };
    
    counterparties.push(newCounterparty);
    await saveCounterpartiesToGitHub();
    updateCounterpartySelects();
    closeCounterpartyModal();
    showToast('success', 'Контрагент добавлен');
}

async function saveCounterpartiesToGitHub() {
    var dataToSave = [];
    for (var i = 0; i < counterparties.length; i++) {
        var c = counterparties[i];
        dataToSave.push({
            id: c.id,
            type: c.type,
            person_type: c.person_type,
            name: c.name,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
            created_at: c.created_at
        });
    }
    
    return await window.utils.saveCSVToGitHub(
        'data/counterparties.csv',
        dataToSave,
        'Update counterparties by ' + (currentUser ? currentUser.name : 'system')
    );
}

// ========== ФИЛЬТРЫ ==========

function updateAgentFilter() {
    var agentSelect = document.getElementById('agentFilter');
    if (!agentSelect) return;
    
    agentSelect.innerHTML = '<option value="all">Все агенты</option>';
    for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (u.role === 'agent' || u.role === 'manager' || u.role === 'admin') {
            var option = document.createElement('option');
            option.value = u.github_username;
            option.textContent = u.name;
            agentSelect.appendChild(option);
        }
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle') + '"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function init() {
    console.log('[deals.js] === ИНИЦИАЛИЗАЦИЯ ===');
    
    await auth.initAuth();
    currentUser = auth.getCurrentUser();
    console.log('[deals.js] Пользователь:', currentUser ? currentUser.name + ' (' + currentUser.role + ')' : 'не авторизован');
    
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }
    
    await loadComplexesForDeals();
    await loadCounterparties();
    await loadUsersForDeals();
    await loadDeals();
    renderKanban();
    
    // Обработчики фильтров
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', renderKanban);
    
    var typeFilter = document.getElementById('typeFilter');
    if (typeFilter) typeFilter.addEventListener('change', renderKanban);
    
    var agentFilter = document.getElementById('agentFilter');
    if (agentFilter) agentFilter.addEventListener('change', renderKanban);
    
    var addDealBtn = document.getElementById('addDealBtn');
    if (addDealBtn) addDealBtn.addEventListener('click', function() { openDealModal(); });
    
    if (window.theme) window.theme.initTheme();
    if (window.sidebar) window.sidebar.initSidebar();
    
    console.log('[deals.js] === ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
}

document.addEventListener('DOMContentLoaded', init);
