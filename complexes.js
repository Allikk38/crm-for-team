// complexes.js - управление объектами недвижимости

let complexes = [];
let allUsers = [];
let tasks = [];
let currentUser = null;

// Загрузка данных
async function loadComplexesData() {
    try {
        complexes = await loadCSV('data/complexes.csv');
        complexes = complexes.map(function(complex) {
            return {
                id: parseInt(complex.id),
                title: complex.title || '',
                address: complex.address || '',
                developer: complex.developer || '',
                price_from: complex.price_from || '0',
                price_to: complex.price_to || '0',
                status: complex.status || 'active',
                assigned_to: complex.assigned_to || '',
                coordinates: complex.coordinates || '',
                description: complex.description || '',
                documents: complex.documents || '[]',
                created_at: complex.created_at || '',
                updated_at: complex.updated_at || ''
            };
        });
        
        allUsers = await loadCSV('data/users.csv');
        tasks = await loadCSV('data/tasks.csv');
        
        console.log('Загружено объектов:', complexes.length);
        
        renderComplexes();
        updateFilters();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        var grid = document.getElementById('complexesGrid');
        if (grid) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки данных</p></div>';
        }
    }
}

// Рендер списка объектов
function renderComplexes() {
    var grid = document.getElementById('complexesGrid');
    if (!grid) return;
    
    var searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    var statusFilter = document.getElementById('statusFilter')?.value || 'all';
    var agentFilter = document.getElementById('agentFilter')?.value || 'all';
    
    var filtered = complexes.filter(function(complex) {
        var matchSearch = searchText === '' || 
            complex.title.toLowerCase().includes(searchText) || 
            complex.address.toLowerCase().includes(searchText);
        var matchStatus = statusFilter === 'all' || complex.status === statusFilter;
        var matchAgent = agentFilter === 'all' || complex.assigned_to === agentFilter;
        return matchSearch && matchStatus && matchAgent;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><p>Нет объектов</p><p style="font-size: 0.8rem;">Добавьте первый объект</p></div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var complex = filtered[i];
        var statusClass = '';
        var statusText = '';
        
        if (complex.status === 'active') {
            statusClass = 'status-active';
            statusText = 'Активен';
        } else if (complex.status === 'in_progress') {
            statusClass = 'status-in_progress';
            statusText = 'В работе';
        } else {
            statusClass = 'status-archived';
            statusText = 'Архив';
        }
        
        var agent = allUsers.find(function(u) { return u.github_username === complex.assigned_to; });
        var agentName = agent ? agent.name : 'Не назначен';
        
        var priceFrom = parseInt(complex.price_from).toLocaleString();
        var priceTo = parseInt(complex.price_to).toLocaleString();
        
        var complexTasks = tasks.filter(function(t) { return t.complex_id && parseInt(t.complex_id) === complex.id; });
        var tasksCount = complexTasks.length;
        var tasksDone = complexTasks.filter(function(t) { return t.status === 'done'; }).length;
        
        html += '<div class="complex-card" onclick="openComplexModal(' + complex.id + ')">' +
            '<div class="complex-card-header">' +
                '<h3>' + escapeHtml(complex.title) + '</h3>' +
                '<span class="complex-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="complex-card-body">' +
                '<div class="complex-info-row"><i class="fas fa-location-dot"></i> ' + escapeHtml(complex.address) + '</div>' +
                '<div class="complex-info-row"><i class="fas fa-industry"></i> ' + escapeHtml(complex.developer) + '</div>' +
                '<div class="complex-info-row"><i class="fas fa-user"></i> ' + escapeHtml(agentName) + '</div>' +
                '<div class="complex-price">💰 ' + priceFrom + ' - ' + priceTo + ' ₽</div>' +
                '<div class="complex-info-row" style="margin-top: 12px;"><i class="fas fa-tasks"></i> Задач: ' + tasksCount + ' (' + tasksDone + ' выполнено)</div>' +
            '</div>' +
            '<div class="complex-card-footer">' +
                '<button class="complex-btn" onclick="event.stopPropagation(); openComplexTasks(' + complex.id + ')"><i class="fas fa-list"></i> Задачи</button>' +
                '<button class="complex-btn" onclick="event.stopPropagation(); openMapForComplex(' + complex.id + ')"><i class="fas fa-map"></i> Карта</button>' +
                '<button class="complex-btn" data-role="admin,manager" onclick="event.stopPropagation(); editComplex(' + complex.id + ')"><i class="fas fa-edit"></i> Ред.</button>' +
            '</div>' +
        '</div>';
    }
    
    grid.innerHTML = html;
    
    // Скрываем кнопки редактирования для не-админов
    var currentUserRole = currentUser ? currentUser.role : null;
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        var editBtns = grid.querySelectorAll('[data-role="admin,manager"]');
        for (var b = 0; b < editBtns.length; b++) {
            editBtns[b].style.display = 'none';
        }
    }
}

