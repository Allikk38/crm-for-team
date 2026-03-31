/**
 * Notes Supabase Service
 * CRUD operations for personal notes
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

export async function getNotes() {
  const user = getCurrentSupabaseUser();
  if (!user) throw new Error('User not authenticated');
  
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function createNote(title, content, category = 'work') {
  const user = getCurrentSupabaseUser();
  if (!user) throw new Error('User not authenticated');
  
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title,
      content,
      category,
      user_id: user.id
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateNote(id, updates) {
  const { error } = await supabase
    .from('notes')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

export async function deleteNote(id) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

export async function togglePin(id) {
  const { data } = await supabase
    .from('notes')
    .select('is_pinned')
    .eq('id', id)
    .single();
  
  if (!data) throw new Error('Note not found');
  
  return updateNote(id, { is_pinned: !data.is_pinned });
}

// Realtime subscription helper
export function subscribeToNotes(callback) {
  const user = getCurrentSupabaseUser();
  return supabase
    .channel('notes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
      callback
    )
    .subscribe();
}

