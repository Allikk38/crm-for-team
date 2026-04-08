/**
 * ============================================
 * ФАЙЛ: js/pages/team.js
 * РОЛЬ: Логика страницы управления командой
 * 
 * ОСОБЕННОСТИ:
 *   - Список участников команды (загрузка из Supabase)
 *   - Статистика команды
 *   - Приглашения (создание, отображение)
 *   - Создание новой команды (если пользователь не в компании)
 *   - Интеграция с системой прав
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/team-supabase.js (для createCompany)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла для страницы команды
 *   - 08.04.2026: Замена демо-данных на загрузку из Supabase
 *   - 08.04.2026: Добавлена возможность создания команды
 *   - 08.04.2026: Убрана проверка роли (доступно всем авторизованным)
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

let currentUser = null;
let teamMembers = [];
let invites = [];
let userCompanyId = null;

console.log('[team.js] Модуль загружен');

/**
 * Экранирование HTML для безопасного вывода
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Получить читаемую метку роли
 */
function getRoleLabel(role) {
    const labels = {
        admin: 'Администратор',
        manager: 'Менеджер',
        agent: 'Агент'
    };
    return labels[role] || role;
}

/**
 * Получить CSS-класс для роли
 */
function getRoleClass(role) {
    return `role-${role}`;
}

/**
 * Получить инициалы из имени
 */
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

/**
 * Загрузить данные команды из Supabase
 */
