/**
 * ============================================
 * ФАЙЛ: js/pages/auth.js
 * РОЛЬ: Логика страницы авторизации с поддержкой приглашений
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/team-supabase.js
 *   - js/services/email-check.js
 *   - js/utils/helpers.js
 * 
 * ИСТОРИЯ:
 *   - 01.04.2026: Исправлено использование company_id вместо team_id
 *   - 02.04.2026: Добавлена клиентская валидация email, debounce, улучшена обработка ошибок
 *   - 02.04.2026: ДОБАВЛЕН RATE LIMITING для защиты от 429 ошибок
 *   - 02.04.2026: ДОБАВЛЕНА ОЧИСТКА КЭША EMAIL при успешной регистрации
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { acceptInvite } from '../services/team-supabase.js';
import { validateEmailForRegistration, clearEmailCache } from '../services/email-check.js';
import { isValidEmail, formatSupabaseError, debounce } from '../utils/helpers.js';

let currentMode = 'login';
let inviteToken = null;
let referralToken = null;
let isRegistering = false; // Флаг для предотвращения множественных запросов

/**
 * Инициализация страницы авторизации
 */
export function initAuthPage() {
    console.log('[auth] Инициализация страницы');
    
    const urlParams = new URLSearchParams(window.location.search);
    inviteToken = urlParams.get('invite');
    referralToken = urlParams.get('referral');
    
    if (inviteToken) {
        console.log('[auth] Найден invite-токен:', inviteToken);
        const msgDiv = document.getElementById('message');
        if (msgDiv) {
            msgDiv.innerHTML = `
                <div class="message info">
                    <i class="fas fa-users"></i> Вас пригласили в команду!
                    Зарегистрируйтесь, чтобы присоединиться.
                </div>
            `;
        }
        showRegister();
    }
    
    if (referralToken) {
        console.log('[auth] Найден referral-токен:', referralToken);
        const msgDiv = document.getElementById('message');
        if (msgDiv) {
            msgDiv.innerHTML = `
                <div class="message info">
                    <i class="fas fa-gift"></i> Вас пригласили по реферальной ссылке!
                    При регистрации вы получите бонус.
                </div>
            `;
        }
        showRegister();
    }
    
    // Добавляем валидацию на ввод email в реальном времени
    const regEmailInput = document.getElementById('reg-email');
    if (regEmailInput) {
        regEmailInput.addEventListener('input', debounce(validateEmailField, 500));
    }
    
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.showLogin = showLogin;
    window.showRegister = showRegister;
}

/**
 * Валидация поля email в реальном времени
 */
async function validateEmailField() {
    const emailInput = document.getElementById('reg-email');
    const emailHint = document.getElementById('email-hint');
    
    if (!emailInput || !emailHint) return;
    
    const email = emailInput.value.trim();
    
    if (email === '') {
        emailHint.textContent = '';
        emailInput.classList.remove('valid', 'invalid');
        return;
    }
    
    // Проверка формата
    if (!isValidEmail(email)) {
        emailHint.textContent = '❌ Неверный формат email';
        emailHint.style.color = '#c33';
        emailInput.classList.remove('valid');
        emailInput.classList.add('invalid');
        return;
    }
    
    // Проверка существования email
    emailHint.textContent = '⏳ Проверка...';
    emailHint.style.color = '#666';
    
    const { valid, message } = await validateEmailForRegistration(email);
    
    if (valid) {
        emailHint.textContent = '✅ Email доступен';
        emailHint.style.color = '#3c6';
        emailInput.classList.remove('invalid');
        emailInput.classList.add('valid');
    } else {
        emailHint.textContent = `❌ ${message}`;
        emailHint.style.color = '#c33';
        emailInput.classList.remove('valid');
        emailInput.classList.add('invalid');
    }
}

/**
 * Установка состояния кнопки регистрации
 * @param {boolean} disabled - заблокировать или разблокировать
 * @param {string} text - текст на кнопке
 */
