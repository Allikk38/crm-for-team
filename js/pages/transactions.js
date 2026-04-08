/**
 * ============================================
 * ФАЙЛ: js/pages/transactions.js
 * РОЛЬ: Логика страницы списка транзакций
 * 
 * ОСОБЕННОСТИ:
 *   - Загрузка и отображение транзакций
 *   - Фильтрация по типу, счёту, категории, датам
 *   - Добавление, редактирование, удаление транзакций
 *   - Обновление статистики
 *   - Поддержка URL параметров для предустановленных фильтров
 *   - Адаптивное отображение (таблица / карточки)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase-session.js
 *   - js/services/finance-supabase.js
 *   - js/core/eventBus.js
 * 
 * ИСТОРИЯ:
 *   2026-04-08: Создание файла
 * ============================================
 */

import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import financeService from '../services/finance-supabase.js';
import { eventBus } from '../core/eventBus.js';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let isInitialized = false;

// Данные
let transactions = [];
let accounts = [];
let categories = [];

// Текущие фильтры
let currentFilters = {
    type: 'all',
    accountId: 'all',
    categoryId: 'all',
    dateFrom: '',
    dateTo: ''
};

// Редактируемая транзакция
let editingTransactionId = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initTransactionsPage() {
    if (isInitialized) {
        console.log('[transactions] Страница уже инициализирована');
        return;
    }
    
    console.log('[transactions] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    // Загружаем URL параметры
    parseUrlParams();
    
    // Загружаем данные для фильтров
    await loadFilterData();
    
    // Загружаем транзакции
    await loadTransactions();
    
    // Привязываем события
    bindEvents();
    
    // Подписываемся на события eventBus
    eventBus.on('transaction:added', () => loadTransactions());
    eventBus.on('transaction:updated', () => loadTransactions());
    eventBus.on('transaction:deleted', () => loadTransactions());
    
    isInitialized = true;
    console.log('[transactions] Инициализация завершена');
}

// ========== URL ПАРАМЕТРЫ ==========

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('type')) {
        currentFilters.type = params.get('type');
        const filterType = document.getElementById('filterType');
        if (filterType) filterType.value = currentFilters.type;
    }
    
    if (params.has('account')) {
        currentFilters.accountId = params.get('account');
    }
    
    if (params.has('category')) {
        currentFilters.categoryId = params.get('category');
    }
    
    if (params.has('month')) {
        const month = params.get('month');
        const dateFrom = document.getElementById('filterDateFrom');
        const dateTo = document.getElementById('filterDateTo');
        if (dateFrom) dateFrom.value = `${month}-01`;
        if (dateTo) {
            const lastDay = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate();
            dateTo.value = `${month}-${String(lastDay).padStart(2, '0')}`;
        }
        currentFilters.dateFrom = `${month}-01`;
        currentFilters.dateTo = `${month}-${String(new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
    }
    
    if (params.has('action') && params.get('action') === 'new') {
        setTimeout(() => openTransactionModal(), 100);
    }
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadFilterData() {
    try {
        [accounts, categories] = await Promise.all([
            financeService.getAccounts(),
            financeService.getCategories('all')
        ]);
        
        populateAccountFilter();
        populateCategoryFilter();
        populateModalSelects();
    } catch (error) {
        console.error('[transactions] Ошибка загрузки данных фильтров:', error);
    }
}

function populateAccountFilter() {
    const filterAccount = document.getElementById('filterAccount');
    if (!filterAccount) return;
    
    filterAccount.innerHTML = '<option value="all">Все счета</option>';
    accounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id;
        option.textContent = acc.name;
        if (currentFilters.accountId === acc.id) option.selected = true;
        filterAccount.appendChild(option);
    });
}

function populateCategoryFilter() {
    const filterCategory = document.getElementById('filterCategory');
    if (!filterCategory) return;
    
    filterCategory.innerHTML = '<option value="all">Все категории</option>';
    
    const filteredCategories = categories.filter(cat => {
        if (currentFilters.type === 'all') return true;
        return cat.type === currentFilters.type;
    });
    
    filteredCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (currentFilters.categoryId === cat.id) option.selected = true;
        filterCategory.appendChild(option);
    });
}

function populateModalSelects() {
    const modalAccount = document.getElementById('modalAccount');
    const modalCategory = document.getElementById('modalCategory');
    
    if (modalAccount) {
        modalAccount.innerHTML = '<option value="">Выберите счёт</option>';
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = `${acc.name} (${acc.balance.toLocaleString()} ₽)`;
            modalAccount.appendChild(option);
        });
    }
    
    if (modalCategory) {
        updateModalCategories();
    }
}

function updateModalCategories() {
    const modalCategory = document.getElementById('modalCategory');
    const modalType = document.getElementById('modalType');
    if (!modalCategory || !modalType) return;
    
    const selectedType = modalType.value;
    
    modalCategory.innerHTML = '<option value="">Выберите категорию</option>';
    
    const filteredCategories = categories.filter(cat => cat.type === selectedType);
    filteredCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        modalCategory.appendChild(option);
    });
}

// ========== ЗАГРУЗКА ТРАНЗАКЦИЙ ==========

async function loadTransactions() {
    try {
        const filters = {};
        
        if (currentFilters.type !== 'all') {
            filters.type = currentFilters.type;
        }
        
        if (currentFilters.accountId !== 'all') {
            filters.accountId = currentFilters.accountId;
        }
        
        if (currentFilters.categoryId !== 'all') {
            filters.categoryId = currentFilters.categoryId;
        }
        
        if (currentFilters.dateFrom) {
            filters.startDate = currentFilters.dateFrom;
        }
        
        if (currentFilters.dateTo) {
            filters.endDate = currentFilters.dateTo;
        }
        
        transactions = await financeService.getTransactions(filters);
        
        renderTransactions();
        updateStats();
    } catch (error) {
        console.error('[transactions] Ошибка загрузки транзакций:', error);
        showEmptyState('Ошибка загрузки данных');
    }
}

// ========== СТАТИСТИКА ==========

function updateStats() {
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;
    
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('balance');
    const transactionCountEl = document.getElementById('transactionCount');
    
    if (totalIncomeEl) totalIncomeEl.textContent = `${totalIncome.toLocaleString()} ₽`;
    if (totalExpenseEl) totalExpenseEl.textContent = `${totalExpense.toLocaleString()} ₽`;
    if (balanceEl) {
        balanceEl.textContent = `${balance >= 0 ? '+' : ''}${balance.toLocaleString()} ₽`;
        balanceEl.style.color = balance >= 0 ? '#4caf50' : '#ff6b6b';
    }
    if (transactionCountEl) transactionCountEl.textContent = transactions.length;
}

// ========== РЕНДЕРИНГ ==========

function renderTransactions() {
    renderTable();
    renderCards();
}

function renderTable() {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <p>Нет транзакций</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const category = transaction.category || {};
        const account = transaction.account || {};
        const date = new Date(transaction.date).toLocaleDateString('ru');
        
        return `
            <tr data-id="${transaction.id}">
                <td>${date}</td>
                <td>
                    <span class="category-badge">
                        <i class="fas fa-tag"></i>
                        ${escapeHtml(category.name || '—')}
                    </span>
                </td>
                <td>
                    <span class="account-badge">
                        <i class="fas fa-${account.type === 'cash' ? 'wallet' : 'credit-card'}"></i>
                        ${escapeHtml(account.name || '—')}
                    </span>
                </td>
                <td>${escapeHtml(transaction.comment || '—')}</td>
                <td class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'} ${transaction.amount.toLocaleString()} ₽
                </td>
                <td>
                    <div class="transaction-actions">
                        <button class="action-btn edit" data-id="${transaction.id}" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" data-id="${transaction.id}" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Привязываем события к кнопкам
    tbody.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const transaction = transactions.find(t => t.id === id);
            if (transaction) openTransactionModal(transaction);
        });
    });
    
    tbody.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteTransaction(id);
        });
    });
    
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.id;
            const transaction = transactions.find(t => t.id === id);
            if (transaction) openTransactionModal(transaction);
        });
    });
}

