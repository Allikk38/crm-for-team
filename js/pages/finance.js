/**
 * ============================================
 * ФАЙЛ: js/pages/finance.js
 * РОЛЬ: Логика страницы управления финансами
 * 
 * ОСОБЕННОСТИ:
 *   - Загрузка и отображение транзакций
 *   - Фильтрация по типу, периоду, датам
 *   - Добавление/редактирование/удаление транзакций
 *   - Обновление виджетов статистики
 *   - Полностью на импортах, без глобальных объектов
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase-session.js
 *   - js/services/finance-supabase.js
 *   - js/utils/helpers.js
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Создание файла
 * ============================================
 */

import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import financeService from '../services/finance-supabase.js';
import { escapeHtml, showToast, formatDate } from '../utils/helpers.js';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let transactions = [];
let currentFilters = {
    type: 'all',
    period: 'month',
    dateFrom: '',
    dateTo: ''
};
let isInitialized = false;

// Иконки для категорий (простое соответствие)
const categoryIcons = {
    'Еда': 'fa-utensils',
    'Транспорт': 'fa-car',
    'Подписки': 'fa-tv',
    'Развлечения': 'fa-gamepad',
    'Здоровье': 'fa-heartbeat',
    'Дом': 'fa-home',
    'Обучение': 'fa-graduation-cap',
    'Зарплата': 'fa-money-bill-wave',
    'Фриланс': 'fa-laptop-code',
    'Подарок': 'fa-gift',
    'Кэшбэк': 'fa-percent',
    'Другое': 'fa-tag'
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

/**
 * Получить иконку для категории
 */
function getCategoryIcon(category) {
    return categoryIcons[category] || 'fa-tag';
}

/**
 * Форматировать сумму
 */
function formatAmount(amount, type) {
    const sign = type === 'income' ? '+' : '-';
    return `${sign} ${amount.toLocaleString()} ₽`;
}

/**
 * Обновить фильтры из UI
 */
function updateFiltersFromUI() {
    currentFilters.type = document.getElementById('filterType')?.value || 'all';
    currentFilters.period = document.getElementById('filterPeriod')?.value || 'month';
    currentFilters.dateFrom = document.getElementById('filterDateFrom')?.value || '';
    currentFilters.dateTo = document.getElementById('filterDateTo')?.value || '';
}

/**
 * Получить даты для фильтрации
 */
function getFilterDates() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (currentFilters.dateFrom && currentFilters.dateTo) {
        return { startDate: currentFilters.dateFrom, endDate: currentFilters.dateTo };
    }
    
    if (currentFilters.period === 'day') {
        return { startDate: today, endDate: today };
    }
    
    if (currentFilters.period === 'week') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        startOfWeek.setDate(now.getDate() - diff);
        return {
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    if (currentFilters.period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    if (currentFilters.period === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
            startDate: startOfYear.toISOString().split('T')[0],
            endDate: today
        };
    }
    
    return { startDate: null, endDate: null };
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

/**
 * Загрузить транзакции
 */
async function loadTransactions() {
    if (!currentUser) return;
    
    const { startDate, endDate } = getFilterDates();
    
    const filters = {
        type: currentFilters.type,
        startDate,
        endDate
    };
    
    transactions = await financeService.getTransactions(filters);
    renderTransactions();
    await updateWidgets();
}

/**
 * Обновить виджеты
 */
async function updateWidgets() {
    if (!currentUser) return;
    
    const { startDate, endDate } = getFilterDates();
    
    // Баланс
    const balance = await financeService.getBalance(currentFilters.period);
    const balanceEl = document.getElementById('balanceValue');
    if (balanceEl) {
        balanceEl.textContent = `${balance.toLocaleString()} ₽`;
        balanceEl.style.color = balance >= 0 ? '#4caf50' : '#ff6b6b';
    }
    
    // Сводка доходов/расходов
    const stats = await financeService.getStats(currentFilters.period);
    const incomeExpenseWidget = document.getElementById('incomeExpenseWidget');
    if (incomeExpenseWidget) {
        incomeExpenseWidget.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Доходы</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #4caf50;">+${stats.totalIncome.toLocaleString()} ₽</div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Расходы</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #ff6b6b;">-${stats.totalExpense.toLocaleString()} ₽</div>
                </div>
            </div>
            <div class="progress-bar-container" style="margin-top: 8px;">
                <div class="progress-bar-fill" style="width: ${stats.totalExpense > 0 ? Math.min(100, (stats.totalExpense / (stats.totalIncome || 1)) * 100) : 0}%; background: linear-gradient(90deg, #4caf50, #ff6b6b);"></div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 8px;">
                Расходы составляют ${stats.totalIncome > 0 ? Math.round((stats.totalExpense / stats.totalIncome) * 100) : 0}% от доходов
            </div>
        `;
    }
    
    // Топ расходов по категориям
    const topExpenses = await financeService.getStatsByCategory(currentFilters.period, 'expense');
    const topExpensesWidget = document.getElementById('topExpensesWidget');
    if (topExpensesWidget) {
        if (topExpenses.length === 0) {
            topExpensesWidget.innerHTML = '<div class="empty-state" style="padding: 20px;">Нет расходов</div>';
        } else {
            topExpensesWidget.innerHTML = `
                <div class="category-stats-list">
                    ${topExpenses.slice(0, 5).map(cat => `
                        <div class="category-stat-item">
                            <div class="category-stat-name">
                                <i class="fas ${getCategoryIcon(cat.category)}" style="width: 20px;"></i>
                                ${escapeHtml(cat.category)}
                            </div>
                            <div class="category-stat-amount">-${cat.total.toLocaleString()} ₽</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    // Топ доходов по категориям
    const topIncome = await financeService.getStatsByCategory(currentFilters.period, 'income');
    const topIncomeWidget = document.getElementById('topIncomeWidget');
    if (topIncomeWidget) {
        if (topIncome.length === 0) {
            topIncomeWidget.innerHTML = '<div class="empty-state" style="padding: 20px;">Нет доходов</div>';
        } else {
            topIncomeWidget.innerHTML = `
                <div class="category-stats-list">
                    ${topIncome.slice(0, 5).map(cat => `
                        <div class="category-stat-item">
                            <div class="category-stat-name">
                                <i class="fas ${getCategoryIcon(cat.category)}" style="width: 20px;"></i>
                                ${escapeHtml(cat.category)}
                            </div>
                            <div class="category-stat-amount" style="color: #4caf50;">+${cat.total.toLocaleString()} ₽</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
}

// ========== РЕНДЕРИНГ ==========

/**
 * Рендер списка транзакций
 */
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p>Нет транзакций</p>
                <button class="add-transaction-btn" id="emptyStateAddBtn" style="margin-top: 16px; padding: 8px 20px;">
                    <i class="fas fa-plus"></i> Добавить операцию
                </button>
            </div>
        `;
        
        const emptyBtn = document.getElementById('emptyStateAddBtn');
        if (emptyBtn) {
            emptyBtn.onclick = () => openTransactionModal();
        }
        return;
    }
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item" data-id="${transaction.id}">
            <div class="transaction-info">
                <div class="transaction-category-icon">
                    <i class="fas ${getCategoryIcon(transaction.category)}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-category">${escapeHtml(transaction.category)}</div>
                    <div class="transaction-description">${escapeHtml(transaction.description || '—')}</div>
                </div>
            </div>
            <div class="transaction-date">
                ${formatDate(transaction.transaction_date, 'DD.MM.YYYY')}
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'} ${transaction.amount.toLocaleString()} ₽
            </div>
            <div class="transaction-actions">
                <button class="transaction-action-btn delete-transaction" data-id="${transaction.id}" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Обработчики удаления
    document.querySelectorAll('.delete-transaction').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Удалить транзакцию?')) {
                try {
                    await financeService.deleteTransaction(id);
                    showToast('success', 'Транзакция удалена');
                    await loadTransactions();
                } catch (error) {
                    showToast('error', 'Ошибка удаления');
                }
            }
        });
    });
}

// ========== МОДАЛЬНОЕ ОКНО ==========

/**
 * Открыть модальное окно добавления транзакции
 */
async function openTransactionModal(transaction = null) {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;
    
    const titleEl = document.getElementById('modalTitle');
    const typeSelect = document.getElementById('transactionType');
    const amountInput = document.getElementById('transactionAmount');
    const categorySelect = document.getElementById('transactionCategory');
    const descInput = document.getElementById('transactionDescription');
    const dateInput = document.getElementById('transactionDate');
    const saveBtn = document.getElementById('saveTransactionBtn');
    
    // Загружаем категории
    const categories = await financeService.getCategories();
    
    // Очищаем и заполняем select категорий
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    const currentType = typeSelect?.value || 'expense';
    const categoryList = categories[currentType] || [];
    categoryList.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
    
    // Устанавливаем дату по умолчанию
    dateInput.value = new Date().toISOString().split('T')[0];
    
    // Сбрасываем форму
    amountInput.value = '';
    descInput.value = '';
    
    if (transaction) {
        titleEl.innerHTML = '<i class="fas fa-edit"></i> Редактировать операцию';
        typeSelect.value = transaction.type;
        amountInput.value = transaction.amount;
        categorySelect.value = transaction.category;
        descInput.value = transaction.description || '';
        dateInput.value = transaction.transaction_date;
        
        // Обновляем категории при смене типа
        const updateCategories = async () => {
            const newCategories = await financeService.getCategories();
            const newList = newCategories[typeSelect.value] || [];
            categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
            newList.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                if (transaction && transaction.category === cat) option.selected = true;
                categorySelect.appendChild(option);
            });
        };
        typeSelect.onchange = updateCategories;
    } else {
        titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Новая операция';
        typeSelect.onchange = async () => {
            const newCategories = await financeService.getCategories();
            const newList = newCategories[typeSelect.value] || [];
            categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
            newList.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        };
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // Сохранение
    const saveHandler = async () => {
        const type = typeSelect.value;
        const amount = parseFloat(amountInput.value);
        const category = categorySelect.value;
        const description = descInput.value;
        const transactionDate = dateInput.value;
        
        if (!amount || isNaN(amount) || amount <= 0) {
            showToast('error', 'Введите корректную сумму');
            return;
        }
        
        if (!category) {
            showToast('error', 'Выберите категорию');
            return;
        }
        
        try {
            if (transaction) {
                await financeService.updateTransaction(transaction.id, {
                    type, amount, category, description, transaction_date: transactionDate
                });
                showToast('success', 'Транзакция обновлена');
            } else {
                await financeService.addTransaction({
                    type, amount, category, description, transaction_date: transactionDate
                });
                showToast('success', 'Транзакция добавлена');
            }
            closeModal();
            await loadTransactions();
        } catch (error) {
            showToast('error', 'Ошибка сохранения');
        }
    };
    
    saveBtn.onclick = saveHandler;
}

/**
 * Закрыть модальное окно
 */
function closeModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

/**
 * Инициализация страницы финансов
 */
export async function initFinancePage() {
    if (isInitialized) {
        console.log('[finance] Страница уже инициализирована');
        return;
    }
    
    console.log('[finance] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[finance] Текущий пользователь:', currentUser?.name);
    
    // Навешиваем обработчики
    const addBtn = document.getElementById('addTransactionBtn');
    if (addBtn) {
        addBtn.onclick = () => openTransactionModal();
    }
    
    const filterType = document.getElementById('filterType');
    const filterPeriod = document.getElementById('filterPeriod');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    
    if (filterType) filterType.onchange = async () => { updateFiltersFromUI(); await loadTransactions(); };
    if (filterPeriod) filterPeriod.onchange = async () => { updateFiltersFromUI(); await loadTransactions(); };
    if (filterDateFrom) filterDateFrom.onchange = async () => { updateFiltersFromUI(); await loadTransactions(); };
    if (filterDateTo) filterDateTo.onchange = async () => { updateFiltersFromUI(); await loadTransactions(); };
    
    // Закрытие модалки по клику вне
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    
    await loadTransactions();
    
    isInitialized = true;
    console.log('[finance] Инициализация завершена');
}
