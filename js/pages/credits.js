/**
 * ============================================
 * ФАЙЛ: js/pages/credits.js
 * РОЛЬ: Логика страницы списка кредитов
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение кредитов в виде карточек
 *   - Поддержка кредитов и кредитных карт
 *   - Создание, редактирование, удаление
 *   - Статистика по всем кредитам
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase-session.js
 *   - js/services/finance-supabase.js
 *   - js/core/eventBus.js
 * 
 * ИСТОРИЯ:
 *   2026-04-08: Создание файла
 *   2026-04-08: Добавлена поддержка кредитных карт
 * ============================================
 */

import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import * as financeService from '../services/finance/index.js';
import { eventBus } from '../core/eventBus.js';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let isInitialized = false;
let credits = [];
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
    
    await loadCredits();
    bindEvents();
    
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
    const totalBalance = credits.reduce((sum, c) => {
        if (c.credit_type === 'card') return sum + (c.card_balance || 0);
        return sum + (c.balance || 0);
    }, 0);
    
    const totalMonthlyPayment = credits.reduce((sum, c) => {
        if (c.credit_type === 'card') return sum + (c.planned_payment || c.min_payment || 0);
        return sum + (c.payment || 0);
    }, 0);
    
    document.getElementById('totalBalance').textContent = `${totalBalance.toLocaleString()} ₽`;
    document.getElementById('totalMonthlyPayment').textContent = `${totalMonthlyPayment.toLocaleString()} ₽`;
    document.getElementById('creditsCount').textContent = credits.length;
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
                    <i class="fas fa-plus"></i> Добавить
                </button>
            </div>
        `;
        document.getElementById('emptyAddCreditBtn')?.addEventListener('click', () => openCreditModal());
        return;
    }
    
    grid.innerHTML = credits.map(credit => {
        const isCard = credit.credit_type === 'card';
        const balance = isCard ? credit.card_balance : credit.balance;
        const payment = isCard ? (credit.planned_payment || credit.min_payment) : credit.payment;
        const isActive = balance > 0;
        const icon = isCard ? 'fa-credit-card' : 'fa-hand-holding-usd';
        
        return `
            <div class="credit-card" data-id="${credit.id}">
                <div class="credit-card-header">
                    <div class="credit-name">
                        <i class="fas ${icon}"></i>
                        ${escapeHtml(credit.name)}
                        ${credit.bank ? `<span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">${escapeHtml(credit.bank)}</span>` : ''}
                    </div>
                    <span class="credit-status ${isActive ? 'active' : 'closed'}">
                        ${isCard ? '💳 Карта' : '💰 Кредит'}
                    </span>
                </div>
                
                <div class="credit-details">
                    ${isCard && credit.credit_limit ? `
                        <div class="credit-detail-row">
                            <span class="credit-detail-label">Лимит</span>
                            <span class="credit-detail-value">${credit.credit_limit.toLocaleString()} ₽</span>
                        </div>
                    ` : ''}
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">${isCard ? 'Задолженность' : 'Остаток'}</span>
                        <span class="credit-detail-value amount">${balance?.toLocaleString() || 0} ₽</span>
                    </div>
                    <div class="credit-detail-row">
                        <span class="credit-detail-label">Платёж</span>
                        <span class="credit-detail-value">${payment?.toLocaleString() || 0} ₽</span>
                    </div>
                    ${credit.rate ? `
                        <div class="credit-detail-row">
                            <span class="credit-detail-label">Ставка</span>
                            <span class="credit-detail-value">${credit.rate}%</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="credit-footer">
                    <div class="next-payment">
                        ${isCard && credit.grace_period_end ? `Льготный период до: ${new Date(credit.grace_period_end).toLocaleDateString('ru')}` : ''}
                        ${!isCard && credit.next_payment_date ? `След. платёж: ${new Date(credit.next_payment_date).toLocaleDateString('ru')}` : ''}
                    </div>
                    <div class="credit-actions">
                        <button class="credit-action-btn edit" data-id="${credit.id}">✏️</button>
                        <button class="credit-action-btn delete" data-id="${credit.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    grid.querySelectorAll('.credit-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.credit-actions')) return;
            window.location.href = `./credit-detail.html?id=${card.dataset.id}`;
        });
    });
    
    grid.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const credit = credits.find(c => c.id === btn.dataset.id);
            if (credit) openCreditModal(credit);
        });
    });
    
    grid.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCredit(btn.dataset.id);
        });
    });
}

function showEmptyState(message) {
    const grid = document.getElementById('creditsGrid');
    if (grid) grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${message}</p></div>`;
}

// ========== МОДАЛЬНОЕ ОКНО ==========

