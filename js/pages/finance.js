/**
 * ============================================
 * ФАЙЛ: js/pages/finance.js
 * РОЛЬ: Логика страницы управления финансами (дашборд)
 * 
 * ОСОБЕННОСТИ:
 *   - Загрузка и отображение виджетов
 *   - Виджеты: остатки по счетам, бюджет, сводка по кредитам, совет дня
 *   - Drag-and-drop виджетов (как на главном дашборде)
 *   - Переходы на связанные страницы
 *   - Полностью на импортах ES6
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase-session.js
 *   - js/services/finance-supabase.js
 *   - js/components/dashboard-container.js
 * 
 * ИСТОРИЯ:
 *   2026-04-08: Создание файла для новой структуры finance_*
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
let dashboardContainer = null;

// Текущий месяц для отображения
let currentMonth = new Date().toISOString().slice(0, 7);

// ========== ИНИЦИАЛИЗАЦИЯ ВИДЖЕТОВ ==========

/**
 * Загрузить виджет «Остатки по счетам»
 */
async function loadAccountsWidget(container) {
    try {
        const summary = await financeService.getFinanceSummary();
        const accounts = summary.accounts || [];
        const totalBalance = summary.totalBalance || 0;
        
        const accountsListHtml = accounts.length === 0
            ? '<div class="finance-widget-empty">Нет счетов. <a href="#" class="finance-add-account-link">Добавить счёт</a></div>'
            : accounts.map(acc => `
                <div class="finance-account-item" data-account-id="${acc.id}">
                    <div class="finance-account-icon">
                        <i class="fas fa-${acc.type === 'cash' ? 'wallet' : 'credit-card'}"></i>
                    </div>
                    <div class="finance-account-info">
                        <div class="finance-account-name">${escapeHtml(acc.name)}</div>
                        <div class="finance-account-type">${acc.type === 'cash' ? 'Наличные' : 'Карта'}</div>
                    </div>
                    <div class="finance-account-balance ${acc.balance >= 0 ? 'positive' : 'negative'}">
                        ${acc.balance.toLocaleString()} ₽
                    </div>
                </div>
            `).join('');
        
        container.innerHTML = `
            <div class="finance-widget-header">
                <h3 class="finance-widget-title">
                    <i class="fas fa-wallet"></i> Остатки по счетам
                </h3>
                <button class="finance-widget-add-btn" id="addAccountBtn" title="Добавить счёт">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="finance-accounts-list">
                ${accountsListHtml}
            </div>
            <div class="finance-widget-footer">
                <div class="finance-total-balance">
                    <span>Всего:</span>
                    <strong class="${totalBalance >= 0 ? 'positive' : 'negative'}">
                        ${totalBalance.toLocaleString()} ₽
                    </strong>
                </div>
            </div>
        `;
        
        container.querySelectorAll('.finance-account-item').forEach(item => {
            item.addEventListener('click', () => {
                const accountId = item.dataset.accountId;
                window.location.href = `./transactions.html?account=${accountId}`;
            });
        });
        
        const addBtn = container.querySelector('#addAccountBtn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAccountModal();
            });
        }
        
        const addLink = container.querySelector('.finance-add-account-link');
        if (addLink) {
            addLink.addEventListener('click', (e) => {
                e.preventDefault();
                openAccountModal();
            });
        }
    } catch (error) {
        console.error('[finance] Ошибка загрузки виджета счетов:', error);
        container.innerHTML = '<div class="finance-widget-error">Ошибка загрузки</div>';
    }
}

/**
 * Загрузить виджет «Бюджет на месяц»
 */
