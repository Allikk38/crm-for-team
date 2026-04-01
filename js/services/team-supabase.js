/**
 * ============================================
 * ФАЙЛ: js/services/team-supabase.js
 * РОЛЬ: Сервис для работы с компаниями/командами и приглашениями
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/cache-service.js
 * 
 * ИСТОРИЯ:
 *   - 01.04.2026: Исправлено использование companies вместо teams
 *   - 02.04.2026: ДОБАВЛЕНО КЭШИРОВАНИЕ для getUserCompany и getCompanyMembers
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import cacheService from './cache-service.js';

/**
 * Создать новую компанию (для пользователя без команды)
 */
export async function createCompany(name, slug = null) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const companySlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Создаем компанию
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
            name,
            slug: companySlug,
            owner_id: user.id
        })
        .select()
        .single();
    
    if (companyError) throw companyError;
    
    // Добавляем пользователя в компанию
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: company.id })
        .eq('id', user.id);
    
    if (profileError) throw profileError;
    
    // Инвалидируем кэш после создания компании
    cacheService.invalidate('user_company', 'all');
    cacheService.invalidate(`company_members_${company.id}`, 'all');
    
    return company;
}

/**
 * Получить компанию пользователя (с кэшированием)
 * @param {boolean} forceRefresh - принудительно обновить кэш
 */
export async function getUserCompany(forceRefresh = false) {
    const user = getCurrentSupabaseUser();
    if (!user) return null;
    
    // Пытаемся получить из кэша
    if (!forceRefresh) {
        const cached = cacheService.get('user_company', 'session');
        if (cached) return cached;
    }
    
    // Получаем профиль с company_id
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
    
    if (profileError || !profile?.company_id) return null;
    
    // Получаем данные компании
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
    
    if (companyError) throw companyError;
    
    // Сохраняем в кэш (TTL 30 минут = 1800 секунд)
    cacheService.set('user_company', company, { ttl: 1800, storage: 'session' });
    
    return company;
}

/**
 * Получить участников компании (с кэшированием)
 * @param {number|string} companyId - ID компании
 * @param {boolean} forceRefresh - принудительно обновить кэш
 */
export async function getCompanyMembers(companyId, forceRefresh = false) {
    if (!companyId) return [];
    
    const cacheKey = `company_members_${companyId}`;
    
    // Пытаемся получить из кэша
    if (!forceRefresh) {
        const cached = cacheService.get(cacheKey, 'session');
        if (cached) return cached;
    }
    
    const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, email, github_username')
        .eq('company_id', companyId);
    
    if (error) throw error;
    
    const members = data || [];
    
    // Сохраняем в кэш (TTL 5 минут = 300 секунд, участники могут меняться чаще)
    cacheService.set(cacheKey, members, { ttl: 300, storage: 'session' });
    
    return members;
}

/**
 * Создать приглашение в компанию
 */
export async function createCompanyInvite(email, companyId = null, expiresInDays = 7) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    let targetCompanyId = companyId;
    if (!targetCompanyId) {
        const company = await getUserCompany();
        targetCompanyId = company?.id;
    }
    
    if (!targetCompanyId) throw new Error('У пользователя нет компании');
    
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const { data, error } = await supabase
        .from('invites')
        .insert({
            token,
            type: 'team',
            company_id: targetCompanyId,
            invited_by: user.id,
            invited_email: email,
            expires_at: expiresAt.toISOString(),
            status: 'pending'
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Создать реферальную ссылку с бонусом
 */
export async function createReferralInvite(bonusWidgetId = null) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const { data, error } = await supabase
        .from('invites')
        .insert({
            token,
            type: 'referral',
            invited_by: user.id,
            bonus_widget_id: bonusWidgetId,
            expires_at: expiresAt.toISOString(),
            status: 'pending'
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Проверить и активировать приглашение
 */
export async function acceptInvite(token) {
    // Находим приглашение
    const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();
    
    if (inviteError || !invite) {
        throw new Error('Приглашение не найдено или истекло');
    }
    
    // Проверяем срок действия
    if (new Date(invite.expires_at) < new Date()) {
        await supabase
            .from('invites')
            .update({ status: 'expired' })
            .eq('id', invite.id);
        throw new Error('Срок действия приглашения истек');
    }
    
    const user = getCurrentSupabaseUser();
    if (!user) {
        // Возвращаем токен для регистрации
        return { redirect: '/auth-supabase.html?invite=' + token };
    }
    
    // Если приглашение в команду
    if (invite.type === 'team') {
        // Добавляем пользователя в компанию
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                company_id: invite.company_id,
                invited_by: invite.invited_by
            })
            .eq('id', user.id);
        
        if (updateError) throw updateError;
        
        // Отмечаем приглашение как принятое
        await supabase
            .from('invites')
            .update({ 
                status: 'accepted',
                accepted_by: user.id,
                accepted_at: new Date().toISOString()
            })
            .eq('id', invite.id);
        
        // Инвалидируем кэш компании и участников
        cacheService.invalidate('user_company', 'all');
        cacheService.invalidate(`company_members_${invite.company_id}`, 'all');
        
        return { success: true, companyId: invite.company_id };
    }
    
    // Если реферальное приглашение
    if (invite.type === 'referral') {
        // Отмечаем приглашение как принятое
        await supabase
            .from('invites')
            .update({ 
                status: 'accepted',
                accepted_by: user.id,
                accepted_at: new Date().toISOString()
            })
            .eq('id', invite.id);
        
        return { success: true, bonus: invite.bonus_widget_id };
    }
    
    return { success: true };
}

/**
 * Генерация уникального токена
 */
function generateInviteToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36);
}

/**
 * Получить все приглашения пользователя
 */
export async function getUserInvites() {
    const user = getCurrentSupabaseUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('invited_by', user.id)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
}

/**
 * Отменить приглашение
 */
export async function cancelInvite(inviteId) {
    const { error } = await supabase
        .from('invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);
    
    if (error) throw error;
    return true;
}