// Обновление фильтров
function updateFilters() {
    var agentSelect = document.getElementById('agentFilter');
    if (!agentSelect) return;
    
    var agents = allUsers.filter(function(u) { return u.role === 'agent' || u.role === 'manager' || u.role === 'admin'; });
    
    agentSelect.innerHTML = '<option value="all">Все агенты</option>';
    for (var i = 0; i < agents.length; i++) {
        var option = document.createElement('option');
        option.value = agents[i].github_username;
        option.textContent = agents[i].name;
        agentSelect.appendChild(option);
    }
}

// Открыть карточку объекта
async function openComplexModal(complexId) {
    var complex = complexes.find(function(c) { return c.id === complexId; });
    if (!complex) return;
    
    var modal = document.getElementById('complexModal');
    var modalBody = document.getElementById('complexModalBody');
    var editBtn = document.getElementById('editComplexBtn');
    
    var agent = allUsers.find(function(u) { return u.github_username === complex.assigned_to; });
    var agentName = agent ? agent.name : 'Не назначен';
    
    var statusText = '';
    if (complex.status === 'active') statusText = 'Активен';
    else if (complex.status === 'in_progress') statusText = 'В работе';
    else statusText = 'Архив';
    
    var complexTasks = tasks.filter(function(t) { return t.complex_id && parseInt(t.complex_id) === complex.id; });
    var tasksHtml = '';
    for (var i = 0; i < complexTasks.length; i++) {
        var task = complexTasks[i];
        tasksHtml += '<div class="task-item">' +
            '<span>' + escapeHtml(task.title) + '</span>' +
            '<span class="task-priority priority-' + task.priority + '">' + getPriorityText(task.priority) + '</span>' +
        '</div>';
    }
    
    modalBody.innerHTML = '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Название:</div>' +
        '<div class="complex-detail-value">' + escapeHtml(complex.title) + '</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Адрес:</div>' +
        '<div class="complex-detail-value">' + escapeHtml(complex.address) + '</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Застройщик:</div>' +
        '<div class="complex-detail-value">' + escapeHtml(complex.developer) + '</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Цена:</div>' +
        '<div class="complex-detail-value">' + parseInt(complex.price_from).toLocaleString() + ' - ' + parseInt(complex.price_to).toLocaleString() + ' ₽</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Статус:</div>' +
        '<div class="complex-detail-value">' + statusText + '</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Ответственный:</div>' +
        '<div class="complex-detail-value">' + escapeHtml(agentName) + '</div>' +
    '</div>' +
    (complex.coordinates ? '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Координаты:</div>' +
        '<div class="complex-detail-value">' + escapeHtml(complex.coordinates) + '</div>' +
    '</div>' : '') +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Описание:</div>' +
        '<div class="complex-detail-value">' + (complex.description || '—') + '</div>' +
    '</div>' +
    '<div class="complex-detail-row">' +
        '<div class="complex-detail-label">Связанные задачи:</div>' +
        '<div class="complex-detail-value tasks-list">' + (tasksHtml || '<p>Нет задач</p>') + '</div>' +
    '</div>';
    
    modal.classList.add('active');
    
    editBtn.onclick = function() { 
        closeComplexModal();
        editComplex(complexId);
    };
    
    var currentUserRole = currentUser ? currentUser.role : null;
    editBtn.style.display = (currentUserRole === 'admin' || currentUserRole === 'manager') ? 'block' : 'none';
}

// Редактирование объекта
function editComplex(complexId) {
    var complex = complexes.find(function(c) { return c.id === complexId; });
    if (!complex) return;
    
    document.getElementById('complexFormTitle').innerHTML = '<i class="fas fa-edit"></i> Редактировать объект';
    document.getElementById('complexId').value = complex.id;
    document.getElementById('complexTitle').value = complex.title;
    document.getElementById('complexAddress').value = complex.address;
    document.getElementById('complexDeveloper').value = complex.developer;
    document.getElementById('complexPriceFrom').value = complex.price_from;
    document.getElementById('complexPriceTo').value = complex.price_to;
    document.getElementById('complexStatus').value = complex.status;
    document.getElementById('complexAssignee').value = complex.assigned_to;
    document.getElementById('complexCoordinates').value = complex.coordinates;
    document.getElementById('complexDescription').value = complex.description;
    
    document.getElementById('complexFormModal').classList.add('active');
}

// Создание нового объекта
function openAddComplexModal() {
    document.getElementById('complexFormTitle').innerHTML = '<i class="fas fa-plus"></i> Новый объект';
    document.getElementById('complexId').value = '';
    document.getElementById('complexTitle').value = '';
    document.getElementById('complexAddress').value = '';
    document.getElementById('complexDeveloper').value = '';
    document.getElementById('complexPriceFrom').value = '';
    document.getElementById('complexPriceTo').value = '';
    document.getElementById('complexStatus').value = 'active';
    document.getElementById('complexAssignee').value = '';
    document.getElementById('complexCoordinates').value = '';
    document.getElementById('complexDescription').value = '';
    
    document.getElementById('complexFormModal').classList.add('active');
}