async function loadBudgetWidget(container) {
    try {
        const budgetSummary = await financeService.getBudgetSummary(currentMonth);
        
        const topCategoriesHtml = budgetSummary.topCategories.length === 0
            ? '<div class="finance-widget-empty">Нет данных о бюджете</div>'
            : budgetSummary.topCategories.map(cat => {
                const percentage = Math.min(100, cat.percentage);
                const statusClass = percentage >= 100 ? 'over' : (percentage >= 80 ? 'warning' : 'good');
                return `
                    <div class="finance-budget-item" data-category-id="${cat.categoryId}">
                        <div class="finance-budget-info">
                            <div class="finance-budget-name">${escapeHtml(cat.categoryName)}</div>
                            <div class="finance-budget-values">
                                ${cat.fact.toLocaleString()} / ${cat.planned.toLocaleString()} ₽
                            </div>
                        </div>
                        <div class="finance-budget-progress">
                            <div class="finance-budget-progress-bar ${statusClass}" 
                                 style="width: ${percentage}%"></div>
                        </div>
                        <div class="finance-budget-remaining ${cat.remaining >= 0 ? 'positive' : 'negative'}">
                            ${cat.remaining >= 0 ? 'Остаток' : 'Перерасход'}: 
                            ${Math.abs(cat.remaining).toLocaleString()} ₽
                        </div>
                    </div>
                `;
            }).join('');
        
        const monthName = new Date(currentMonth + '-01').toLocaleString('ru', { month: 'long', year: 'numeric' });
        
        container.innerHTML = `
            <div class="finance-widget-header">
                <h3 class="finance-widget-title">
                    <i class="fas fa-chart-pie"></i> Бюджет
                </h3>
                <div class="finance-month-selector">
                    <button class="finance-month-btn" id="prevMonthBtn">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="finance-month-display">${monthName}</span>
                    <button class="finance-month-btn" id="nextMonthBtn">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="finance-budget-summary">
                <div class="finance-budget-total">
                    <span>Потрачено:</span>
                    <strong>${budgetSummary.totalFact.toLocaleString()} ₽</strong>
                </div>
                <div class="finance-budget-total">
                    <span>Бюджет:</span>
                    <strong>${budgetSummary.totalPlanned.toLocaleString()} ₽</strong>
                </div>
            </div>
            <div class="finance-budget-list">
                ${topCategoriesHtml}
            </div>
            <div class="finance-widget-footer">
                <a href="#" class="finance-widget-link" id="setupBudgetLink">
                    <i class="fas fa-cog"></i> Настроить бюджет
                </a>
            </div>
        `;
        
        container.querySelectorAll('.finance-budget-item').forEach(item => {
            item.addEventListener('click', () => {
                const categoryId = item.dataset.categoryId;
                window.location.href = `./transactions.html?category=${categoryId}&month=${currentMonth}`;
            });
        });
        
        const prevBtn = container.querySelector('#prevMonthBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() - 1);
                currentMonth = date.toISOString().slice(0, 7);
                await loadBudgetWidget(container);
            });
        }
        
        const nextBtn = container.querySelector('#nextMonthBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() + 1);
                currentMonth = date.toISOString().slice(0, 7);
                await loadBudgetWidget(container);
            });
        }
        
        const setupLink = container.querySelector('#setupBudgetLink');
        if (setupLink) {
            setupLink.addEventListener('click', (e) => {
                e.preventDefault();
                openBudgetSetupModal();
            });
        }
    } catch (error) {
        console.error('[finance] Ошибка загрузки виджета бюджета:', error);
        container.innerHTML = '<div class="finance-widget-error">Ошибка загрузки</div>';
    }
}

/**
 * Загрузить виджет «Сводка по кредитам»
 */
async function loadCreditsSummaryWidget(container) {
    try {
        const summary = await financeService.getFinanceSummary();
        const credits = summary.credits || [];
        const totalCreditBalance = summary.totalCreditBalance || 0;
        const nextPayment = summary.nextPayment;
        
        if (credits.length === 0) {
            container.innerHTML = `
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">
                        <i class="fas fa-percent"></i> Кредиты
                    </h3>
                </div>
                <div class="finance-widget-empty">
                    Нет активных кредитов
                    <a href="./credits.html" class="finance-widget-link">Добавить кредит</a>
                </div>
            `;
            return;
        }
        
        const nextPaymentHtml = nextPayment
            ? `
                <div class="finance-next-payment">
                    <div class="finance-next-payment-label">Ближайший платёж</div>
                    <div class="finance-next-payment-info">
                        <span class="finance-next-payment-name">${escapeHtml(nextPayment.creditName)}</span>
                        <span class="finance-next-payment-date">${formatDate(nextPayment.date)}</span>
                    </div>
                    <div class="finance-next-payment-amount">${nextPayment.amount.toLocaleString()} ₽</div>
                </div>
            `
            : '';
        
        container.innerHTML = `
            <div class="finance-widget-header">
                <h3 class="finance-widget-title">
                    <i class="fas fa-percent"></i> Кредиты
                </h3>
            </div>
            <div class="finance-credits-summary">
                <div class="finance-credits-stats">
                    <div class="finance-credits-stat">
                        <span class="finance-credits-stat-label">Всего кредитов</span>
                        <span class="finance-credits-stat-value">${credits.length}</span>
                    </div>
                    <div class="finance-credits-stat">
                        <span class="finance-credits-stat-label">Общий остаток</span>
                        <span class="finance-credits-stat-value">${totalCreditBalance.toLocaleString()} ₽</span>
                    </div>
                </div>
                ${nextPaymentHtml}
            </div>
            <div class="finance-widget-footer">
                <a href="./credits.html" class="finance-widget-link">
                    <i class="fas fa-list"></i> Все кредиты
                </a>
            </div>
        `;
        
        container.addEventListener('click', (e) => {
            if (!e.target.closest('a') && !e.target.closest('button')) {
                window.location.href = './credits.html';
            }
        });
    } catch (error) {
        console.error('[finance] Ошибка загрузки виджета кредитов:', error);
        container.innerHTML = '<div class="finance-widget-error">Ошибка загрузки</div>';
    }
}

