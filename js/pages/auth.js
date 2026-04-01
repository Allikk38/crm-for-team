/**
 * ============================================
 * ФАЙЛ: js/pages/auth.js
 * РОЛЬ: Логика страницы авторизации с поддержкой приглашений
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/team-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 01.04.2026: Исправлено использование company_id вместо team_id
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { acceptInvite } from '../services/team-supabase.js';

let currentMode = 'login';
let inviteToken = null;
let referralToken = null;

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
    
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.showLogin = showLogin;
    window.showRegister = showRegister;
}

async function handleLogin() {
    const email = document.getElementById('email').value;
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
        showMessage(error.message || 'Ошибка входа', 'error');
    }
}

async function handleRegister() {
    const email = document.getElementById('reg-email').value;
    const name = document.getElementById('reg-name').value;
    const password = document.getElementById('reg-password').value;
    
    if (!email || !name || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
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
        
        showMessage('Регистрация успешна!', 'success');
        
        setTimeout(() => {
            window.location.href = '/app/navigator.html';
        }, 2000);
        
    } catch (error) {
        console.error('[auth] Ошибка регистрации:', error);
        showMessage(error.message || 'Ошибка регистрации', 'error');
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