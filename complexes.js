// complexes.js - управление объектами недвижимости

var complexes = [];
var allUsers = [];
var tasks = [];
var currentUser = null;

// Загрузка данных
async function loadComplexesData() {
    console.log('loadComplexesData started');
    
    try {
        var tasksData = await loadCSV('data/tasks.csv');
        tasks = tasksData || [];
        
        var complexesData = await loadCSV('data/complexes.csv');
        console.log('Complexes loaded:', complexesData ? complexesData.length : 0);
        
        complexes = [];
        if (complexesData && complexesData.length > 0) {
            for (var i = 0; i < complexesData.length; i++) {
                var c = complexesData[i];
                complexes.push({
                    id: parseInt(c.id),
                    title: c.title || '',
                    address: c.address || '',
                    developer: c.developer || '',
                    price_from: c.price_from || '0',
                    price_to: c.price_to || '0',
                    status: c.status || 'active',
                    assigned_to: c.assigned_to || '',
                    coordinates: c.coordinates || '',
                    description: c.description || '',
                    documents: c.documents || '[]',
                    created_at: c.created_at || '',
                    updated_at: c.updated_at || ''
                });
            }
        }
        
        allUsers = await loadCSV('data/users.csv');
        console.log('Users loaded:', allUsers ? allUsers.length : 0);
        
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
    
    var searchInput = document.getElementById('searchInput');
    var searchText = searchInput ? searchInput.value.toLowerCase() : '';
    var statusFilter = document.getElementById('statusFilter');
    var statusValue = statusFilter ? statusFilter.value : 'all';
    var agentFilter = document.getElementById('agentFilter');
    var agentValue = agentFilter ? agentFilter.value : 'all';
    
    var filtered = [];
    for (var i = 0; i < complexes.length; i++) {
        var complex = complexes[i];
        var matchSearch = searchText === '' || 
            complex.title.toLowerCase().indexOf(searchText) !== -1 || 
            complex.address.toLowerCase().indexOf(searchText) !== -1;
        var matchStatus = statusValue === 'all' || complex.status === statusValue;
        var matchAgent = agentValue === 'all' || complex.assigned_to === agentValue;
        
        if (matchSearch && matchStatus && matchAgent) {
            filtered.push(complex);
        }
    }
    
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
        
        var agent = null;
        for (var u = 0; u < allUsers.length; u++) {
            if (allUsers[u].github_username === complex.assigned_to) {
                agent = allUsers[u];
                break;
            }
        }
        var agentName = agent ? agent.name : 'Не назначен';
        
        var priceFrom = parseInt(complex.price_from).toLocaleString();
        var priceTo = parseInt(complex.price_to).toLocaleString();
        
        var complexTasks = [];
        for (var t = 0; t < tasks.length; t++) {
            if (tasks[t].complex_id && parseInt(tasks[t].complex_id) === complex.id) {
                complexTasks.push(tasks[t]);
            }
        }
        var tasksCount = complexTasks.length;
        var tasksDone = 0;
        for (var d = 0; d < complexTasks.length; d++) {
            if (complexTasks[d].status === 'done') tasksDone++;
        }
        
        html += '<div class="complex-card" onclick="openComplexModal(' + complex.id + ')">' +
            '<div class="complex-card-header">' +
                '<h3>' + escapeHtml(complex.title) + '</h3>' +
                '<span class="complex-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="complex-card-body">' +
                '<div class="complex-info-row"><i class="fas fa-location-dot"></i> ' + escapeHtml(complex.address) + '</div>' +
                '<div class="complex-info-row"><i class="fas fa-industry"></i> ' + escapeHtml(complex.developer) + '</div>' +
                '<div class="complex-info-row"><i class="fas fa-user"></i> ' + escapeHtml(agentName) + '</div>' +
                '<div class="complex-price"><i class="fas fa-ruble-sign"></i> ' + priceFrom + ' - ' + priceTo + '</div>' +
                '<div class="complex-info-row" style="margin-top: 12px;"><i class="fas fa-tasks"></i> Задач: ' + tasksCount + ' (' + tasksDone + ' выполнено)</div>' +
            '</div>' +
            '<div class="complex-card-footer">' +
                '<button class="complex-btn" onclick="event.stopPropagation(); openComplexTasks(' + complex.id + ')"><i class="fas fa-list"></i> Задачи</button>' +
                '<button class="complex-btn" onclick="event.stopPropagation(); openMapForComplex(' + complex.id + ')"><i class="fas fa-map"></i> Карта</button>';
        
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
            html += '<button class="complex-btn" onclick="event.stopPropagation(); editComplex(' + complex.id + ')"><i class="fas fa-edit"></i> Ред.</button>';
        }
        
        html += '</div></div>';
    }
    
    grid.innerHTML = html;
}