/**
 * Загрузить виджет «Совет дня»
 */
async function loadSavingsTipWidget(container) {
    try {
        const summary = await financeService.getFinanceSummary();
        const budget = summary.budget;
        const credits = summary.credits || [];
        
        const savings = budget.remaining > 0 ? budget.remaining : 0;
        
        if (savings <= 0 || credits.length === 0) {
            container.innerHTML = `
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">
                        <i class="fas fa-lightbulb"></i> Совет дня
                    </h3>
                </div>
                <div class="finance-widget-empty">
                    ${credits.length === 0 ? 'Добавьте кредит для получения советов' : 'Нет экономии в этом месяце'}
                </div>
            `;
            return;
        }
        
        const highRateCredit = credits
            .filter(c => c.balance > 0)
            .sort((a, b) => b.rate - a.rate)[0];
        
        if (!highRateCredit) {
            container.innerHTML = `
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">
                        <i class="fas fa-lightbulb"></i> Совет дня
                    </h3>
                </div>
                <div class="finance-widget-empty">Нет активных кредитов с остатком</div>
            `;
            return;
        }
        
        const prepaymentCalc = financeService.calculatePrepayment(highRateCredit, savings);
        
        container.innerHTML = `
            <div class="finance-widget-header">
                <h3 class="finance-widget-title">
                    <i class="fas fa-lightbulb"></i> Совет дня
                </h3>
            </div>
            <div class="finance-tip-content">
                <p class="finance-tip-text">
                    Вы сэкономили <strong>${savings.toLocaleString()} ₽</strong> в этом месяце.
                    Внесите их в кредит <strong>«${escapeHtml(highRateCredit.name)}»</strong> —
                    это сократит срок на <strong>${prepaymentCalc.monthsReduced} мес.</strong>
                    и сэкономит <strong>${prepaymentCalc.interestSaved.toLocaleString()} ₽</strong> процентов.
                </p>
                <button class="finance-tip-action" id="applyTipBtn" data-credit-id="${highRateCredit.id}">
                    Внести досрочно
                </button>
            </div>
        `;
        
        const applyBtn = container.querySelector('#applyTipBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const creditId = applyBtn.dataset.creditId;
                window.location.href = `./credit-detail.html?id=${creditId}&prepayment=${savings}`;
            });
        }
    } catch (error) {
        console.error('[finance] Ошибка загрузки виджета совета:', error);
        container.innerHTML = '<div class="finance-widget-error">Ошибка загрузки</div>';
    }
}

// ========== МОДАЛЬНЫЕ ОКНА ==========

