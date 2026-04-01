/**
 * ============================================
 * ФАЙЛ: js/services/email-check.js
 * РОЛЬ: Сервис для проверки email перед регистрацией
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 * 
 * ИСТОРИЯ:
 *   - 01.04.2026: Создание сервиса
 *   - 02.04.2026: ДОБАВЛЕНО КЭШИРОВАНИЕ результатов проверки email
 * ============================================
 */

import { supabase } from '../core/supabase.js';

// Кэш в памяти (быстрый доступ)
const memoryCache = new Map();

/**
 * Получить результат проверки из кэша
 * @param {string} email 
 * @returns {Object|null}
 */
function getFromCache(email) {
    // Проверяем memory cache
    if (memoryCache.has(email)) {
        const cached = memoryCache.get(email);
        if (Date.now() - cached.timestamp < 600000) { // 10 минут
            return cached.result;
        }
        memoryCache.delete(email);
    }
    
    // Проверяем sessionStorage
    const cachedKey = `email_check_${email}`;
    const sessionData = sessionStorage.getItem(cachedKey);
    if (sessionData) {
        try {
            const cached = JSON.parse(sessionData);
            if (Date.now() - cached.timestamp < 600000) { // 10 минут
                return cached.result;
            }
            sessionStorage.removeItem(cachedKey);
        } catch (e) {
            sessionStorage.removeItem(cachedKey);
        }
    }
    
    return null;
}

/**
 * Сохранить результат проверки в кэш
 * @param {string} email 
 * @param {Object} result 
 */
function saveToCache(email, result) {
    const cacheData = {
        result,
        timestamp: Date.now()
    };
    
    // Сохраняем в memory cache
    memoryCache.set(email, cacheData);
    
    // Сохраняем в sessionStorage
    const cachedKey = `email_check_${email}`;
    sessionStorage.setItem(cachedKey, JSON.stringify(cacheData));
}

/**
 * Проверяет, существует ли email в таблице profiles
 * @param {string} email - email для проверки
 * @returns {Promise<{exists: boolean, error: string|null}>}
 */
export async function checkEmailExistsInProfiles(email) {
    if (!email) {
        return { exists: false, error: 'Email не указан' };
    }
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('email')
            .eq('email', email)
            .maybeSingle();
        
        if (error) {
            console.warn('[email-check] Ошибка проверки email:', error);
            return { exists: false, error: null };
        }
        
        return { 
            exists: !!data, 
            error: null 
        };
    } catch (err) {
        console.error('[email-check] Исключение при проверке:', err);
        return { exists: false, error: null };
    }
}

/**
 * Полная проверка email перед регистрацией (с кэшированием)
 * @param {string} email - email для проверки
 * @param {boolean} forceRefresh - принудительно обновить кэш
 * @returns {Promise<{valid: boolean, message: string|null}>}
 */
export async function validateEmailForRegistration(email, forceRefresh = false) {
    // Проверяем кэш, если не требуется принудительное обновление
    if (!forceRefresh) {
        const cached = getFromCache(email);
        if (cached) {
            return cached;
        }
    }
    
    // 1. Проверка формата
    const { isValidEmail } = await import('../utils/helpers.js');
    
    if (!isValidEmail(email)) {
        const result = {
            valid: false,
            message: 'Введите корректный email (например, name@domain.com)'
        };
        saveToCache(email, result);
        return result;
    }
    
    // 2. Проверка существования в profiles
    const { exists, error } = await checkEmailExistsInProfiles(email);
    
    let result;
    if (exists) {
        result = {
            valid: false,
            message: 'Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.'
        };
    } else {
        result = {
            valid: true,
            message: null
        };
    }
    
    // Сохраняем в кэш
    saveToCache(email, result);
    
    return result;
}

/**
 * Очистить кэш проверки для конкретного email
 * @param {string} email 
 */
export function clearEmailCache(email) {
    if (memoryCache.has(email)) {
        memoryCache.delete(email);
    }
    sessionStorage.removeItem(`email_check_${email}`);
}

/**
 * Очистить весь кэш проверки email
 */
export function clearAllEmailCache() {
    memoryCache.clear();
    
    // Очищаем sessionStorage от ключей email_check_
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('email_check_')) {
            sessionStorage.removeItem(key);
        }
    }
}