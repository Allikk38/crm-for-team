/**
 * ============================================
 * ФАЙЛ: js/pages/auth.js
 * РОЛЬ: Логика страницы авторизации с поддержкой приглашений
 * 
 * ИСТОРИЯ:
 *   - 01.04.2026: Исправлено использование company_id вместо team_id
 *   - 02.04.2026: Добавлена клиентская валидация email, debounce
 *   - 02.04.2026: ДОБАВЛЕН RATE LIMITING для защиты от 429 ошибок
 *   - 02.04.2026: ДОБАВЛЕНА ОЧИСТКА КЭША EMAIL при успешной регистрации
 *   - 08.04.2026: ИСПРАВЛЕН редирект для GitHub Pages
 *   - 08.04.2026: УДАЛЕНО создание профиля (теперь через Database Trigger)
 *   - 08.04.2026: ДОБАВЛЕНА обработка подтверждения email (verifyOtp)
 *   - 10.04.2026: УДАЛЕНЫ ГЛОБАЛЬНЫЕ ФУНКЦИИ (window.handleLogin и др.)
 *                 Переход на чистые ES6 модули и addEventListener.
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { acceptInvite } from '../services/team-supabase.js';
import { validateEmailForRegistration, clearEmailCache } from '../services/email-check.js';
import { isValidEmail, formatSupabaseError, debounce } from '../utils/helpers.js';

let currentMode = 'login';
let inviteToken = null;
let referralToken = null;
let isRegistering = false;

// ========== ОПРЕДЕЛЕНИЕ БАЗОВОГО ПУТИ ДЛЯ GITHUB PAGES ==========
function getBasePath() {
    const fullPath = window.location.pathname;
    const match = fullPath.match(/^(\/crm-for-team)/);
    if (match) return match[1];
    if (window.location.hostname.includes('github.io')) {
        const parts = fullPath.split('/');
        if (parts.length > 1 && parts[1] && parts[1] !== 'app') return `/${parts[1]}`;
    }
    return '';
}

const BASE_PATH = getBasePath();

function getRedirectUrl(page) {
    return BASE_PATH ? `${BASE_PATH}/app/${page}` : `/app/${page}`;
}

// ========== ОБРАБОТКА ПОДТВЕРЖДЕНИЯ EMAIL (из ссылки в письме) ==========
async function handleEmailConfirmation() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Проверяем токен в URL (Supabase передаёт в хэше или query)
    const tokenHash = urlParams.get('token_hash') || 
                      (hash.includes('access_token') ? hash.split('=')[1]?.split('&')[0] : null);
    const type = urlParams.get('type') || 'email';
    
    if (!tokenHash) return false;
    
    console.log('[auth] Обнаружен токен подтверждения, верифицируем...');
    
    try {
        const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type
        });
        
        if (error) throw error;
        
        console.log('[auth] Email подтверждён успешно');
        
        // Очищаем URL от токена
        window.location.hash = '';
        const newUrl = window.location.pathname + (inviteToken ? `?invite=${inviteToken}` : '');
        window.history.replaceState({}, document.title, newUrl);
        
        // Показываем сообщение об успехе
        const msgDiv = document.getElementById('message');
        if (msgDiv) {
            msgDiv.innerHTML = `
                <div class="message success">
                    <i class="fas fa-check-circle"></i> Email подтверждён! Теперь вы можете войти.
                </div>
            `;
        }
        
        // Переключаем на форму входа
        showLogin();
        
        return true;
    } catch (error) {
        console.error('[auth] Ошибка подтверждения email:', error);
        const msgDiv = document.getElementById('message');
        if (msgDiv) {
            msgDiv.innerHTML = `
                <div class="message error">
                    <i class="fas fa-exclamation-circle"></i> Ошибка подтверждения. Возможно, ссылка устарела.
                </div>
            `;
        }
        return false;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI ==========

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

// ========== ВАЛИДАЦИЯ ==========

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
    
    if (!isValidEmail(email)) {
        emailHint.textContent = '❌ Неверный формат email';
        emailHint.style.color = '#c33';
        emailInput.classList.remove('valid');
        emailInput.classList.add('invalid');
        return;
    }
    
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

async function validateRegisterForm() {
    const email = document.getElementById('reg-email').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    
    if (!email || !name || !password) {
        return { valid: false, message: 'Заполните все поля' };
    }
    
    if (password.length < 6) {
        return { valid: false, message: 'Пароль должен быть не менее 6 символов' };
    }
    
    if (!isValidEmail(email)) {
        return { valid: false, message: 'Введите корректный email' };
    }
    
    const { valid, message } = await validateEmailForRegistration(email);
    if (!valid) {
        return { valid: false, message };
    }
    
    return { valid: true, message: null };
}

// ========== RATE LIMITING ==========

function checkRegistrationRateLimit() {
    const key = 'crm_registration_attempts';
    const attempts = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    
    const recentAttempts = attempts.filter(t => now - t < 60000);
    localStorage.setItem(key, JSON.stringify(recentAttempts));
    
    if (recentAttempts.length >= 3) {
        const oldestAttempt = Math.min(...recentAttempts);
        const waitSeconds = Math.ceil((oldestAttempt + 60000 - now) / 1000);
        return { allowed: false, waitSeconds };
    }
    
    return { allowed: true };
}

function recordRegistrationAttempt() {
    const key = 'crm_registration_attempts';
    const attempts = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    
    const recentAttempts = attempts.filter(t => now - t < 60000);
    recentAttempts.push(now);
    localStorage.setItem(key, JSON.stringify(recentAttempts));
}

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

// ========== ОСНОВНЫЕ ДЕЙСТВИЯ ==========

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
        
        // Если есть inviteToken, принимаем приглашение ПОСЛЕ входа
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
            window.location.href = getRedirectUrl('navigator.html');
        }, 1000);
        
    } catch (error) {
        console.error('[auth] Ошибка входа:', error);
        const userMessage = formatSupabaseError(error);
        showMessage(userMessage, 'error');
    }
}

async function handleRegister() {
    if (isRegistering) {
        console.log('[auth] Регистрация уже выполняется');
        return;
    }
    
    const rateLimit = checkRegistrationRateLimit();
    if (!rateLimit.allowed) {
        showRateLimitMessage(rateLimit.waitSeconds);
        setRegisterButtonState(true, `⏳ Подождите ${rateLimit.waitSeconds} сек...`);
        
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
        // Подготавливаем метаданные
        const userMetadata = {
            full_name: name
        };
        
        // Если есть приглашение, сохраняем токен в метаданных
        if (inviteToken) {
            userMetadata.invite_token = inviteToken;
        }
        if (referralToken) {
            userMetadata.referral_token = referralToken;
        }
        
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: userMetadata
            }
        });
        
        if (signUpError) throw signUpError;
        
        // Очищаем rate limit и кэш email
        localStorage.removeItem('crm_registration_attempts');
        clearEmailCache(email);
        
        // Профиль НЕ создаём здесь — его создаст Database Trigger при подтверждении email
        
        console.log('[auth] Регистрация успешна, ожидается подтверждение email');
        
        // Показываем сообщение о необходимости подтверждения
        const msgDiv = document.getElementById('message');
        if (msgDiv) {
            msgDiv.innerHTML = `
                <div class="message success">
                    <i class="fas fa-envelope"></i> 
                    Регистрация успешна! Проверьте почту и перейдите по ссылке для подтверждения email.
                </div>
            `;
        }
        
        // Переключаем на форму входа
        showLogin();
        
        // Очищаем форму регистрации
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-password').value = '';
        
    } catch (error) {
        console.error('[auth] Ошибка регистрации:', error);
        const userMessage = formatSupabaseError(error);
        
        recordRegistrationAttempt();
        
        showMessage(userMessage, 'error');
        
        if (userMessage.includes('email уже зарегистрирован')) {
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

// ========== ПРИВЯЗКА СОБЫТИЙ ==========

function bindEvents() {
    // Кнопка входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const loginBtn = loginForm.querySelector('button');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogin();
            });
        }
        
        // Enter в полях ввода
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
        });
    }
    
    // Кнопка регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleRegister();
            });
        }
        
        // Enter в полях ввода
        const inputs = registerForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRegister();
                }
            });
        });
    }
    
    // Переключение режимов
    document.querySelectorAll('.switch-mode').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const text = el.textContent.toLowerCase();
            if (text.includes('войти') || text.includes('аккаунт')) {
                showLogin();
            } else {
                showRegister();
            }
        });
    });
    
    // Валидация email при вводе
    const regEmailInput = document.getElementById('reg-email');
    if (regEmailInput) {
        regEmailInput.addEventListener('input', debounce(validateEmailField, 500));
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

/**
 * Инициализация страницы авторизации
 */
export function initAuthPage() {
    console.log('[auth] Инициализация страницы, BASE_PATH:', BASE_PATH);
    
    const urlParams = new URLSearchParams(window.location.search);
    inviteToken = urlParams.get('invite');
    referralToken = urlParams.get('referral');
    
    // Привязываем события
    bindEvents();
    
    // Сначала проверяем, не пришёл ли пользователь по ссылке подтверждения
    handleEmailConfirmation().then(confirmed => {
        if (confirmed) return;
        
        // Обычная инициализация
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
    });
}