// Сохранение объекта
async function saveComplex() {
    var id = document.getElementById('complexId').value;
    var complexData = {
        id: id ? parseInt(id) : null,
        title: document.getElementById('complexTitle').value,
        address: document.getElementById('complexAddress').value,
        developer: document.getElementById('complexDeveloper').value,
        price_from: document.getElementById('complexPriceFrom').value || '0',
        price_to: document.getElementById('complexPriceTo').value || '0',
        status: document.getElementById('complexStatus').value,
        assigned_to: document.getElementById('complexAssignee').value,
        coordinates: document.getElementById('complexCoordinates').value,
        description: document.getElementById('complexDescription').value,
        documents: '[]',
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0]
    };
    
    if (!complexData.title || !complexData.address) {
        alert('Заполните название и адрес');
        return;
    }
    
    if (id) {
        var index = complexes.findIndex(function(c) { return c.id === parseInt(id); });
        if (index !== -1) {
            complexData.id = parseInt(id);
            complexData.created_at = complexes[index].created_at;
            complexes[index] = complexData;
        }
    } else {
        var newId = complexes.length > 0 ? Math.max.apply(null, complexes.map(function(c) { return c.id; })) + 1 : 1;
        complexData.id = newId;
        complexes.push(complexData);
    }
    
    var saved = await saveComplexesToGitHub();
    
    if (saved) {
        closeComplexFormModal();
        renderComplexes();
        showToast('success', id ? 'Объект обновлён' : 'Объект создан');
    } else {
        alert('Ошибка сохранения');
    }
}

// Сохранение в GitHub
async function saveComplexesToGitHub() {
    var currentUserAuth = auth.getCurrentUser();
    if (!currentUserAuth || !auth.hasPermission('edit')) {
        alert('У вас нет прав на редактирование');
        return false;
    }
    
    var complexesToSave = complexes.map(function(complex) {
        return {
            id: complex.id,
            title: complex.title,
            address: complex.address,
            developer: complex.developer,
            price_from: complex.price_from,
            price_to: complex.price_to,
            status: complex.status,
            assigned_to: complex.assigned_to,
            coordinates: complex.coordinates,
            description: complex.description,
            documents: complex.documents,
            created_at: complex.created_at,
            updated_at: complex.updated_at
        };
    });
    
    return await window.utils.saveCSVToGitHub(
        'data/complexes.csv',
        complexesToSave,
        'Update complexes by ' + currentUserAuth.name
    );
}

// Показать задачи объекта
function openComplexTasks(complexId) {
    window.location.href = 'tasks.html?complex=' + complexId;
}

// Открыть карту (из realty-search)
function openMapForComplex(complexId) {
    var complex = complexes.find(function(c) { return c.id === complexId; });
    if (complex && complex.coordinates) {
        var coords = complex.coordinates.split(',');
        window.open('https://maps.google.com/?q=' + coords[0] + ',' + coords[1], '_blank');
    } else {
        alert('Координаты не заданы');
    }
}

function getPriorityText(priority) {
    var priorities = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    return priorities[priority] || priority;
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle') + '"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

function closeComplexModal() {
    document.getElementById('complexModal').classList.remove('active');
}

function closeComplexFormModal() {
    document.getElementById('complexFormModal').classList.remove('active');
}

// Инициализация
async function init() {
    await auth.initAuth();
    currentUser = auth.getCurrentUser();
    
    if (currentUser) {
        var userNameSpan = document.getElementById('userName');
        if (userNameSpan) {
            var roleLabel = '';
            if (currentUser.role === 'admin') roleLabel = 'Администратор';
            else if (currentUser.role === 'manager') roleLabel = 'Менеджер';
            else if (currentUser.role === 'agent') roleLabel = 'Агент';
            else roleLabel = 'Наблюдатель';
            userNameSpan.innerHTML = '<i class="fab fa-github"></i> ' + escapeHtml(currentUser.name) + ' (' + roleLabel + ')';
        }
    }
    
    // Заполняем выпадающий список агентов в форме
    var users = await loadCSV('data/users.csv');
    var assigneeSelect = document.getElementById('complexAssignee');
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Не назначен</option>';
        for (var i = 0; i < users.length; i++) {
            if (users[i].role === 'agent' || users[i].role === 'manager' || users[i].role === 'admin') {
                var option = document.createElement('option');
                option.value = users[i].github_username;
                option.textContent = users[i].name + ' (' + users[i].role + ')';
                assigneeSelect.appendChild(option);
            }
        }
    }
    
    await loadComplexesData();
    window.theme.initTheme();
    
    document.getElementById('addComplexBtn')?.addEventListener('click', openAddComplexModal);
    document.getElementById('searchInput')?.addEventListener('input', renderComplexes);
    document.getElementById('statusFilter')?.addEventListener('change', renderComplexes);
    document.getElementById('agentFilter')?.addEventListener('change', renderComplexes);
}

document.addEventListener('DOMContentLoaded', init);