// Обновление фильтров
function updateFilters() {
    var agentSelect = document.getElementById('agentFilter');
    if (!agentSelect) return;
    
    agentSelect.innerHTML = '<option value="all">Все агенты</option>';
    for (var i = 0; i < allUsers.length; i++) {
        var user = allUsers[i];
        if (user.role === 'agent' || user.role === 'manager' || user.role === 'admin') {
            var option = document.createElement('option');
            option.value = user.github_username;
            option.textContent = user.name;
            agentSelect.appendChild(option);
        }
    }
}

// Открыть карточку объекта
async function openComplexModal(complexId) {
    var complex = null;
    for (var i = 0; i < complexes.length; i++) {
        if (complexes[i].id === complexId) {
            complex = complexes[i];
            break;
        }
    }
    if (!complex) return;
    
    var modal = document.getElementById('complexModal');
    var modalBody = document.getElementById('complexModalBody');
    var editBtn = document.getElementById('editComplexBtn');
    
    var agent = null;
    for (var u = 0; u < allUsers.length; u++) {
        if (allUsers[u].github_username === complex.assigned_to) {
            agent = allUsers[u];
            break;
        }
    }
    var agentName = agent ? agent.name : 'Не назначен';
    
    var statusText = '';
    if (complex.status === 'active') statusText = 'Активен';
    else if (complex.status === 'in_progress') statusText = 'В работе';
    else statusText = 'Архив';
    
    var complexTasks = [];
    for (var t = 0; t < tasks.length; t++) {
        if (tasks[t].complex_id && parseInt(tasks[t].complex_id) === complex.id) {
            complexTasks.push(tasks[t]);
        }
    }
    
    var tasksHtml = '';
    for (var i = 0; i < complexTasks.length; i++) {
        var task = complexTasks[i];
        tasksHtml += '<div class="task-item">' +
            '<span>' + escapeHtml(task.title) + '</span>' +
            '<span class="task-priority priority-' + task.priority + '">' + getPriorityText(task.priority) + '</span>' +
        '</div>';
    }
    
    modalBody.innerHTML = 
        '<div class="complex-detail-row">' +
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
    
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
        editBtn.style.display = 'block';
    } else {
        editBtn.style.display = 'none';
    }
}

function getPriorityText(priority) {
    var priorities = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    return priorities[priority] || priority;
}

function editComplex(complexId) {
    var complex = null;
    for (var i = 0; i < complexes.length; i++) {
        if (complexes[i].id === complexId) {
            complex = complexes[i];
            break;
        }
    }
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
        var index = -1;
        for (var i = 0; i < complexes.length; i++) {
            if (complexes[i].id === parseInt(id)) {
                index = i;
                break;
            }
        }
        if (index !== -1) {
            complexData.id = parseInt(id);
            complexData.created_at = complexes[index].created_at;
            complexes[index] = complexData;
        }
    } else {
        var newId = 1;
        for (var i = 0; i < complexes.length; i++) {
            if (complexes[i].id >= newId) newId = complexes[i].id + 1;
        }
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

async function saveComplexesToGitHub() {
    var currentUserAuth = auth.getCurrentUser();
    if (!currentUserAuth || !auth.hasPermission('edit')) {
        alert('У вас нет прав на редактирование');
        return false;
    }
    
    var complexesToSave = [];
    for (var i = 0; i < complexes.length; i++) {
        var c = complexes[i];
        complexesToSave.push({
            id: c.id,
            title: c.title,
            address: c.address,
            developer: c.developer,
            price_from: c.price_from,
            price_to: c.price_to,
            status: c.status,
            assigned_to: c.assigned_to,
            coordinates: c.coordinates,
            description: c.description,
            documents: c.documents,
            created_at: c.created_at,
            updated_at: c.updated_at
        });
    }
    
    return await window.utils.saveCSVToGitHub(
        'data/complexes.csv',
        complexesToSave,
        'Update complexes by ' + currentUserAuth.name
    );
}

function openComplexTasks(complexId) {
    window.location.href = 'tasks.html?complex=' + complexId;
}

function openMapForComplex(complexId) {
    var complex = null;
    for (var i = 0; i < complexes.length; i++) {
        if (complexes[i].id === complexId) {
            complex = complexes[i];
            break;
        }
    }
    if (complex && complex.coordinates) {
        var coords = complex.coordinates.split(',');
        window.open('https://maps.google.com/?q=' + coords[0] + ',' + coords[1], '_blank');
    } else {
        alert('Координаты не заданы');
    }
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
    console.log('complexes.js init started');
    
    await auth.initAuth();
    currentUser = auth.getCurrentUser();
    console.log('Current user:', currentUser);
    
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
    
    if (window.theme) window.theme.initTheme();
    
    var addBtn = document.getElementById('addComplexBtn');
    if (addBtn) addBtn.addEventListener('click', openAddComplexModal);
    
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', renderComplexes);
    
    var statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', renderComplexes);
    
    var agentFilter = document.getElementById('agentFilter');
    if (agentFilter) agentFilter.addEventListener('change', renderComplexes);
    
    console.log('complexes.js init completed');
}

document.addEventListener('DOMContentLoaded', init);
