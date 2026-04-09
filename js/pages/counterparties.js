/**
 * ============================================
 * ФАЙЛ: js/pages/counterparties.js
 * РОЛЬ: Логика страницы управления контрагентами (Supabase версия)
 * 
 * ОСОБЕННОСТИ:
 *   - Использует Supabase для хранения данных
 *   - Фильтрация по типу и типу лица
 *   - CRUD операции с контрагентами
 *   - Связанные сделки
 *   - Экспорт в CSV
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла
 *   - 09.04.2026: Переход с role на permission_sets
 *   - 09.04.2026: Убраны глобальные функции, переход на addEventListener
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { 
    isAdmin, 
    canViewAllCounterparties, 
    canEditAllCounterparties,
    canCreateCounterparties,
    canExportCounterparties,
    hasPermission 
} from '../core/permissions.js';

// Состояние страницы
let counterparties = [];
let deals = [];
let currentUser = null;

// Типы контрагентов для отображения
const COUNTERPARTY_TYPES = {
    seller: { name: 'Продавец', icon: '🏠', class: 'type-seller' },
    buyer: { name: 'Покупатель', icon: '👤', class: 'type-buyer' },
    developer: { name: 'Застройщик', icon: '🏗️', class: 'type-developer' },
    investor: { name: 'Инвестор', icon: '💼', class: 'type-investor' }
};

console.log('[counterparties.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(obj => headers.map(header => {
            let value = obj[header] || '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        }).join(','))
    ];
    return rows.join('\n');
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadCounterparties() {
    const { data, error } = await supabase
        .from('counterparties')
        .select('*')
        .eq('user_id', currentUser.id);
    
    if (!error && data) {
        counterparties = data;
        console.log(`[counterparties] Загружено ${counterparties.length} контрагентов`);
    } else {
        console.error('[counterparties] Ошибка загрузки:', error);
        counterparties = [];
    }
}

async function loadDeals() {
    const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', currentUser.id);
    
    if (!error && data) {
        deals = data;
        console.log(`[counterparties] Загружено ${deals.length} сделок`);
    } else {
        deals = [];
    }
}

function getDealsByCounterparty(counterpartyId) {
    return deals.filter(d => 
        d.seller_id == counterpartyId || 
        d.buyer_id == counterpartyId
    );
}

function filterByPermissions(list) {
    if (!currentUser) return [];
    
    // Админ или менеджер (с правом просмотра всех) видят всё
    if (isAdmin() || canViewAllCounterparties()) return list;
    
    // Агент видит только контрагентов из своих сделок
    if (hasPermission('view_own_deals')) {
        const agentDeals = deals.filter(d => d.agent_id === currentUser.github_username);
        const counterpartyIds = new Set();
        agentDeals.forEach(d => {
            if (d.seller_id) counterpartyIds.add(d.seller_id);
            if (d.buyer_id) counterpartyIds.add(d.buyer_id);
        });
        return list.filter(c => counterpartyIds.has(c.id));
    }
    
    return [];
}

function canEditCounterparty(counterparty) {
    if (!currentUser) return false;
    if (isAdmin() || canEditAllCounterparties()) return true;
    // Агент может редактировать только своих контрагентов (из своих сделок)
    const agentDeals = deals.filter(d => d.agent_id === currentUser.github_username);
    return agentDeals.some(d => d.seller_id == counterparty.id || d.buyer_id == counterparty.id);
}

function canDeleteCounterparty(counterparty) {
    // Только админ или менеджер с правами могут удалять
    return isAdmin() || canEditAllCounterparties();
}

// ========== РЕНДЕРИНГ КАРТОЧЕК ==========

function renderCounterparties() {
    const grid = document.getElementById('counterpartiesGrid');
    if (!grid) return;
    
    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const personTypeFilter = document.getElementById('personTypeFilter')?.value || 'all';
    
    let filtered = filterByPermissions(counterparties);
    
    filtered = filtered.filter(c => {
        const matchSearch = searchText === '' ||
            c.name.toLowerCase().includes(searchText) ||
            (c.phone && c.phone.includes(searchText)) ||
            (c.email && c.email.toLowerCase().includes(searchText));
        const matchType = typeFilter === 'all' || c.type === typeFilter;
        const matchPersonType = personTypeFilter === 'all' || c.person_type === personTypeFilter;
        return matchSearch && matchType && matchPersonType;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет контрагентов</p><p style="font-size: 0.8rem;">Добавьте первого контрагента</p></div>';
        return;
    }
    
    let html = '';
    for (const c of filtered) {
        const typeInfo = COUNTERPARTY_TYPES[c.type] || COUNTERPARTY_TYPES.seller;
        const relatedDeals = getDealsByCounterparty(c.id);
        const dealsCount = relatedDeals.length;
        const activeDeals = relatedDeals.filter(d => d.status !== 'closed' && d.status !== 'cancelled').length;
        const avatarText = getInitials(c.name);
        const canEdit = canEditCounterparty(c);
        const canDelete = canDeleteCounterparty(c);
        
        html += `
            <div class="counterparty-card" data-counterparty-id="${c.id}">
                <div class="counterparty-card-header">
                    <div class="counterparty-avatar">
                        ${c.person_type === 'legal' ? '<i class="fas fa-building"></i>' : avatarText}
                    </div>
                    <div class="counterparty-info">
                        <h3>
                            ${escapeHtml(c.name)}
                            <span class="counterparty-type ${typeInfo.class}">${typeInfo.icon} ${typeInfo.name}</span>
                        </h3>
                        <div class="counterparty-contacts">
                            ${c.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(c.phone)}</span>` : ''}
                            ${c.email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(c.email)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="counterparty-card-body">
                    <div class="counterparty-stats">
                        <div class="counterparty-stat"><i class="fas fa-handshake"></i> Сделок: ${dealsCount}</div>
                        <div class="counterparty-stat"><i class="fas fa-play-circle"></i> Активных: ${activeDeals}</div>
                        ${c.telegram ? '<div class="counterparty-stat"><i class="fab fa-telegram"></i> Telegram</div>' : ''}
                        ${c.whatsapp ? '<div class="counterparty-stat"><i class="fab fa-whatsapp"></i> WhatsApp</div>' : ''}
                    </div>
                    ${c.notes ? `<div class="counterparty-notes"><i class="fas fa-sticky-note"></i> ${escapeHtml(c.notes.substring(0, 80))}${c.notes.length > 80 ? '...' : ''}</div>` : ''}
                </div>
                <div class="counterparty-card-footer">
                    ${canEdit ? `<button class="counterparty-btn edit-counterparty-btn" data-id="${c.id}"><i class="fas fa-edit"></i> Редактировать</button>` : ''}
                    <button class="counterparty-btn create-deal-btn" data-id="${c.id}" data-type="${c.type}"><i class="fas fa-handshake"></i> Создать сделку</button>
                    ${canDelete ? `<button class="counterparty-btn delete-counterparty-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}"><i class="fas fa-trash"></i> Удалить</button>` : ''}
                </div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // Навешиваем обработчики
    attachCardHandlers();
    
    console.log('[counterparties] Отрисовано контрагентов:', filtered.length);
}

function attachCardHandlers() {
    // Открытие карточки
    document.querySelectorAll('.counterparty-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.counterparty-btn')) return;
            const id = card.dataset.counterpartyId;
            openCounterpartyModal(id);
        });
    });
    
    // Редактирование
    document.querySelectorAll('.edit-counterparty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            openCounterpartyModal(id);
        });
    });
    
    // Создание сделки
    document.querySelectorAll('.create-deal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            let url = 'deals.html?';
            if (type === 'seller') url += 'seller=' + id;
            else if (type === 'buyer') url += 'buyer=' + id;
            window.location.href = url;
        });
    });
    
    // Удаление
    document.querySelectorAll('.delete-counterparty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            deleteCounterparty(id, name);
        });
    });
}

// ========== CRUD ОПЕРАЦИИ ==========

function openCounterpartyModal(counterpartyId = null) {
    const modal = document.getElementById('counterpartyModal');
    const modalTitle = document.getElementById('modalTitle');
    const relatedSection = document.getElementById('relatedDealsSection');
    
    if (counterpartyId) {
        modalTitle.innerHTML = '<i class="fas fa-user-edit"></i> Редактировать контрагента';
        const counterparty = counterparties.find(c => c.id == counterpartyId);
        if (counterparty) {
            document.getElementById('counterpartyId').value = counterparty.id;
            document.getElementById('counterpartyType').value = counterparty.type;
            document.getElementById('counterpartyPersonType').value = counterparty.person_type || 'individual';
            document.getElementById('counterpartyName').value = counterparty.name;
            document.getElementById('counterpartyPhone').value = counterparty.phone || '';
            document.getElementById('counterpartyEmail').value = counterparty.email || '';
            document.getElementById('counterpartyTelegram').value = counterparty.telegram || '';
            document.getElementById('counterpartyWhatsapp').value = counterparty.whatsapp || '';
            document.getElementById('counterpartyNotes').value = counterparty.notes || '';
            
            const relatedDeals = getDealsByCounterparty(counterpartyId);
            if (relatedDeals.length > 0) {
                relatedSection.style.display = 'block';
                const dealsContainer = document.getElementById('relatedDealsList');
                const statusLabels = {
                    new: '🆕 Новая', showing: '👁️ Показ', negotiation: '💰 Торг',
                    documents: '📋 Документы', closed: '✅ Закрыта', cancelled: '❌ Отказ'
                };
                dealsContainer.innerHTML = relatedDeals.map(d => `
                    <div class="deal-item" data-deal-id="${d.id}">
                        <span>Сделка №${d.id}</span>
                        <span>${statusLabels[d.status] || d.status}</span>
                        <span>${(d.price_current || 0).toLocaleString()} ₽</span>
                    </div>
                `).join('');
                
                // Обработчики для сделок
                dealsContainer.querySelectorAll('.deal-item').forEach(item => {
                    item.addEventListener('click', () => {
                        window.location.href = `deals.html?deal=${item.dataset.dealId}`;
                    });
                });
            } else {
                relatedSection.style.display = 'none';
            }
        }
    } else {
        modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> Новый контрагент';
        document.getElementById('counterpartyId').value = '';
        document.getElementById('counterpartyType').value = 'seller';
        document.getElementById('counterpartyPersonType').value = 'individual';
        document.getElementById('counterpartyName').value = '';
        document.getElementById('counterpartyPhone').value = '';
        document.getElementById('counterpartyEmail').value = '';
        document.getElementById('counterpartyTelegram').value = '';
        document.getElementById('counterpartyWhatsapp').value = '';
        document.getElementById('counterpartyNotes').value = '';
        relatedSection.style.display = 'none';
    }
    
    modal.classList.add('active');
    console.log('[counterparties] Модальное окно открыто, режим:', counterpartyId ? 'редактирование' : 'создание');
}

function closeCounterpartyModal() {
    document.getElementById('counterpartyModal').classList.remove('active');
}

async function saveCounterparty() {
    const id = document.getElementById('counterpartyId').value;
    const data = {
        user_id: currentUser.id,
        type: document.getElementById('counterpartyType').value,
        person_type: document.getElementById('counterpartyPersonType').value,
        name: document.getElementById('counterpartyName').value.trim(),
        phone: document.getElementById('counterpartyPhone').value.trim(),
        email: document.getElementById('counterpartyEmail').value.trim(),
        telegram: document.getElementById('counterpartyTelegram').value.trim(),
        whatsapp: document.getElementById('counterpartyWhatsapp').value.trim(),
        notes: document.getElementById('counterpartyNotes').value.trim()
    };
    
    if (!data.name) {
        alert('Введите имя/название');
        return;
    }
    
    console.log('[counterparties] Сохранение контрагента:', id || 'новый', data.name);
    
    let error;
    if (id) {
        const result = await supabase.from('counterparties').update(data).eq('id', id);
        error = result.error;
    } else {
        const result = await supabase.from('counterparties').insert([data]);
        error = result.error;
    }
    
    if (!error) {
        closeCounterpartyModal();
        await loadCounterparties();
        renderCounterparties();
        showToast('success', id ? 'Контрагент обновлён' : 'Контрагент создан');
    } else {
        console.error('[counterparties] Ошибка сохранения:', error);
        alert('Ошибка сохранения');
    }
}

async function deleteCounterparty(id, name) {
    if (!confirm(`Удалить контрагента "${name}"?`)) return;
    
    console.log('[counterparties] Удаление контрагента:', name);
    
    const { error } = await supabase.from('counterparties').delete().eq('id', id);
    if (!error) {
        await loadCounterparties();
        renderCounterparties();
        showToast('success', 'Контрагент удалён');
    } else {
        alert('Ошибка удаления');
    }
}

// ========== ЭКСПОРТ ==========

function exportCounterparties() {
    // Проверяем право на экспорт
    if (!canExportCounterparties() && !isAdmin()) {
        showToast('error', 'Недостаточно прав для экспорта');
        return;
    }
    
    const filtered = filterByPermissions(counterparties);
    const dataToExport = filtered.map(c => ({
        'Тип': COUNTERPARTY_TYPES[c.type]?.name || c.type,
        'Имя': c.name,
        'Телефон': c.phone || '',
        'Email': c.email || '',
        'Telegram': c.telegram || '',
        'WhatsApp': c.whatsapp || '',
        'Примечания': c.notes || ''
    }));
    
    const csv = arrayToCSV(dataToExport);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM для Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'counterparties.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Экспорт завершён');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initCounterpartiesPage() {
    console.log('[counterparties] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[counterparties] Текущий пользователь:', currentUser?.name);
    
    await loadDeals();
    await loadCounterparties();
    renderCounterparties();
    
    // Навешиваем обработчики
    document.getElementById('searchInput')?.addEventListener('input', renderCounterparties);
    document.getElementById('typeFilter')?.addEventListener('change', renderCounterparties);
    document.getElementById('personTypeFilter')?.addEventListener('change', renderCounterparties);
    
    document.getElementById('addCounterpartyBtn')?.addEventListener('click', () => {
        // Проверяем право на создание
        if (!canCreateCounterparties() && !isAdmin()) {
            showToast('error', 'Недостаточно прав для создания контрагента');
            return;
        }
        openCounterpartyModal();
    });
    
    document.getElementById('exportBtn')?.addEventListener('click', exportCounterparties);
    
    // Кнопки в модальном окне
    document.querySelector('#counterpartyModal .modal-close')?.addEventListener('click', closeCounterpartyModal);
    document.querySelector('#counterpartyModal .modal-cancel')?.addEventListener('click', closeCounterpartyModal);
    document.querySelector('#counterpartyModal .primary')?.addEventListener('click', saveCounterparty);
    
    // Закрытие по клику вне модалки
    document.getElementById('counterpartyModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeCounterpartyModal();
    });
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[counterparties] Инициализация завершена');
}