async function openAccountModal() {
    const modal = document.createElement('div');
    modal.className = 'modal finance-modal active';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content finance-modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Новый счёт</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название счёта</label>
                    <input type="text" id="accountName" placeholder="Наличные, Карта Сбер..." maxlength="100">
                </div>
                <div class="form-group">
                    <label>Тип счёта</label>
                    <select id="accountType">
                        <option value="cash">Наличные</option>
                        <option value="card">Банковская карта</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Начальный баланс</label>
                    <input type="number" id="accountBalance" placeholder="0" min="0" step="0.01" value="0">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-cancel">Отмена</button>
                <button class="btn-primary modal-save">Создать счёт</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => modal.remove();
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    modal.querySelector('.modal-save').addEventListener('click', async () => {
        const name = modal.querySelector('#accountName').value.trim();
        const type = modal.querySelector('#accountType').value;
        const balance = parseFloat(modal.querySelector('#accountBalance').value) || 0;
        
        if (!name) {
            alert('Введите название счёта');
            return;
        }
        
        try {
            await financeService.createAccount({ name, type, balance });
            eventBus.emit('finance:account:created');
            closeModal();
            await refreshAllWidgets();
        } catch (error) {
            console.error('[finance] Ошибка создания счёта:', error);
            alert('Ошибка создания счёта: ' + error.message);
        }
    });
}

async function openBudgetSetupModal() {
    const categories = await financeService.getCategories('expense');
    const existingBudget = await financeService.getBudget(currentMonth);
    const budgetMap = {};
    existingBudget.forEach(b => { budgetMap[b.category_id] = b.planned; });
    
    const modal = document.createElement('div');
    modal.className = 'modal finance-modal active';
    modal.style.display = 'flex';
    
    const categoriesHtml = categories.map(cat => `
        <div class="finance-budget-setup-item">
            <label>${escapeHtml(cat.name)}</label>
            <input type="number" 
                   class="finance-budget-input" 
                   data-category-id="${cat.id}"
                   value="${budgetMap[cat.id] || 0}"
                   min="0" 
                   step="100"
                   placeholder="0">
        </div>
    `).join('');
    
    const monthName = new Date(currentMonth + '-01').toLocaleString('ru', { month: 'long', year: 'numeric' });
    
    modal.innerHTML = `
        <div class="modal-content finance-modal-content finance-budget-modal">
            <div class="modal-header">
                <h3><i class="fas fa-chart-pie"></i> Бюджет на ${monthName}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="finance-budget-setup-list">
                    ${categoriesHtml}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-cancel">Отмена</button>
                <button class="btn-primary modal-save">Сохранить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => modal.remove();
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    modal.querySelector('.modal-save').addEventListener('click', async () => {
        const inputs = modal.querySelectorAll('.finance-budget-input');
        const promises = [];
        
        for (const input of inputs) {
            const categoryId = input.dataset.categoryId;
            const planned = parseFloat(input.value) || 0;
            if (planned > 0) {
                promises.push(financeService.setBudgetPlan(categoryId, currentMonth, planned));
            }
        }
        
        try {
            await Promise.all(promises);
            eventBus.emit('finance:budget:updated');
            closeModal();
            await refreshAllWidgets();
        } catch (error) {
            console.error('[finance] Ошибка сохранения бюджета:', error);
            alert('Ошибка сохранения бюджета');
        }
    });
}

// ========== ОБНОВЛЕНИЕ ВИДЖЕТОВ ==========

async function refreshAllWidgets() {
    const accountsContainer = document.querySelector('[data-widget="finance-accounts"]');
    const budgetContainer = document.querySelector('[data-widget="finance-budget"]');
    const creditsContainer = document.querySelector('[data-widget="finance-credits"]');
    const tipContainer = document.querySelector('[data-widget="finance-tip"]');
    
    if (accountsContainer) await loadAccountsWidget(accountsContainer);
    if (budgetContainer) await loadBudgetWidget(budgetContainer);
    if (creditsContainer) await loadCreditsSummaryWidget(creditsContainer);
    if (tipContainer) await loadSavingsTipWidget(tipContainer);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ========== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ==========

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
    
    await refreshAllWidgets();
    
    eventBus.on('transaction:added', refreshAllWidgets);
    eventBus.on('transaction:updated', refreshAllWidgets);
    eventBus.on('transaction:deleted', refreshAllWidgets);
    eventBus.on('credit:prepayment', refreshAllWidgets);
    eventBus.on('budget:updated', refreshAllWidgets);
    
    const addTransactionBtn = document.getElementById('addTransactionBtn');
    if (addTransactionBtn) {
        addTransactionBtn.addEventListener('click', () => {
            window.location.href = './transactions.html?action=new';
        });
    }
    
    isInitialized = true;
    console.log('[finance] Инициализация завершена');
}

export default { initFinancePage };