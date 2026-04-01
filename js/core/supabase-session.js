/**
 * ============================================
 * ФАЙЛ: js/core/supabase-session.js
 * РОЛЬ: Управление сессией Supabase (параллельно с существующей auth.js)
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/cache-service.js
 * ============================================
 * 
 * ВНИМАНИЕ: Этот файл НЕ заменяет существующий auth.js
 * Он работает параллельно для новых страниц с суффиксом -supabase
 * 
 * Использование: импортировать в новые HTML-страницы вместо старого auth.js
 * ============================================
 * 
 * ИСТОРИЯ ОБНОВЛЕНИЙ:
 *   - 30.03.2026: Добавлено поле permission_sets для поддержки новой системы прав
 *   - 02.04.2026: ДОБАВЛЕНО КЭШИРОВАНИЕ профиля пользователя
 *   - 02.04.2026: ИСПРАВЛЕН порядок обновления глобальной переменной и отправки события userLoaded
 * ============================================
 */

import { supabase } from './supabase.js';
import cacheService from '../services/cache-service.js';

// Текущий пользователь Supabase (кэш в памяти)
let currentSupabaseUser = null;

// Глобальная переменная для layout.js
window.currentSupabaseUser = null;

/**
 * Обновить глобальную переменную для layout.js
 */
function updateGlobalUser() {
    window.currentSupabaseUser = currentSupabaseUser;
}

/**
 * Загрузить профиль пользователя из таблицы profiles (с кэшированием)
 * @param {string} userId - ID пользователя
 * @param {boolean} forceRefresh - принудительно обновить кэш
 * @returns {Promise<Object|null>}
 */
async function loadUserProfile(userId, forceRefresh = false) {
    const cacheKey = `user_profile_${userId}`;
    
    // Пытаемся получить из кэша
    if (!forceRefresh) {
        const cached = cacheService.get(cacheKey, 'session');
        if (cached) {
            return cached;
        }
    }
    
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
        
        // Сохраняем в кэш (TTL 30 минут = 1800 секунд)
        if (data) {
            cacheService.set(cacheKey, data, { ttl: 1800, storage: 'session' });
        }
        
        return data;
    } catch (error) {
        console.error('[supabase-session] Ошибка загрузки профиля:', error);
        return null;
    }
}

/**
 * Проверить текущую сессию Supabase
 * @param {boolean} forceRefresh - принудительно обновить кэш
 * @returns {Promise<Object|null>} Пользователь или null
 */
export async function checkSupabaseSession(forceRefresh = false) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // Загружаем профиль из таблицы profiles (с кэшированием)
            const profile = await loadUserProfile(user.id, forceRefresh);
            
            currentSupabaseUser = {
                id: user.id,
                email: user.email,
                name: profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь',
                role: profile?.role || 'agent',
                permission_sets: profile?.permission_sets || ['BASE'],
                github_username: profile?.github_username || user.email?.split('@')[0] || user.id
            };
            
            // СНАЧАЛА обновляем глобальную переменную для layout.js
            updateGlobalUser();
            
            // ПОТОМ отправляем событие (теперь window.currentSupabaseUser уже актуален)
            window.dispatchEvent(new CustomEvent('userLoaded', { detail: currentSupabaseUser }));
            
            console.log('[supabase-session] Пользователь загружен:', {
                name: currentSupabaseUser.name,
                role: currentSupabaseUser.role,
                permission_sets: currentSupabaseUser.permission_sets,
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
 * Обновить профиль пользователя (инвалидировать кэш и перезагрузить)
 * @returns {Promise<Object|null>}
 */
export async function refreshUserProfile() {
    const userId = currentSupabaseUser?.id;
    if (!userId) return null;
    
    // Инвалидируем кэш
    const cacheKey = `user_profile_${userId}`;
    cacheService.invalidate(cacheKey, 'all');
    
    // Перезагружаем сессию
    return await checkSupabaseSession(true);
}

/**
 * Выход из Supabase (очищает кэш профиля)
 */
export async function logoutFromSupabase() {
    try {
        // Очищаем кэш пользователя
        if (currentSupabaseUser?.id) {
            const cacheKey = `user_profile_${currentSupabaseUser.id}`;
            cacheService.invalidate(cacheKey, 'all');
        }
        
        await supabase.auth.signOut();
        currentSupabaseUser = null;
        updateGlobalUser();
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