function openCreditModal(credit = null) {
    const modal = document.getElementById('creditModal');
    if (!modal) return;
    
    // Элементы
    const title = document.getElementById('modalTitle');
    const nameInput = document.getElementById('modalName');
    const bankSelect = document.getElementById('modalBankSelect');
    const bankOtherGroup = document.getElementById('modalBankOtherGroup');
    const bankOtherInput = document.getElementById('modalBankOther');
    const loanFields = document.getElementById('loanFields');
    const cardFields = document.getElementById('cardFields');
    const rateInput = document.getElementById('modalRate');
    const forecastBlock = document.getElementById('forecastBlock');
    const forecastContent = document.getElementById('forecastContent');
    
    // Радио-кнопки типа
    const radioLoan = document.querySelector('input[name="creditType"][value="loan"]');
    const radioCard = document.querySelector('input[name="creditType"][value="card"]');
    
    // Поля кредита
    const balanceInput = document.getElementById('modalBalance');
    const paymentInput = document.getElementById('modalPayment');
    const nextPaymentDateInput = document.getElementById('modalNextPaymentDate');
    
    // Поля карты
    const creditLimitInput = document.getElementById('modalCreditLimit');
    const cardBalanceInput = document.getElementById('modalCardBalance');
    const minPaymentInput = document.getElementById('modalMinPayment');
    const plannedPaymentInput = document.getElementById('modalPlannedPayment');
    const gracePeriodEndInput = document.getElementById('modalGracePeriodEnd');
    
    // Дополнительно
    const remainingPaymentsInput = document.getElementById('modalRemainingPayments');
    const lastPaymentInput = document.getElementById('modalLastPayment');
    
    // Переключение типа
    const toggleType = () => {
        const isCard = radioCard.checked;
        loanFields.style.display = isCard ? 'none' : 'block';
        cardFields.style.display = isCard ? 'block' : 'none';
        updateForecast();
    };
    
    radioLoan.onchange = toggleType;
    radioCard.onchange = toggleType;
    
    // Банк "Другой"
    bankSelect.onchange = () => {
        bankOtherGroup.style.display = bankSelect.value === 'other' ? 'block' : 'none';
    };
    
    // Сворачивание доп. полей
    const toggle = document.getElementById('showAdvancedToggle');
    const advancedFields = document.getElementById('advancedFields');
    const toggleIcon = document.getElementById('advancedToggleIcon');
    
    if (toggle) {
        toggle.onclick = () => {
            const isHidden = advancedFields.style.display === 'none';
            advancedFields.style.display = isHidden ? 'block' : 'none';
            toggleIcon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        };
    }
    
    // Прогноз
    const updateForecast = () => {
        const isCard = radioCard.checked;
        let html = '';
        
        if (isCard) {
            const balance = parseFloat(cardBalanceInput.value) || 0;
            const planned = parseFloat(plannedPaymentInput.value) || parseFloat(minPaymentInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            
            if (balance > 0 && planned > 0) {
                if (rate > 0) {
                    const monthlyRate = rate / 100 / 12;
                    let tempBalance = balance;
                    let months = 0;
                    let totalInterest = 0;
                    
                    while (tempBalance > 0 && months < 600) {
                        const interest = tempBalance * monthlyRate;
                        const principal = Math.min(planned - interest, tempBalance);
                        if (principal <= 0) { months = 999; break; }
                        tempBalance -= principal;
                        totalInterest += interest;
                        months++;
                    }
                    
                    if (months >= 999) {
                        html = `⚠️ Платёж меньше процентов!`;
                    } else {
                        const years = Math.floor(months / 12);
                        const m = months % 12;
                        html = `При платеже ${planned.toLocaleString()} ₽:<br>`;
                        html += `Закроете за ${months} мес. (${years} г. ${m} мес.)<br>`;
                        html += `Переплата: ~${Math.round(totalInterest).toLocaleString()} ₽`;
                    }
                } else {
                    const months = Math.ceil(balance / planned);
                    const years = Math.floor(months / 12);
                    const m = months % 12;
                    html = `Закроете за ${months} мес. (${years} г. ${m} мес.)`;
                }
            } else {
                html = 'Введите задолженность и платёж';
            }
        } else {
            const balance = parseFloat(balanceInput.value) || 0;
            const payment = parseFloat(paymentInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            const remaining = parseInt(remainingPaymentsInput.value) || 0;
            
            if (balance > 0 && payment > 0) {
                let monthsLeft;
                
                if (remaining > 0) {
                    monthsLeft = remaining;
                } else if (rate > 0) {
                    const monthlyRate = rate / 100 / 12;
                    let tempBalance = balance;
                    monthsLeft = 0;
                    while (tempBalance > 0 && monthsLeft < 600) {
                        const interest = tempBalance * monthlyRate;
                        const principal = Math.min(payment - interest, tempBalance);
                        if (principal <= 0) { monthsLeft = 999; break; }
                        tempBalance -= principal;
                        monthsLeft++;
                    }
                } else {
                    monthsLeft = Math.ceil(balance / payment);
                }
                
                const years = Math.floor(monthsLeft / 12);
                const m = monthsLeft % 12;
                html = `Осталось ${monthsLeft} мес. (${years} г. ${m} мес.)`;
            } else {
                html = 'Введите остаток и платёж';
            }
        }
        
        forecastContent.innerHTML = html;
        forecastBlock.style.display = 'block';
    };
    
    // Привязка событий
    const inputs = [balanceInput, paymentInput, rateInput, remainingPaymentsInput, 
                    cardBalanceInput, minPaymentInput, plannedPaymentInput];
    inputs.forEach(i => {
        if (i) {
            i.removeEventListener('input', updateForecast);
            i.addEventListener('input', updateForecast);
        }
    });
    
    // Заполнение при редактировании
    if (credit) {
        editingCreditId = credit.id;
        title.innerHTML = '<i class="fas fa-edit"></i> Редактировать';
        nameInput.value = credit.name || '';
        
        const isCard = credit.credit_type === 'card';
        if (isCard) {
            radioCard.checked = true;
            loanFields.style.display = 'none';
            cardFields.style.display = 'block';
            creditLimitInput.value = credit.credit_limit || '';
            cardBalanceInput.value = credit.card_balance || '';
            minPaymentInput.value = credit.min_payment || '';
            plannedPaymentInput.value = credit.planned_payment || '';
            gracePeriodEndInput.value = credit.grace_period_end || '';
        } else {
            radioLoan.checked = true;
            loanFields.style.display = 'block';
            cardFields.style.display = 'none';
            balanceInput.value = credit.balance || '';
            paymentInput.value = credit.payment || '';
            nextPaymentDateInput.value = credit.next_payment_date || '';
        }
        
        rateInput.value = credit.rate || '';
        remainingPaymentsInput.value = credit.remaining_payments || '';
        lastPaymentInput.value = credit.last_payment_amount || '';
        
        if (credit.bank) {
            const option = Array.from(bankSelect.options).find(opt => opt.value === credit.bank);
            if (option) bankSelect.value = credit.bank;
            else {
                bankSelect.value = 'other';
                bankOtherGroup.style.display = 'block';
                bankOtherInput.value = credit.bank;
            }
        }
        
        if (credit.rate || credit.remaining_payments) {
            advancedFields.style.display = 'block';
            toggleIcon.style.transform = 'rotate(90deg)';
        }
    } else {
        editingCreditId = null;
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Новый';
        nameInput.value = '';
        bankSelect.value = '';
        bankOtherGroup.style.display = 'none';
        bankOtherInput.value = '';
        radioLoan.checked = true;
        loanFields.style.display = 'block';
        cardFields.style.display = 'none';
        balanceInput.value = '';
        paymentInput.value = '';
        nextPaymentDateInput.value = '';
        creditLimitInput.value = '';
        cardBalanceInput.value = '';
        minPaymentInput.value = '';
        plannedPaymentInput.value = '';
        gracePeriodEndInput.value = '';
        rateInput.value = '';
        remainingPaymentsInput.value = '';
        lastPaymentInput.value = '';
        advancedFields.style.display = 'none';
        toggleIcon.style.transform = 'rotate(0deg)';
        forecastBlock.style.display = 'none';
    }
    
    updateForecast();
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
    const bankSelect = document.getElementById('modalBankSelect');
    const bankOther = document.getElementById('modalBankOther').value.trim();
    const isCard = document.querySelector('input[name="creditType"]:checked').value === 'card';
    
    let bank = bankSelect.value;
    if (bank === 'other') bank = bankOther || 'Другой банк';
    
    if (!name) { alert('Введите название'); return; }
    
    let creditData = {
        name,
        bank: bank || null,
        credit_type: isCard ? 'card' : 'loan',
        rate: parseFloat(document.getElementById('modalRate').value) || null,
        remaining_payments: parseInt(document.getElementById('modalRemainingPayments').value) || null,
        last_payment_amount: parseFloat(document.getElementById('modalLastPayment').value) || null
    };
    
    if (isCard) {
        creditData.credit_limit = parseFloat(document.getElementById('modalCreditLimit').value) || null;
        creditData.card_balance = parseFloat(document.getElementById('modalCardBalance').value) || 0;
        creditData.min_payment = parseFloat(document.getElementById('modalMinPayment').value) || null;
        creditData.planned_payment = parseFloat(document.getElementById('modalPlannedPayment').value) || null;
        creditData.grace_period_end = document.getElementById('modalGracePeriodEnd').value || null;
        
        if (!creditData.card_balance || creditData.card_balance <= 0) {
            alert('Введите задолженность'); return;
        }
    } else {
        creditData.balance = parseFloat(document.getElementById('modalBalance').value) || 0;
        creditData.payment = parseFloat(document.getElementById('modalPayment').value) || 0;
        creditData.next_payment_date = document.getElementById('modalNextPaymentDate').value || null;
        
        if (!creditData.balance || creditData.balance <= 0) {
            alert('Введите остаток'); return;
        }
        if (!creditData.payment || creditData.payment <= 0) {
            alert('Введите платёж'); return;
        }
    }
    
    try {
        if (editingCreditId) {
            await financeService.updateCredit(editingCreditId, creditData);
        } else {
            await financeService.createCredit(creditData);
        }
        closeModal();
        await loadCredits();
    } catch (error) {
        console.error('[credits] Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function deleteCredit(id) {
    if (!confirm('Удалить?')) return;
    try {
        await financeService.deleteCredit(id);
        await loadCredits();
    } catch (error) {
        alert('Ошибка: ' + error.message);
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
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default { initCreditsPage };
