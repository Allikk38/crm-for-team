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
 * ============================================
 */

import { supabase } from '../core/supabase.js';

/**
 * Проверяет, существует ли email в таблице profiles
 * ВНИМАНИЕ: Эта проверка не гарантирует 100% результат, так как:
 * 1. Пользователь мог зарегистрироваться, но профиль не создан
 * 2. Проверка через profiles - это дополнительная защита, не заменяющая обработку ошибок Supabase
 * 
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
            // При ошибке запроса не блокируем регистрацию, полагаемся на валидацию Supabase
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
 * Полная проверка email перед регистрацией
 * @param {string} email - email для проверки
 * @returns {Promise<{valid: boolean, message: string|null}>}
 */
export async function validateEmailForRegistration(email) {
    // 1. Проверка формата
    const { isValidEmail } = await import('../utils/helpers.js');
    
    if (!isValidEmail(email)) {
        return {
            valid: false,
            message: 'Введите корректный email (например, name@domain.com)'
        };
    }
    
    // 2. Проверка существования в profiles
    const { exists, error } = await checkEmailExistsInProfiles(email);
    
    if (exists) {
        return {
            valid: false,
            message: 'Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.'
        };
    }
    
    return {
        valid: true,
        message: null
    };
}