/**
 * ============================================
 * ФАЙЛ: js/pages/credit-detail.js
 * РОЛЬ: Логика детальной страницы кредита
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение информации о кредите
 *   - График платежей (таблица)
 *   - Калькулятор досрочного погашения
 *   - Внесение досрочного погашения с созданием транзакции
 *   - Поддержка URL параметров (id, prepayment)
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
let credit = null;
let accounts = [];
let categories = [];
let paymentSchedule = [];

// ID кредита из URL
let creditId = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initCreditDetailPage() {
    if (isInitialized) {
        console.log('[credit-detail] Страница уже инициализирована');
        return;
    }
    
    console.log('[credit-detail] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    // Получаем ID из URL
    const params = new URLSearchParams(window.location.search);
    creditId = params.get('id');
    
    if (!creditId) {
        alert('Кредит не найден');
        window.location.href = './credits.html';
        return;
    }
    
    // Загружаем данные
    await loadCreditData();
    await loadAccountsAndCategories();
    
    // Если есть параметр prepayment, подставляем сумму
    if (params.has('prepayment')) {
        const prepaymentAmount = params.get('prepayment');
        const input = document.getElementById('prepaymentAmount');
        if (input) {
            input.value = prepaymentAmount;
            setTimeout(() => calculatePrepayment(), 100);
        }
    }
    
    // Привязываем события
    bindEvents();
    
    isInitialized = true;
    console.log('[credit-detail] Инициализация завершена');
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadCreditData() {
    try {
        credit = await financeService.getCreditById(creditId);
        
        if (!credit) {
            alert('Кредит не найден');
            window.location.href = './credits.html';
            return;
        }
        
        renderCreditInfo();
        calculateAndRenderSchedule();
    } catch (error) {
        console.error('[credit-detail] Ошибка загрузки кредита:', error);
        alert('Ошибка загрузки данных');
    }
}

async function loadAccountsAndCategories() {
    try {
        [accounts, categories] = await Promise.all([
            financeService.getAccounts(),
            financeService.getCategories('expense')
        ]);
        
        populateModalSelects();
    } catch (error) {
        console.error('[credit-detail] Ошибка загрузки счетов и категорий:', error);
    }
}

function populateModalSelects() {
    const accountSelect = document.getElementById('modalAccount');
    const categorySelect = document.getElementById('modalCategory');
    
    if (accountSelect) {
        accountSelect.innerHTML = '<option value="">Выберите счёт</option>';
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = `${acc.name} (${acc.balance.toLocaleString()} ₽)`;
            accountSelect.appendChild(option);
        });
    }
    
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }
}

// ========== РЕНДЕРИНГ ИНФОРМАЦИИ ==========

function renderCreditInfo() {
    const container = document.getElementById('creditInfo');
    const nameEl = document.getElementById('creditName');
    const isCard = credit.credit_type === 'card';
    
    if (nameEl) {
        if (credit.bank) {
            nameEl.innerHTML = `${escapeHtml(credit.name)} <span style="font-size:0.9rem;color:var(--text-muted);">${escapeHtml(credit.bank)}</span>`;
        } else {
            nameEl.textContent = credit.name;
        }
    }
    
    if (!container) return;
    
    if (isCard) {
        // Кредитная карта
        const limit = credit.credit_limit || 0;
        const balance = credit.card_balance || 0;
        const available = limit - balance;
        const minPayment = credit.min_payment || 0;
        const planned = credit.planned_payment || minPayment;
        const graceEnd = credit.grace_period_end ? new Date(credit.grace_period_end).toLocaleDateString('ru') : '—';
        
        container.innerHTML = `
            <div class="credit-info-grid">
                <div class="info-item"><div class="info-label"><i class="fas fa-credit-card"></i> Тип</div><div class="info-value">💳 Кредитная карта</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-chart-line"></i> Лимит</div><div class="info-value">${limit.toLocaleString()} ₽</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-wallet"></i> Задолженность</div><div class="info-value highlight">${balance.toLocaleString()} ₽</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-piggy-bank"></i> Доступно</div><div class="info-value">${available.toLocaleString()} ₽</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-calendar-alt"></i> Мин. платёж</div><div class="info-value">${minPayment.toLocaleString()} ₽</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-calendar-check"></i> Планирую</div><div class="info-value">${planned.toLocaleString()} ₽</div></div>
                ${credit.rate ? `<div class="info-item"><div class="info-label"><i class="fas fa-percent"></i> Ставка</div><div class="info-value">${credit.rate}%</div></div>` : ''}
                <div class="info-item"><div class="info-label"><i class="fas fa-calendar"></i> Льготный период до</div><div class="info-value">${graceEnd}</div></div>
            </div>
            <div class="progress-section">
                <div class="progress-header"><span>Использовано лимита</span><span>${balance.toLocaleString()} / ${limit.toLocaleString()} ₽</span></div>
                <div class="progress-bar-large"><div class="progress-fill-large" style="width:${limit > 0 ? (balance / limit) * 100 : 0}%"></div></div>
            </div>
        `;
    } else {
        // Обычный кредит
        const balance = credit.balance || 0;
        const payment = credit.payment || 0;
        const rate = credit.rate || 0;
        const nextDate = credit.next_payment_date ? new Date(credit.next_payment_date).toLocaleDateString('ru') : '—';
        
        container.innerHTML = `
            <div class="credit-info-grid">
                <div class="info-item"><div class="info-label"><i class="fas fa-hand-holding-usd"></i> Тип</div><div class="info-value">💰 Кредит</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-wallet"></i> Остаток</div><div class="info-value highlight">${balance.toLocaleString()} ₽</div></div>
                <div class="info-item"><div class="info-label"><i class="fas fa-calendar-alt"></i> Платёж</div><div class="info-value">${payment.toLocaleString()} ₽</div></div>
                ${rate ? `<div class="info-item"><div class="info-label"><i class="fas fa-percent"></i> Ставка</div><div class="info-value">${rate}%</div></div>` : ''}
                <div class="info-item"><div class="info-label"><i class="fas fa-calendar"></i> След. платёж</div><div class="info-value">${nextDate}</div></div>
                ${credit.remaining_payments ? `<div class="info-item"><div class="info-label"><i class="fas fa-list"></i> Осталось платежей</div><div class="info-value">${credit.remaining_payments} мес.</div></div>` : ''}
            </div>
        `;
    }
}

function calculateEndDate() {
    const startDate = new Date(credit.start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + credit.term_months);
    return endDate.toLocaleDateString('ru');
}

// ========== ГРАФИК ПЛАТЕЖЕЙ ==========

function calculateAndRenderSchedule() {
    paymentSchedule = financeService.calculatePaymentSchedule(credit);
    renderScheduleTable();
}

function renderScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;
    
    if (paymentSchedule.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">Нет данных</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Показываем только первые 24 платежа для производительности
    const displaySchedule = paymentSchedule.slice(0, 24);
    
    tbody.innerHTML = displaySchedule.map(p => `
        <tr>
            <td>${p.month}</td>
            <td>${new Date(p.date).toLocaleDateString('ru')}</td>
            <td class="amount">${p.payment.toLocaleString()} ₽</td>
            <td class="amount">${p.interest.toLocaleString()} ₽</td>
            <td class="amount">${p.principal.toLocaleString()} ₽</td>
            <td class="amount">${p.balanceAfter.toLocaleString()} ₽</td>
        </tr>
    `).join('');
    
    if (paymentSchedule.length > 24) {
        tbody.innerHTML += `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                    <i class="fas fa-ellipsis-h"></i> 
                    и ещё ${paymentSchedule.length - 24} платежей
                </td>
            </tr>
        `;
    }
}

// ========== КАЛЬКУЛЯТОР ДОСРОЧНОГО ПОГАШЕНИЯ ==========

function calculatePrepayment() {
    const amountInput = document.getElementById('prepaymentAmount');
    const amount = parseFloat(amountInput?.value) || 0;
    
    if (amount <= 0) {
        resetPrepaymentResults();
        return;
    }
    
    if (amount > credit.balance) {
        alert('Сумма погашения не может превышать остаток по кредиту');
        return;
    }
    
    const result = financeService.calculatePrepayment(credit, amount);
    displayPrepaymentResults(result);
}

function displayPrepaymentResults(result) {
    const newBalanceEl = document.getElementById('newBalance');
    const interestSavedEl = document.getElementById('interestSaved');
    const monthsReducedEl = document.getElementById('monthsReduced');
    const newTermEl = document.getElementById('newTerm');
    
    if (newBalanceEl) newBalanceEl.textContent = `${result.newBalance.toLocaleString()} ₽`;
    if (interestSavedEl) interestSavedEl.textContent = `${result.interestSaved.toLocaleString()} ₽`;
    if (monthsReducedEl) monthsReducedEl.textContent = `${result.monthsReduced} мес.`;
    if (newTermEl) newTermEl.textContent = `${result.newTerm} мес.`;
}

function resetPrepaymentResults() {
    const newBalanceEl = document.getElementById('newBalance');
    const interestSavedEl = document.getElementById('interestSaved');
    const monthsReducedEl = document.getElementById('monthsReduced');
    const newTermEl = document.getElementById('newTerm');
    
    if (newBalanceEl) newBalanceEl.textContent = '— ₽';
    if (interestSavedEl) interestSavedEl.textContent = '— ₽';
    if (monthsReducedEl) monthsReducedEl.textContent = '— мес.';
    if (newTermEl) newTermEl.textContent = '— мес.';
}

// ========== МОДАЛЬНОЕ ОКНО ПЛАТЕЖА ==========

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (!modal) return;
    
    const amountInput = document.getElementById('prepaymentAmount');
    const modalAmountInput = document.getElementById('modalPrepaymentAmount');
    
    if (modalAmountInput && amountInput) {
        modalAmountInput.value = amountInput.value || '';
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

async function confirmPrepayment() {
    const amount = parseFloat(document.getElementById('modalPrepaymentAmount')?.value);
    const accountId = document.getElementById('modalAccount')?.value;
    const categoryId = document.getElementById('modalCategory')?.value;
    
    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }
    
    if (amount > credit.balance) {
        alert('Сумма погашения не может превышать остаток по кредиту');
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
    
    try {
        await financeService.makePrepayment(creditId, amount, categoryId, accountId);
        
        eventBus.emit('credit:prepayment', { creditId, amount });
        
        closePaymentModal();
        
        // Перезагружаем данные
        await loadCreditData();
        
        // Очищаем поле калькулятора
        const amountInput = document.getElementById('prepaymentAmount');
        if (amountInput) amountInput.value = '';
        resetPrepaymentResults();
        
        alert('Платёж успешно внесён');
    } catch (error) {
        console.error('[credit-detail] Ошибка внесения платежа:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ========== ЭКСПОРТ ГРАФИКА ==========

function exportSchedule() {
    if (paymentSchedule.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    // Формируем CSV
    let csv = 'Месяц,Дата,Платёж,Проценты,Основной долг,Остаток\n';
    
    paymentSchedule.forEach(p => {
        csv += `${p.month},${p.date},${p.payment},${p.interest},${p.principal},${p.balanceAfter}\n`;
    });
    
    // Скачиваем файл
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `credit_${credit.name}_schedule.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========== СОБЫТИЯ ==========

function bindEvents() {
    document.getElementById('backToCreditsBtn')?.addEventListener('click', () => {
        window.location.href = './credits.html';
    });
    
    document.getElementById('makePaymentBtn')?.addEventListener('click', openPaymentModal);
    
    document.getElementById('calculatePrepaymentBtn')?.addEventListener('click', calculatePrepayment);
    
    document.getElementById('applyPrepaymentBtn')?.addEventListener('click', () => {
        const amount = document.getElementById('prepaymentAmount')?.value;
        if (!amount || parseFloat(amount) <= 0) {
            alert('Введите сумму досрочного погашения');
            return;
        }
        openPaymentModal();
    });
    
    document.getElementById('exportScheduleBtn')?.addEventListener('click', exportSchedule);
    
    document.getElementById('confirmPaymentBtn')?.addEventListener('click', confirmPrepayment);
    document.getElementById('cancelPaymentModalBtn')?.addEventListener('click', closePaymentModal);
    
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePaymentModal();
        });
    }
    
    // Enter в поле суммы калькулятора
    document.getElementById('prepaymentAmount')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            calculatePrepayment();
        }
    });
}
// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// ========== ЭКСПОРТ ==========

export default { initCreditDetailPage };