/**
 * ============================================
 * ФАЙЛ: js/services/notes-supabase.js
 * РОЛЬ: Сервис для работы с заметками через Supabase
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Исправлена Realtime подписка
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

/**
 * Получить все заметки текущего пользователя
 */
export async function getNotes() {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
    
    if (error) {
        console.error('[notes-service] Ошибка загрузки:', error);
        throw error;
    }
    
    return data || [];
}

/**
 * Получить заметку по ID
 */
export async function getNoteById(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Создать новую заметку
 */
export async function createNote(title, content = '', category = 'work') {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
        .from('notes')
        .insert({
            title: title.trim(),
            content: content || '',
            category,
            user_id: user.id,
            is_pinned: false,
            created_at: now,
            updated_at: now
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Обновить заметку
 */
export async function updateNote(id, updates) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const { error } = await supabase
        .from('notes')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) throw error;
    return true;
}

/**
 * Удалить заметку
 */
export async function deleteNote(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) throw error;
    return true;
}

/**
 * Переключить закрепление заметки
 */
export async function togglePin(id) {
    const user = getCurrentSupabaseUser();
    if (!user) throw new Error('Пользователь не авторизован');
    
    const { data, error: fetchError } = await supabase
        .from('notes')
        .select('is_pinned')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    
    if (fetchError) throw fetchError;
    
    const { error } = await supabase
        .from('notes')
        .update({ 
            is_pinned: !data.is_pinned,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) throw error;
    return true;
}

/**
 * Подписка на изменения заметок в реальном времени
 */
export function subscribeToNotes(callback) {
    const user = getCurrentSupabaseUser();
    if (!user) {
        console.warn('[notes-service] Нет пользователя для Realtime');
        return null;
    }
    
    const channel = supabase.channel(`notes-${user.id}`);
    
    channel
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'notes', 
                filter: `user_id=eq.${user.id}` 
            },
            (payload) => {
                console.log('[notes-service] Realtime event:', payload.eventType);
                callback(payload);
            }
        )
        .subscribe((status) => {
            console.log('[notes-service] Realtime status:', status);
        });
    
    return channel;
}