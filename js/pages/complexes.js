/**
 * ============================================
 * ФАЙЛ: js/pages/complexes.js
 * РОЛЬ: Логика страницы управления объектами недвижимости (Supabase версия)
 * 
 * ОСОБЕННОСТИ:
 *   - Карточки объектов с фильтрацией и сортировкой
 *   - Прогресс выполнения задач по объекту
 *   - Публичные/приватные объекты
 *   - Быстрое добавление через панель
 *   - Модальные окна для просмотра и редактирования
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из complexes-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

// Состояние страницы
let complexes = [];
let users = [];
let tasks = [];
let currentUser = null;
let currentSort = 'name';
let sortDirection = 'asc';
let showMyObjectsOnly = false;

console.log('[complexes.js] Модуль загружен');

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

async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
        users = data;
        console.log('[complexes] Загружено пользователей:', users.length);
    }
}

async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', currentUser?.id);
    if (data) {
        tasks = data;
        console.log('[complexes] Загружено задач:', tasks.length);
    }
}

async function loadComplexes() {
    const { data } = await supabase.from('complexes').select('*').eq('user_id', currentUser?.id);
    if (data) {
        complexes = data;
        console.log('[complexes] Загружено объектов:', complexes.length);
        renderComplexes();
    }
}

function getAgentName(assignedTo) {
    const agent = users.find(u => u.github_username === assignedTo);
    return agent ? agent.name : 'Не назначен';
}

function getComplexTasks(complexId) {
    return tasks.filter(t => t.complex_id == complexId);
}

function canEditComplex(complex) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'manager') return true;
    return complex.assigned_to === currentUser.github_username;
}

// ========== РЕНДЕРИНГ ==========

function renderComplexes() {
    const grid = document.getElementById('complexesGrid');
    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const agentFilter = document.getElementById('agentFilter')?.value || 'all';
    
    let filtered = complexes.filter(c => {
        const matchSearch = searchText === '' || c.name.toLowerCase().includes(searchText) || (c.address || '').toLowerCase().includes(searchText);
        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchAgent = agentFilter === 'all' || c.assigned_to === agentFilter;
        const matchMy = !showMyObjectsOnly || c.assigned_to === currentUser?.github_username;
        return matchSearch && matchStatus && matchAgent && matchMy;
    });
    
    filtered.sort((a, b) => {
        let valA, valB;
        if (currentSort === 'name') { valA = a.name; valB = b.name; }
        else if (currentSort === 'price') { valA = parseInt(a.price_from) || 0; valB = parseInt(b.price_from) || 0; }
        else { valA = a.created_at || ''; valB = b.created_at || ''; }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><p>Нет объектов</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(c => {
        const statusClass = c.status === 'active' ? 'status-active' : c.status === 'in_progress' ? 'status-in_progress' : 'status-archived';
        const statusText = c.status === 'active' ? 'Активен' : c.status === 'in_progress' ? 'В работе' : 'Архив';
        const complexTasks = getComplexTasks(c.id);
        const tasksCount = complexTasks.length;
        const tasksDone = complexTasks.filter(t => t.status === 'completed').length;
        const tasksPercent = tasksCount > 0 ? Math.round((tasksDone / tasksCount) * 100) : 0;
        const publicBadge = c.is_public ? '<span class="public-badge"><i class="fas fa-globe"></i> Публичный</span>' : '<span class="private-badge"><i class="fas fa-lock"></i> Приватный</span>';
        const canEdit = canEditComplex(c);
        
        return `<div class="complex-card" onclick="window.openComplexModal('${c.id}')">
            <div class="complex-card-header">
                <div class="complex-card-image"><i class="fas fa-building"></i></div>
                <div class="complex-card-info">
                    <h3>${escapeHtml(c.name)} ${publicBadge}</h3>
                    <div class="complex-address"><i class="fas fa-location-dot"></i> ${escapeHtml(c.address || '—')}</div>
                    <span class="complex-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            <div class="complex-card-body">
                <div class="complex-stats">
                    <div class="complex-stat"><i class="fas fa-industry"></i> ${escapeHtml(c.developer || '—')}</div>
                    <div class="complex-stat"><i class="fas fa-ruble-sign"></i> ${Number(c.price_from || 0).toLocaleString()} - ${Number(c.price_to || 0).toLocaleString()}</div>
                    <div class="complex-stat"><i class="fas fa-user"></i> ${escapeHtml(getAgentName(c.assigned_to))}</div>
                </div>
                <div class="complex-progress">
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem;">
                        <span><i class="fas fa-tasks"></i> Задач: ${tasksCount}</span>
                        <span>${tasksDone} выполнено (${tasksPercent}%)</span>
                    </div>
                    <div class="progress-bar-small"><div class="progress-fill-small" style="width: ${tasksPercent}%;"></div></div>
                </div>
            </div>
            <div class="complex-card-footer">
                <button class="complex-btn" onclick="event.stopPropagation(); window.createTaskForComplex('${c.id}')"><i class="fas fa-plus"></i> Задача</button>
                <button class="complex-btn" onclick="event.stopPropagation(); window.copyComplexLink('${c.id}')"><i class="fas fa-link"></i> Ссылка</button>
                ${canEdit ? `<button class="complex-btn" onclick="event.stopPropagation(); window.editComplex('${c.id}')"><i class="fas fa-edit"></i> Ред.</button>` : ''}
            </div>
        </div>`;
    }).join('');
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        if (btn.dataset.sort === currentSort) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    const myBtn = document.getElementById('myObjectsToggle');
    if (myBtn) myBtn.classList.toggle('active', showMyObjectsOnly);
    
    console.log('[complexes] Отрисовано объектов:', filtered.length);
}

// ========== МОДАЛЬНЫЕ ОКНА ==========

window.openComplexModal = async function(complexId) {
    const complex = complexes.find(c => c.id == complexId);
    if (!complex) return;
    
    const modalBody = document.getElementById('complexModalBody');
    const editBtn = document.getElementById('editComplexBtn');
    const statusText = complex.status === 'active' ? 'Активен' : complex.status === 'in_progress' ? 'В работе' : 'Архив';
    const complexTasks = getComplexTasks(complex.id);
    const publicBadge = complex.is_public ? '<span class="public-badge"><i class="fas fa-globe"></i> Публичный</span>' : '<span class="private-badge"><i class="fas fa-lock"></i> Приватный</span>';
    
    modalBody.innerHTML = `
        <div class="complex-detail-row"><div class="complex-detail-label">Название:</div><div class="complex-detail-value">${escapeHtml(complex.name)} ${publicBadge}</div></div>
        <div class="complex-detail-row"><div class="complex-detail-label">Адрес:</div><div class="complex-detail-value">${escapeHtml(complex.address || '—')}</div></div>
        <div class="complex-detail-row"><div class="complex-detail-label">Застройщик:</div><div class="complex-detail-value">${escapeHtml(complex.developer || '—')}</div></div>
        <div class="complex-detail-row"><div class="complex-detail-label">Цена:</div><div class="complex-detail-value">${Number(complex.price_from || 0).toLocaleString()} - ${Number(complex.price_to || 0).toLocaleString()} ₽</div></div>
        <div class="complex-detail-row"><div class="complex-detail-label">Статус:</div><div class="complex-detail-value">${statusText}</div></div>
        <div class="complex-detail-row"><div class="complex-detail-label">Ответственный:</div><div class="complex-detail-value">${escapeHtml(getAgentName(complex.assigned_to))}</div></div>
        ${complex.description ? `<div class="complex-detail-row"><div class="complex-detail-label">Описание:</div><div class="complex-detail-value">${escapeHtml(complex.description)}</div></div>` : ''}
        <div class="complex-detail-row"><div class="complex-detail-label">Связанные задачи:</div><div class="complex-detail-value tasks-list">${complexTasks.map(t => `<div class="task-item"><span>${escapeHtml(t.title)}</span><span>${t.status === 'completed' ? '✓ Выполнена' : '○ Активна'}</span></div>`).join('') || '<p>Нет задач</p>'}</div></div>
    `;
    
    editBtn.onclick = () => { window.closeComplexModal(); window.editComplex(complex.id); };
    editBtn.style.display = canEditComplex(complex) ? 'block' : 'none';
    document.getElementById('complexModal').classList.add('active');
    console.log('[complexes] Открыта карточка объекта:', complex.name);
};

window.closeComplexModal = function() {
    document.getElementById('complexModal').classList.remove('active');
};

window.closeComplexFormModal = function() {
    document.getElementById('complexFormModal').classList.remove('active');
};

window.editComplex = function(complexId) {
    const complex = complexes.find(c => c.id == complexId);
    if (!complex) return;
    document.getElementById('complexFormTitle').innerHTML = 'Редактировать объект';
    document.getElementById('complexId').value = complex.id;
    document.getElementById('complexTitle').value = complex.name;
    document.getElementById('complexAddress').value = complex.address || '';
    document.getElementById('complexDeveloper').value = complex.developer || '';
    document.getElementById('complexPriceFrom').value = complex.price_from || '';
    document.getElementById('complexPriceTo').value = complex.price_to || '';
    document.getElementById('complexStatus').value = complex.status;
    document.getElementById('complexAssignee').value = complex.assigned_to || '';
    document.getElementById('complexCoordinates').value = complex.coordinates || '';
    document.getElementById('complexDescription').value = complex.description || '';
    document.getElementById('complexPublic').checked = complex.is_public;
    document.getElementById('complexFormModal').classList.add('active');
    console.log('[complexes] Открыта форма редактирования:', complex.name);
};

window.saveComplex = async function() {
    const id = document.getElementById('complexId').value;
    const data = {
        name: document.getElementById('complexTitle').value,
        address: document.getElementById('complexAddress').value,
        developer: document.getElementById('complexDeveloper').value,
        price_from: parseInt(document.getElementById('complexPriceFrom').value) || 0,
        price_to: parseInt(document.getElementById('complexPriceTo').value) || 0,
        status: document.getElementById('complexStatus').value,
        assigned_to: document.getElementById('complexAssignee').value,
        coordinates: document.getElementById('complexCoordinates').value,
        description: document.getElementById('complexDescription').value,
        is_public: document.getElementById('complexPublic').checked,
        user_id: currentUser.id
    };
    if (!data.name || !data.address) { alert('Заполните название и адрес'); return; }
    
    console.log('[complexes] Сохранение объекта:', id || 'новый', data.name);
    
    let error;
    if (id) {
        const result = await supabase.from('complexes').update(data).eq('id', id);
        error = result.error;
    } else {
        const result = await supabase.from('complexes').insert([data]);
        error = result.error;
    }
    if (!error) {
        window.closeComplexFormModal();
        await loadComplexes();
        showToast('success', id ? 'Объект обновлен' : 'Объект создан');
    } else {
        console.error('[complexes] Ошибка сохранения:', error);
        alert('Ошибка сохранения');
    }
};

window.createTaskForComplex = (complexId) => {
    console.log('[complexes] Создание задачи для объекта:', complexId);
    window.location.href = `tasks-supabase.html?complex=${complexId}`;
};

window.copyComplexLink = (complexId) => {
    const url = `${window.location.origin}${window.location.pathname}?complex=${complexId}`;
    navigator.clipboard.writeText(url);
    showToast('success', 'Ссылка скопирована');
};

// ========== ОБНОВЛЕНИЕ UI ==========

function updateFiltersUI() {
    const agentSelect = document.getElementById('agentFilter');
    if (agentSelect) {
        agentSelect.innerHTML = '<option value="all">Все агенты</option>';
        users.forEach(u => { if (u.role === 'agent' || u.role === 'manager') agentSelect.innerHTML += `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`; });
    }
    const quickAssignee = document.getElementById('quickAssignee');
    if (quickAssignee) {
        quickAssignee.innerHTML = '<option value="">Ответственный агент</option>';
        users.forEach(u => { if (u.role === 'agent' || u.role === 'manager') quickAssignee.innerHTML += `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`; });
    }
    const assigneeSelect = document.getElementById('complexAssignee');
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Ответственный агент</option>';
        users.forEach(u => { if (u.role === 'agent' || u.role === 'manager') assigneeSelect.innerHTML += `<option value="${u.github_username}">${escapeHtml(u.name)}</option>`; });
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initComplexesPage() {
    console.log('[complexes] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[complexes] Текущий пользователь:', currentUser?.name, 'роль:', currentUser?.role);
    
    await loadUsers();
    await loadTasks();
    await loadComplexes();
    updateFiltersUI();
    
    document.getElementById('addComplexBtn').addEventListener('click', () => {
        document.getElementById('complexFormTitle').innerHTML = 'Новый объект';
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
        document.getElementById('complexPublic').checked = true;
        document.getElementById('complexFormModal').classList.add('active');
        console.log('[complexes] Открыта форма создания объекта');
    });
    
    document.getElementById('quickSaveBtn')?.addEventListener('click', async () => {
        const data = {
            name: document.getElementById('quickTitle').value,
            address: document.getElementById('quickAddress').value,
            assigned_to: document.getElementById('quickAssignee').value,
            price_from: parseInt(document.getElementById('quickPriceFrom').value) || 0,
            price_to: parseInt(document.getElementById('quickPriceTo').value) || 0,
            status: 'active',
            is_public: true,
            user_id: currentUser.id
        };
        if (!data.name || !data.address) { alert('Заполните название и адрес'); return; }
        const { error } = await supabase.from('complexes').insert([data]);
        if (!error) {
            document.getElementById('quickTitle').value = '';
            document.getElementById('quickAddress').value = '';
            document.getElementById('quickPriceFrom').value = '';
            document.getElementById('quickPriceTo').value = '';
            document.getElementById('quickAddPanel').classList.remove('active');
            await loadComplexes();
            showToast('success', 'Объект создан');
            console.log('[complexes] Объект создан через быструю панель');
        } else {
            console.error('[complexes] Ошибка быстрого создания:', error);
            alert('Ошибка сохранения');
        }
    });
    
    document.getElementById('searchInput')?.addEventListener('input', renderComplexes);
    document.getElementById('statusFilter')?.addEventListener('change', renderComplexes);
    document.getElementById('agentFilter')?.addEventListener('change', renderComplexes);
    document.getElementById('myObjectsToggle')?.addEventListener('click', () => { 
        showMyObjectsOnly = !showMyObjectsOnly; 
        renderComplexes();
        console.log('[complexes] Фильтр "Мои объекты":', showMyObjectsOnly);
    });
    document.querySelectorAll('.sort-btn').forEach(btn => btn.addEventListener('click', () => {
        if (currentSort === btn.dataset.sort) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        else { currentSort = btn.dataset.sort; sortDirection = 'asc'; }
        renderComplexes();
        console.log('[complexes] Сортировка:', currentSort, sortDirection);
    }));
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[complexes] Анимации инициализированы');
    }
    
    console.log('[complexes] Инициализация завершена');
}