function renderCards() {
    const container = document.getElementById('transactionsCards');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>Нет транзакций</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(transaction => {
        const category = transaction.category || {};
        const account = transaction.account || {};
        const date = new Date(transaction.date).toLocaleDateString('ru');
        
        return `
            <div class="transaction-card" data-id="${transaction.id}">
                <div class="transaction-card-header">
                    <span class="transaction-card-amount ${transaction.type}">
                        ${transaction.type === 'income' ? '+' : '-'} ${transaction.amount.toLocaleString()} ₽
                    </span>
                    <span class="transaction-card-date">${date}</span>
                </div>
                <div class="transaction-card-details">
                    <div class="transaction-card-detail">
                        <i class="fas fa-tag"></i>
                        ${escapeHtml(category.name || '—')}
                    </div>
                    <div class="transaction-card-detail">
                        <i class="fas fa-${account.type === 'cash' ? 'wallet' : 'credit-card'}"></i>
                        ${escapeHtml(account.name || '—')}
                    </div>
                    ${transaction.comment ? `
                        <div class="transaction-card-detail">
                            <i class="fas fa-comment"></i>
                            ${escapeHtml(transaction.comment)}
                        </div>
                    ` : ''}
                </div>
                <div class="transaction-card-actions">
                    <button class="action-btn edit" data-id="${transaction.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" data-id="${transaction.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const transaction = transactions.find(t => t.id === id);
            if (transaction) openTransactionModal(transaction);
        });
    });
    
    container.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteTransaction(id);
        });
    });
    
    container.querySelectorAll('.transaction-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const transaction = transactions.find(t => t.id === id);
            if (transaction) openTransactionModal(transaction);
        });
    });
}

function showEmptyState(message) {
    const tbody = document.getElementById('transactionsTableBody');
    const cards = document.getElementById('transactionsCards');
    
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
    
    if (cards) {
        cards.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// ========== МОДАЛЬНОЕ ОКНО ==========

function openTransactionModal(transaction = null) {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;
    
    const title = document.getElementById('modalTitle');
    const typeSelect = document.getElementById('modalType');
    const amountInput = document.getElementById('modalAmount');
    const accountSelect = document.getElementById('modalAccount');
    const categorySelect = document.getElementById('modalCategory');
    const dateInput = document.getElementById('modalDate');
    const commentInput = document.getElementById('modalComment');
    
    populateModalSelects();
    
    if (transaction) {
        editingTransactionId = transaction.id;
        title.innerHTML = '<i class="fas fa-edit"></i> Редактировать транзакцию';
        typeSelect.value = transaction.type;
        amountInput.value = transaction.amount;
        accountSelect.value = transaction.account_id;
        dateInput.value = transaction.date;
        commentInput.value = transaction.comment || '';
        
        // Обновляем категории и устанавливаем значение
        updateModalCategories();
        setTimeout(() => {
            categorySelect.value = transaction.category_id;
        }, 10);
    } else {
        editingTransactionId = null;
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Новая транзакция';
        typeSelect.value = 'expense';
        amountInput.value = '';
        accountSelect.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        commentInput.value = '';
        updateModalCategories();
        categorySelect.value = '';
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    editingTransactionId = null;
}

async function saveTransaction() {
    const type = document.getElementById('modalType').value;
    const amount = parseFloat(document.getElementById('modalAmount').value);
    const accountId = document.getElementById('modalAccount').value;
    const categoryId = document.getElementById('modalCategory').value;
    const date = document.getElementById('modalDate').value;
    const comment = document.getElementById('modalComment').value;
    
    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }
    
    if (!accountId) {
        alert('Выберите счёт');
        return;
    }
    
    if (!categoryId) {
        alert('Выберите категорию');
        return;
    }
    
    if (!date) {
        alert('Выберите дату');
        return;
    }
    
    try {
        if (editingTransactionId) {
            await financeService.updateTransaction(editingTransactionId, {
                type,
                amount,
                account_id: accountId,
                category_id: categoryId,
                date,
                comment: comment || null
            });
            eventBus.emit('transaction:updated');
        } else {
            await financeService.addTransaction({
                type,
                amount,
                account_id: accountId,
                category_id: categoryId,
                date,
                comment: comment || null
            });
            eventBus.emit('transaction:added');
        }
        
        closeModal();
        await loadTransactions();
    } catch (error) {
        console.error('[transactions] Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Удалить транзакцию?')) return;
    
    try {
        await financeService.deleteTransaction(id);
        eventBus.emit('transaction:deleted');
        await loadTransactions();
    } catch (error) {
        console.error('[transactions] Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
}

// ========== ФИЛЬТРАЦИЯ ==========

function applyFilters() {
    const filterType = document.getElementById('filterType');
    const filterAccount = document.getElementById('filterAccount');
    const filterCategory = document.getElementById('filterCategory');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    
    currentFilters = {
        type: filterType?.value || 'all',
        accountId: filterAccount?.value || 'all',
        categoryId: filterCategory?.value || 'all',
        dateFrom: filterDateFrom?.value || '',
        dateTo: filterDateTo?.value || ''
    };
    
    // Обновляем URL
    const params = new URLSearchParams();
    if (currentFilters.type !== 'all') params.set('type', currentFilters.type);
    if (currentFilters.accountId !== 'all') params.set('account', currentFilters.accountId);
    if (currentFilters.categoryId !== 'all') params.set('category', currentFilters.categoryId);
    if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
    if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
    
    loadTransactions();
}

function resetFilters() {
    currentFilters = {
        type: 'all',
        accountId: 'all',
        categoryId: 'all',
        dateFrom: '',
        dateTo: ''
    };
    
    const filterType = document.getElementById('filterType');
    const filterAccount = document.getElementById('filterAccount');
    const filterCategory = document.getElementById('filterCategory');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    
    if (filterType) filterType.value = 'all';
    if (filterAccount) filterAccount.value = 'all';
    if (filterCategory) filterCategory.value = 'all';
    if (filterDateFrom) filterDateFrom.value = '';
    if (filterDateTo) filterDateTo.value = '';
    
    window.history.replaceState({}, '', window.location.pathname);
    
    loadTransactions();
}

// ========== СОБЫТИЯ ==========

function bindEvents() {
    // Кнопки
    document.getElementById('addTransactionBtn')?.addEventListener('click', () => openTransactionModal());
    document.getElementById('backToFinanceBtn')?.addEventListener('click', () => {
        window.location.href = './finance.html';
    });
    
  // Фильтры
    document.getElementById('filterType')?.addEventListener('change', () => {
        populateCategoryFilter();
    });
    
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
    
    // Модальное окно
    document.getElementById('modalType')?.addEventListener('change', updateModalCategories);
    document.getElementById('saveTransactionBtn')?.addEventListener('click', saveTransaction);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== ЭКСПОРТ ==========

export default { initTransactionsPage };