function setRegisterButtonState(disabled, text = null) {
    const btn = document.getElementById('register-btn');
    if (!btn) return;
    
    if (disabled) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = text || '⏳ Регистрация...';
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Зарегистрироваться';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

/**
 * Валидация формы регистрации
 * @returns {Promise<{valid: boolean, message: string|null}>}
 */
async function validateRegisterForm() {
    const email = document.getElementById('reg-email').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    
    // Проверка на пустые поля
    if (!email || !name || !password) {
        return { valid: false, message: 'Заполните все поля' };
    }
    
    // Проверка длины пароля
    if (password.length < 6) {
        return { valid: false, message: 'Пароль должен быть не менее 6 символов' };
    }
    
    // Проверка email
    if (!isValidEmail(email)) {
        return { valid: false, message: 'Введите корректный email (например, name@domain.com)' };
    }
    
    // Проверка существования email
    const { valid, message } = await validateEmailForRegistration(email);
    if (!valid) {
        return { valid: false, message };
    }
    
    return { valid: true, message: null };
}

// ========== ФУНКЦИИ RATE LIMITING ==========

/**
 * Проверка rate limit для регистрации
 * @returns {{allowed: boolean, waitSeconds?: number}}
 */
function checkRegistrationRateLimit() {
    const key = 'crm_registration_attempts';
    const attempts = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    
    // Очищаем старые попытки (старше 60 секунд)
    const recentAttempts = attempts.filter(t => now - t < 60000);
    
    // Сохраняем очищенный список обратно
    localStorage.setItem(key, JSON.stringify(recentAttempts));
    
    // Если больше 3 попыток за минуту - блокируем
    if (recentAttempts.length >= 3) {
        const oldestAttempt = Math.min(...recentAttempts);
        const waitSeconds = Math.ceil((oldestAttempt + 60000 - now) / 1000);
        return { allowed: false, waitSeconds };
    }
    
    return { allowed: true };
}

/**
 * Запись попытки регистрации
 */
function recordRegistrationAttempt() {
    const key = 'crm_registration_attempts';
    const attempts = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    
    // Оставляем только попытки за последнюю минуту
    const recentAttempts = attempts.filter(t => now - t < 60000);
    recentAttempts.push(now);
    localStorage.setItem(key, JSON.stringify(recentAttempts));
}

/**
 * Показать сообщение о блокировке с таймером
 * @param {number} seconds - сколько секунд ждать
 */
function showRateLimitMessage(seconds) {
    const msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    
    msgDiv.innerHTML = `
        <div class="message warning">
            <i class="fas fa-hourglass-half"></i> 
            Слишком много попыток регистрации. Подождите ${seconds} секунд.
        </div>
    `;
    msgDiv.className = 'message warning';
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        showMessage('Вход выполнен! Перенаправление...', 'success');
        
        if (inviteToken) {
            try {
                const result = await acceptInvite(inviteToken);
                if (result.success) {
                    showMessage('Вы добавлены в команду!', 'success');
                }
            } catch (e) {
                console.warn('[auth] Ошибка принятия приглашения:', e);
            }
        }
        
        setTimeout(() => {
            window.location.href = '/app/navigator.html';
        }, 1000);
        
    } catch (error) {
        console.error('[auth] Ошибка входа:', error);
        const userMessage = formatSupabaseError(error);
        showMessage(userMessage, 'error');
    }
}

async function handleRegister() {
    // Защита от множественных запросов
    if (isRegistering) {
        console.log('[auth] Регистрация уже выполняется, игнорирую повторный клик');
        return;
    }
    
    // ПРОВЕРКА RATE LIMIT
    const rateLimit = checkRegistrationRateLimit();
    if (!rateLimit.allowed) {
        showRateLimitMessage(rateLimit.waitSeconds);
        setRegisterButtonState(true, `⏳ Подождите ${rateLimit.waitSeconds} сек...`);
        
        // Автоматически разблокируем через указанное время
        setTimeout(() => {
            setRegisterButtonState(false);
            const msgDiv = document.getElementById('message');
            if (msgDiv && msgDiv.innerHTML.includes('Слишком много попыток')) {
                msgDiv.innerHTML = '';
                msgDiv.className = 'message';
            }
        }, rateLimit.waitSeconds * 1000);
        
        return;
    }
    
    // Валидация формы перед отправкой
    const validation = await validateRegisterForm();
    if (!validation.valid) {
        showMessage(validation.message, 'error');
        return;
    }
    
    const email = document.getElementById('reg-email').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    
    isRegistering = true;
    setRegisterButtonState(true);
    
    try {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });
        
        if (signUpError) throw signUpError;
        
        // УСПЕШНАЯ РЕГИСТРАЦИЯ - очищаем историю попыток и кэш email
        localStorage.removeItem('crm_registration_attempts');
        clearEmailCache(email);
        
        if (!authData.user) {
            throw new Error('Ошибка регистрации');
        }
        
        // Создаем профиль
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                name: name,
                email: email,
                role: 'agent',
                github_username: email.split('@')[0]
            });
        
        if (profileError) {
            console.error('[auth] Ошибка создания профиля:', profileError);
        }
        
        // Проверяем invite-токен
        if (inviteToken) {
            try {
                const result = await acceptInvite(inviteToken);
                if (result.success) {
                    showMessage('Вы добавлены в команду!', 'success');
                }
            } catch (e) {
                console.warn('[auth] Ошибка принятия приглашения:', e);
            }
        }
        
        // Проверяем referral-токен
        if (referralToken) {
            try {
                const result = await acceptInvite(referralToken);
                if (result.success && result.bonus) {
                    showMessage('Вы получили бонус!', 'success');
                }
            } catch (e) {
                console.warn('[auth] Ошибка активации реферала:', e);
            }
        }
        
        showMessage('Регистрация успешна! Перенаправление...', 'success');
        
        setTimeout(() => {
            window.location.href = '/app/navigator.html';
        }, 2000);
        
    } catch (error) {
        console.error('[auth] Ошибка регистрации:', error);
        const userMessage = formatSupabaseError(error);
        
        // ЗАПИСЫВАЕМ НЕУДАЧНУЮ ПОПЫТКУ
        recordRegistrationAttempt();
        
        showMessage(userMessage, 'error');
        
        // Если ошибка связана с email, обновляем подсказку
        if (userMessage.includes('email уже зарегистрирован') || 
            userMessage.includes('корректный email')) {
            const emailInput = document.getElementById('reg-email');
            const emailHint = document.getElementById('email-hint');
            if (emailInput && emailHint) {
                emailHint.textContent = `❌ ${userMessage}`;
                emailHint.style.color = '#c33';
                emailInput.classList.add('invalid');
            }
        }
    } finally {
        isRegistering = false;
        setRegisterButtonState(false);
    }
}

function showLogin() {
    currentMode = 'login';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
}

function showRegister() {
    currentMode = 'register';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

function showMessage(text, type) {
    const msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    
    setTimeout(() => {
        if (msgDiv.textContent === text) {
            msgDiv.className = 'message';
        }
    }, 5000);
}