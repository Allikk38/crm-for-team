/**
 * ============================================
 * ФАЙЛ: js/pages/auth.js
 * РОЛЬ: Логика страницы авторизации (вход/регистрация) через Supabase
 * 
 * ОСОБЕННОСТИ:
 *   - Вход по email и паролю
 *   - Регистрация нового пользователя
 *   - Автоматическое создание профиля в таблице profiles
 *   - Перенаправление на дашборд после успешного входа
 *   - Проверка существующей сессии
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из auth-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';

// Элементы DOM
const messageDiv = document.getElementById('message');

console.log('[auth.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function showMessage(text, type) {
    if (!messageDiv) return;
    messageDiv.style.display = 'block';
    messageDiv.className = 'message ' + type;
    messageDiv.innerHTML = text;
    console.log(`[auth] Сообщение: [${type}] ${text}`);
}

// ========== ЛОГИН ==========

async function handleLogin() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    console.log('[auth] Попытка входа:', email);
    showMessage('Вход...', 'info');
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        console.error('[auth] Ошибка входа:', error.message);
        showMessage('Ошибка: ' + error.message, 'error');
        return;
    }
    
    if (data.user) {
        console.log('[auth] Успешный вход, пользователь:', data.user.email);
        showMessage('✅ Вход выполнен! Перенаправление...', 'success');
        setTimeout(() => {
            window.location.href = 'index-supabase.html';
        }, 1000);
    }
}

// ========== РЕГИСТРАЦИЯ ==========

async function handleRegister() {
    const email = document.getElementById('reg-email')?.value;
    const password = document.getElementById('reg-password')?.value;
    const fullName = document.getElementById('reg-name')?.value;
    
    if (!email || !password || !fullName) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    console.log('[auth] Попытка регистрации:', email);
    showMessage('Регистрация...', 'info');
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName }
        }
    });
    
    if (error) {
        console.error('[auth] Ошибка регистрации:', error.message);
        showMessage('Ошибка: ' + error.message, 'error');
        return;
    }
    
    if (data.user) {
        console.log('[auth] Успешная регистрация, пользователь:', data.user.email);
        
        // Создаем профиль в таблице profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: data.user.id,
                email: email,
                name: fullName,
                role: 'agent',
                github_username: email.split('@')[0],
                created_at: new Date().toISOString()
            }]);
        
        if (profileError) {
            console.error('[auth] Ошибка создания профиля:', profileError);
            showMessage('✅ Регистрация успешна! Но профиль создан с ошибкой. Обратитесь к администратору.', 'warning');
        } else {
            console.log('[auth] Профиль создан для:', fullName);
        }
        
        showMessage('✅ Регистрация успешна! Теперь войдите.', 'success');
        setTimeout(() => {
            showLogin();
        }, 2000);
    }
}

// ========== ПЕРЕКЛЮЧЕНИЕ ФОРМ ==========

function showRegister() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    
    if (messageDiv) {
        messageDiv.style.display = 'block';
        messageDiv.className = 'message info';
        messageDiv.innerHTML = 'Зарегистрируйтесь для доступа к системе';
    }
    console.log('[auth] Переключено на форму регистрации');
}

function showLogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    
    if (messageDiv) {
        messageDiv.style.display = 'block';
        messageDiv.className = 'message info';
        messageDiv.innerHTML = 'Используйте тестовые данные:<br>Email: test@crm.com<br>Пароль: test123456';
    }
    console.log('[auth] Переключено на форму входа');
}

// ========== ПРОВЕРКА СЕССИИ ==========

async function checkExistingSession() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        console.log('[auth] Найдена активная сессия:', user.email);
        showMessage(`✅ Вы уже авторизованы как ${user.email}. Перенаправление...`, 'success');
        setTimeout(() => {
            window.location.href = 'index-supabase.html';
        }, 1000);
    } else {
        console.log('[auth] Активная сессия не найдена');
    }
}

// ========== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ДЛЯ HTML ==========

window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showRegister = showRegister;
window.showLogin = showLogin;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initAuthPage() {
    console.log('[auth] Инициализация страницы...');
    await checkExistingSession();
    console.log('[auth] Инициализация завершена');
}