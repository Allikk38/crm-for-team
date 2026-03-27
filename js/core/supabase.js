import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ttiyhypvanhrccgzjgcx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CEtOVzMJivoO5BWFNBuTWA_4gDQKpj3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function checkConnection() {
    try {
        const { error } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('Ошибка:', error.message);
            return false;
        }
        
        console.log('✅ Supabase подключен');
        return true;
    } catch (error) {
        console.error('Ошибка подключения:', error);
        return false;
    }
}
