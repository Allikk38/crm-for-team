/**
 * ============================================
 * ФАЙЛ: js/pages/credits.js
 * РОЛЬ: Логика страницы списка кредитов
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение кредитов в виде карточек
 *   - Создание, редактирование, удаление кредитов
 *   - Расчёт аннуитетного платежа при создании
 *   - Статистика по всем кредитам
 *   - Переход на детальную страницу
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
let credits = [];

// Редактируемый кредит
let editingCreditId = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initCreditsPage() {
    if (isInitialized) {
        console.log('[credits] Страница уже инициализирована');
        return;
    }
    
    console.log('[credits] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    // Загружаем кредиты
    await loadCredits();
    
    // Привязываем события
    bindEvents();
    
    // Подписываемся на события eventBus
    eventBus.on('credit:prepayment', () => loadCredits());
    
    isInitialized = true;
    console.log('[credits] Инициализация завершена');
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadCredits() {
    try {
        credits = await financeService.getCredits();
        renderCredits();
        updateSummary();
    } catch (error) {
        console.error('[credits] Ошибка загрузки кредитов:', error);
        showEmptyState('Ошибка загрузки данных');
    }
}

// ========== СТАТИСТИКА ==========

function updateSummary() {
    const totalBalance = credits.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalMonthlyPayment = credits
        .filter(c => c.balance > 0)
        .reduce((sum, c) => sum + (c.payment || 0), 0);
    
    const totalBalanceEl = document.getElementById('totalBalance');
    const totalMonthlyPaymentEl = document.getElementById('totalMonthlyPayment');
    const creditsCountEl = document.getElementById('creditsCount');
    
    if (totalBalanceEl) totalBalanceEl.textContent = `${totalBalance.toLocaleString()} ₽`;
    if (totalMonthlyPaymentEl) totalMonthlyPaymentEl.textContent = `${totalMonthlyPayment.toLocaleString()} ₽`;
    if (creditsCountEl) creditsCountEl.textContent = credits.length;
}

// ========== РЕНДЕРИНГ ==========

function renderCredits() {
    const grid = document.getElementById('creditsGrid');
    if (!grid) return;
    
    if (credits.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-percent"></i>
                <p>Нет кредитов</p>
                <button class="btn btn-primary" id="emptyAddCreditBtn" style="margin-top: 20px;">
                    <i class="fas fa-plus"></i>
                    Добавить кредит
                </button>
            </div>
        `;
        
        const emptyBtn = document.getElementById('emptyAddCreditBtn');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => openCreditModal());
        }
        return;
    }
    
    grid.innerHTML = credits.map(credit => {
        const paidAmount = credit.amount - credit.balance;
        const paidPercent = (paidAmount / credit.amount) * 100;
        const isActive = credit.balance > 0;
        const nextPaymentDate = calculateNextPaymentDate(credit);
        
        return `
            <div class="credit-card" data-id="${credit.id}">
                <div class="credit-card-header">
                    <div class="credit-name">
                        <i class="fas fa-credit-card"></i>
                        ${escapeHtml(credit.name)}
                    </div>
                    <span class="credit-status ${isActive ? 'active' : 'closed'}">
                        ${isActive ? 'Активный' : 'Закрыт'}
                    </span>
                </div>
                
                <div class="credit-details">
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">Сумма кредита</span>
                        <span class="credit-detail-value">${credit.amount.toLocaleString()} ₽</span>
                    </div>
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">Остаток</span>
                        <span class="credit-detail-value amount">${credit.balance.toLocaleString()} ₽</span>
                    </div>
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">Ставка</span>
                        <span class="credit-detail-value">${credit.rate}%</span>
                    </div>
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">Ежемесячный платёж</span>
                        <span class="credit-detail-value">${credit.payment.toLocaleString()} ₽</span>
                    </div>
                </div>
                
                <div class="credit-progress">
                    <div class="credit-progress-info">
                        <span>Погашено</span>
                        <span>${paidPercent.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${paidPercent}%"></div>
                    </div>
                </div>
                
                <div class="credit-footer">
                    <div class="next-payment">
                        ${isActive ? `
                            Следующий платёж: 
                            <span class="next-payment-date">${nextPaymentDate}</span>
                        ` : 'Кредит закрыт'}
                    </div>
                    <div class="credit-actions">
                        <button class="credit-action-btn edit" data-id="${credit.id}" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="credit-action-btn delete" data-id="${credit.id}" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Привязываем события
    grid.querySelectorAll('.credit-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.credit-actions')) return;
            const id = card.dataset.id;
            window.location.href = `./credit-detail.html?id=${id}`;
        });
    });
    
    grid.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const credit = credits.find(c => c.id === id);
            if (credit) openCreditModal(credit);
        });
    });
    
    grid.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteCredit(id);
        });
    });
}

function showEmptyState(message) {
    const grid = document.getElementById('creditsGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

function calculateNextPaymentDate(credit) {
    if (credit.balance <= 0) return null;
    
    const today = new Date();
    const startDate = new Date(credit.start_date);
    
    let nextPaymentDate = new Date(startDate);
    while (nextPaymentDate < today) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    }
    
    return nextPaymentDate.toLocaleDateString('ru', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

// ========== МОДАЛЬНОЕ ОКНО ==========

function openCreditModal(credit = null) {
    const modal = document.getElementById('creditModal');
    if (!modal) return;
    
    const title = document.getElementById('modalTitle');
    const nameInput = document.getElementById('modalName');
    const amountInput = document.getElementById('modalAmount');
    const rateInput = document.getElementById('modalRate');
    const termInput = document.getElementById('modalTerm');
    const startDateInput = document.getElementById('modalStartDate');
    const calculationBlock = document.getElementById('paymentCalculation');
    const calculatedPayment = document.getElementById('calculatedPayment');
    
    if (credit) {
        editingCreditId = credit.id;
        title.innerHTML = '<i class="fas fa-edit"></i> Редактировать кредит';
        nameInput.value = credit.name;
        amountInput.value = credit.amount;
        rateInput.value = credit.rate;
        termInput.value = credit.term_months;
        startDateInput.value = credit.start_date;
        
        if (calculationBlock) calculationBlock.style.display = 'block';
        if (calculatedPayment) {
            calculatedPayment.textContent = `${credit.payment.toLocaleString()} ₽`;
        }
    } else {
        editingCreditId = null;
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Новый кредит';
        nameInput.value = '';
        amountInput.value = '';
        rateInput.value = '';
        termInput.value = '';
        startDateInput.value = new Date().toISOString().split('T')[0];
        
        if (calculationBlock) calculationBlock.style.display = 'none';
    }
    
    // Функция расчёта платежа
    const calculatePayment = () => {
        const amount = parseFloat(amountInput.value);
        const rate = parseFloat(rateInput.value);
        const term = parseInt(termInput.value);
        
        if (amount > 0 && rate >= 0 && term > 0) {
            const payment = financeService.calculateAnnuityPayment(amount, rate, term);
            if (calculationBlock) calculationBlock.style.display = 'block';
            if (calculatedPayment) {
                calculatedPayment.textContent = `${payment.toLocaleString()} ₽`;
            }
        } else {
            if (calculationBlock) calculationBlock.style.display = 'none';
        }
    };
    
    // Привязываем расчёт к полям
    [amountInput, rateInput, termInput].forEach(input => {
        input.removeEventListener('input', calculatePayment);
        input.addEventListener('input', calculatePayment);
    });
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('creditModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    editingCreditId = null;
}

async function saveCredit() {
    const name = document.getElementById('modalName').value.trim();
    const amount = parseFloat(document.getElementById('modalAmount').value);
    const rate = parseFloat(document.getElementById('modalRate').value);
    const termMonths = parseInt(document.getElementById('modalTerm').value);
    const startDate = document.getElementById('modalStartDate').value;
    
    if (!name) {
        alert('Введите название кредита');
        return;
    }
    
    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }
    
    if (rate < 0) {
        alert('Введите корректную ставку');
        return;
    }
    
    if (!termMonths || termMonths <= 0) {
        alert('Введите корректный срок');
        return;
    }
    
    if (!startDate) {
        alert('Выберите дату начала');
        return;
    }
    
    try {
        if (editingCreditId) {
            await financeService.updateCredit(editingCreditId, {
                name,
                amount,
                rate,
                term_months: termMonths,
                start_date: startDate
            });
        } else {
            await financeService.createCredit({
                name,
                amount,
                rate,
                term_months: termMonths,
                start_date: startDate
            });
        }
        
        closeModal();
        await loadCredits();
    } catch (error) {
        console.error('[credits] Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

async function deleteCredit(id) {
    if (!confirm('Удалить кредит? Все данные будут потеряны.')) return;
    
    try {
        await financeService.deleteCredit(id);
        await loadCredits();
    } catch (error) {
        console.error('[credits] Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
}

// ========== СОБЫТИЯ ==========

function bindEvents() {
    document.getElementById('addCreditBtn')?.addEventListener('click', () => openCreditModal());  
    document.getElementById('backToFinanceBtn')?.addEventListener('click', () => {
    window.location.href = './finance.html';
});
    
    document.getElementById('saveCreditBtn')?.addEventListener('click', saveCredit);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    
    const modal = document.getElementById('creditModal');
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

export default { initCreditsPage };