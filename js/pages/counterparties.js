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
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из counterparties-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

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

function filterByRole(list) {
    if (!currentUser) return [];
    if (currentUser.role === 'admin' || currentUser.role === 'manager') return list;
    
    if (currentUser.role === 'agent') {
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

// ========== РЕНДЕРИНГ КАРТОЧЕК ==========

function renderCounterparties() {
    const grid = document.getElementById('counterpartiesGrid');
    if (!grid) return;
    
    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const personTypeFilter = document.getElementById('personTypeFilter')?.value || 'all';
    
    let filtered = filterByRole(counterparties);
    
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
        
        html += `
            <div class="counterparty-card" onclick="window.openCounterpartyModal('${c.id}')">
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
                    <button class="counterparty-btn" onclick="event.stopPropagation(); window.editCounterparty('${c.id}')"><i class="fas fa-edit"></i> Редактировать</button>
                    <button class="counterparty-btn" onclick="event.stopPropagation(); window.createDealForCounterparty('${c.id}', '${c.type}')"><i class="fas fa-handshake"></i> Создать сделку</button>
                    <button class="counterparty-btn" onclick="event.stopPropagation(); window.deleteCounterparty('${c.id}')"><i class="fas fa-trash"></i> Удалить</button>
                </div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
    console.log('[counterparties] Отрисовано контрагентов:', filtered.length);
}

// ========== CRUD ОПЕРАЦИИ ==========

window.openCounterpartyModal = async function(counterpartyId = null) {
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
                    <div class="deal-item" onclick="window.goToDeal('${d.id}')">
                        <span>Сделка №${d.id}</span>
                        <span>${statusLabels[d.status] || d.status}</span>
                        <span>${(d.price_current || 0).toLocaleString()} ₽</span>
                    </div>
                `).join('');
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
};

window.closeCounterpartyFormModal = function() {
    document.getElementById('counterpartyModal').classList.remove('active');
};

window.saveCounterparty = async function() {
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
        window.closeCounterpartyFormModal();
        await loadCounterparties();
        renderCounterparties();
        showToast('success', id ? 'Контрагент обновлён' : 'Контрагент создан');
    } else {
        console.error('[counterparties] Ошибка сохранения:', error);
        alert('Ошибка сохранения');
    }
};

window.editCounterparty = function(id) {
    window.openCounterpartyModal(id);
};

window.deleteCounterparty = async function(id) {
    const counterparty = counterparties.find(c => c.id == id);
    if (!counterparty) return;
    if (!confirm(`Удалить контрагента "${counterparty.name}"?`)) return;
    
    console.log('[counterparties] Удаление контрагента:', counterparty.name);
    
    const { error } = await supabase.from('counterparties').delete().eq('id', id);
    if (!error) {
        await loadCounterparties();
        renderCounterparties();
        showToast('success', 'Контрагент удалён');
    } else {
        alert('Ошибка удаления');
    }
};

// ========== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ==========

window.createDealForCounterparty = function(counterpartyId, type) {
    let url = 'deals-supabase.html?';
    if (type === 'seller') url += 'seller=' + counterpartyId;
    else if (type === 'buyer') url += 'buyer=' + counterpartyId;
    window.location.href = url;
};

window.goToDeal = function(dealId) {
    window.location.href = 'deals-supabase.html?deal=' + dealId;
};

window.exportCounterparties = function() {
    const filtered = filterByRole(counterparties);
    const dataToExport = filtered.map(c => ({
        'Тип': COUNTERPARTY_TYPES[c.type]?.name || c.type,
        'Имя': c.name,
        'Телефон': c.phone,
        'Email': c.email,
        'Telegram': c.telegram,
        'WhatsApp': c.whatsapp,
        'Примечания': c.notes
    }));
    
    const csv = arrayToCSV(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'counterparties.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Экспорт завершён');
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initCounterpartiesPage() {
    console.log('[counterparties] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[counterparties] Текущий пользователь:', currentUser?.name, 'роль:', currentUser?.role);
    
    await loadDeals();
    await loadCounterparties();
    renderCounterparties();
    
    document.getElementById('searchInput')?.addEventListener('input', renderCounterparties);
    document.getElementById('typeFilter')?.addEventListener('change', renderCounterparties);
    document.getElementById('personTypeFilter')?.addEventListener('change', renderCounterparties);
    document.getElementById('addCounterpartyBtn')?.addEventListener('click', () => window.openCounterpartyModal());
    document.getElementById('exportBtn')?.addEventListener('click', () => window.exportCounterparties());
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[counterparties] Анимации инициализированы');
    }
    
    console.log('[counterparties] Инициализация завершена');
}