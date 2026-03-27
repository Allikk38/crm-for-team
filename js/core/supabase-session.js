/**
 * ============================================
 * ФАЙЛ: js/core/supabase-session.js
 * РОЛЬ: Управление сессией Supabase (параллельно с существующей auth.js)
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * ============================================
 * 
 * ВНИМАНИЕ: Этот файл НЕ заменяет существующий auth.js
 * Он работает параллельно для новых страниц с суффиксом -supabase
 * 
 * Использование: импортировать в новые HTML-страницы вместо старого auth.js
 * ============================================
 */

import { supabase } from './supabase.js';

// Текущий пользователь Supabase
let currentSupabaseUser = null;

/**
 * Загрузить профиль пользователя из таблицы profiles
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object|null>}
 */
async function loadUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('[supabase-session] Ошибка загрузки профиля:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('[supabase-session] Ошибка загрузки профиля:', error);
        return null;
    }
}

/**
 * Проверить текущую сессию Supabase
 * @returns {Promise<Object|null>} Пользователь или null
 */
export async function checkSupabaseSession() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // Загружаем профиль из таблицы profiles
            const profile = await loadUserProfile(user.id);
            
            currentSupabaseUser = {
                id: user.id,
                email: user.email,
                name: profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь',
                role: profile?.role || 'agent',
                github_username: profile?.github_username || user.email?.split('@')[0] || user.id
            };
            
            console.log('[supabase-session] Пользователь загружен:', {
                name: currentSupabaseUser.name,
                role: currentSupabaseUser.role,
                github_username: currentSupabaseUser.github_username
            });
            
            return currentSupabaseUser;
        }
        
        return null;
    } catch (error) {
        console.error('[supabase-session] Ошибка проверки сессии:', error);
        return null;
    }
}

/**
 * Получить текущего пользователя Supabase
 * @returns {Object|null}
 */
export function getCurrentSupabaseUser() {
    return currentSupabaseUser;
}

/**
 * Выход из Supabase
 */
export async function logoutFromSupabase() {
    try {
        await supabase.auth.signOut();
        currentSupabaseUser = null;
        window.location.href = 'auth-supabase.html';
    } catch (error) {
        console.error('[supabase-session] Ошибка выхода:', error);
    }
}

/**
 * Проверить авторизацию для страницы (редирект если не авторизован)
 * @param {string} redirectUrl - URL для редиректа
 * @returns {Promise<boolean>}
 */
export async function requireSupabaseAuth(redirectUrl = 'auth-supabase.html') {
    const user = await checkSupabaseSession();
    
    if (!user) {
        const currentPath = window.location.pathname;
        // Не редиректим если уже на странице входа
        if (!currentPath.includes('auth-supabase')) {
            window.location.href = redirectUrl;
        }
        return false;
    }
    
    return true;
}

/**
 * Обновить интерфейс пользователя в top-bar (для страниц Supabase)
 */
export function updateSupabaseUserInterface() {
    const user = getCurrentSupabaseUser();
    if (!user) return;
    
    const userNameSpan = document.getElementById('userName');
    const userRoleSpan = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userNameSpan) {
        userNameSpan.textContent = user.name;
    }
    
    if (userRoleSpan) {
        let roleLabel = '';
        if (user.role === 'admin') roleLabel = 'Администратор';
        else if (user.role === 'manager') roleLabel = 'Менеджер';
        else if (user.role === 'agent') roleLabel = 'Агент';
        else roleLabel = 'Сотрудник';
        userRoleSpan.textContent = roleLabel;
    }
    
    if (userAvatar) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userAvatar.innerHTML = initials || '<i class="fas fa-user"></i>';
    }
}