async function loadTeamData() {
    const user = getCurrentSupabaseUser();
    if (!user) return;
    
    // Получаем профиль пользователя с company_id
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
    
    if (profileError) {
        console.error('[team] Ошибка загрузки профиля:', profileError);
        teamMembers = [];
        invites = [];
        userCompanyId = null;
        return;
    }
    
    userCompanyId = profile?.company_id || null;
    
    if (!userCompanyId) {
        // У пользователя нет компании
        teamMembers = [];
        invites = [];
        return;
    }
    
    // Загружаем участников компании
    const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, name, email, role, github_username')
        .eq('company_id', userCompanyId);
    
    if (!membersError && members) {
        teamMembers = members.map(m => ({
            ...m,
            tasks_completed: 0,  // TODO: загружать реальную статистику
            tasks_active: 0       // TODO: загружать реальную статистику
        }));
    } else {
        console.error('[team] Ошибка загрузки участников:', membersError);
        teamMembers = [];
    }
    
    // Загружаем приглашения
    const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('*')
        .eq('company_id', userCompanyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    if (!invitesError && invitesData) {
        invites = invitesData;
    } else {
        console.error('[team] Ошибка загрузки приглашений:', invitesError);
        invites = [];
    }
}

/**
 * Отрисовать состояние "Нет команды" с кнопкой создания
 */
function renderNoCompanyState() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; padding: 40px 20px;">
            <i class="fas fa-users-slash" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
            <h3 style="margin-bottom: 8px;">У вас пока нет команды</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Создайте команду, чтобы приглашать коллег и работать вместе</p>
            <button onclick="window.createTeam()" style="padding: 12px 24px; background: var(--accent); border: none; border-radius: 40px; color: white; font-weight: 600; cursor: pointer; font-size: 1rem;">
                <i class="fas fa-plus" style="margin-right: 8px;"></i> Создать команду
            </button>
        </div>
    `;
    
    // Скрываем секцию приглашений
    const invitesTitle = document.querySelector('.section-title:nth-of-type(2)');
    const invitesContainer = document.getElementById('invitesList')?.parentElement;
    if (invitesTitle) invitesTitle.style.display = 'none';
    if (invitesContainer) invitesContainer.style.display = 'none';
    
    // Скрываем кнопку "Пригласить" в верхнем блоке
    const inviteBtn = document.querySelector('.invite-btn');
    if (inviteBtn) inviteBtn.style.display = 'none';
}

/**
 * Показать секции для компании
 */
function showCompanySections() {
    const invitesTitle = document.querySelector('.section-title:nth-of-type(2)');
    const invitesContainer = document.getElementById('invitesList')?.parentElement;
    if (invitesTitle) invitesTitle.style.display = 'flex';
    if (invitesContainer) invitesContainer.style.display = 'block';
    
    const inviteBtn = document.querySelector('.invite-btn');
    if (inviteBtn) inviteBtn.style.display = 'inline-flex';
}

/**
 * Отрисовать статистику команды
 */
function renderTeamStats() {
    const totalMembers = teamMembers.length;
    const totalTasksCompleted = teamMembers.reduce((sum, m) => sum + (m.tasks_completed || 0), 0);
    const activeModules = 2;
    
    const membersCountEl = document.getElementById('membersCount');
    const activeModulesEl = document.getElementById('activeModulesCount');
    const tasksCompletedEl = document.getElementById('tasksCompleted');
    
    if (membersCountEl) membersCountEl.textContent = totalMembers;
    if (activeModulesEl) activeModulesEl.textContent = activeModules;
    if (tasksCompletedEl) tasksCompletedEl.textContent = totalTasksCompleted;
}

/**
 * Отрисовать список участников
 */
function renderMembersList() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    // Если нет компании - показываем состояние создания
    if (!userCompanyId) {
        renderNoCompanyState();
        return;
    }
    
    // Есть компания - показываем секции
    showCompanySections();
    
    if (teamMembers.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-users"></i>
                <p>Пока нет участников</p>
                <button onclick="window.location.href='invite-supabase.html'" style="margin-top: 12px; padding: 8px 20px; background: var(--accent); border: none; border-radius: 40px; color: white; cursor: pointer;">
                    <i class="fas fa-envelope" style="margin-right: 6px;"></i> Пригласить
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = teamMembers.map(member => `
        <div class="member-card">
            <div class="member-avatar">
                ${getInitials(member.name)}
            </div>
            <div class="member-info">
                <div class="member-name">${escapeHtml(member.name)}</div>
                <div class="member-role">
                    <span class="role-badge ${getRoleClass(member.role)}">${getRoleLabel(member.role)}</span>
                </div>
                <div class="member-stats">
                    <span><i class="fas fa-check-circle"></i> ${member.tasks_completed || 0}</span>
                    <span><i class="fas fa-tasks"></i> ${member.tasks_active || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Отрисовать список приглашений
 */
function renderInvitesList() {
    const container = document.getElementById('invitesList');
    if (!container) return;
    
    if (!userCompanyId) {
        container.innerHTML = '';
        return;
    }
    
    if (invites.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <i class="fas fa-envelope"></i>
                <p>Нет активных приглашений</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = invites.map(invite => `
        <div class="invite-item">
            <div class="invite-email">
                <i class="fas fa-envelope"></i>
                <span>${escapeHtml(invite.invited_email || invite.email || '—')}</span>
            </div>
            <div class="invite-status status-${invite.status}">
                ${invite.status === 'pending' ? '⏳ Ожидает' : '✅ Принято'}
            </div>
        </div>
    `).join('');
}

/**
 * Создать новую команду (глобальная функция для вызова из HTML)
 */
window.createTeam = async function() {
    const user = getCurrentSupabaseUser();
    if (!user) {
        alert('Необходимо авторизоваться');
        return;
    }
    
    const companyName = prompt('Введите название команды:');
    if (!companyName || companyName.trim() === '') return;
    
    try {
        // Динамический импорт функции создания компании
        const { createCompany } = await import('../services/team-supabase.js');
        
        await createCompany(companyName.trim());
        
        // Показываем уведомление об успехе
        alert('✅ Команда успешно создана!');
        
        // Перезагружаем страницу для отображения команды
        location.reload();
    } catch (error) {
        console.error('[team] Ошибка создания команды:', error);
        alert('❌ Ошибка при создании команды: ' + error.message);
    }
};

/**
 * Инициализация страницы команды
 */
export async function initTeamPage() {
    console.log('[team] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    await loadTeamData();
    renderTeamStats();
    renderMembersList();
    renderInvitesList();
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[team] Инициализация завершена, компания:', userCompanyId || 'отсутствует');
}
