/**
 * ============================================
 * ФАЙЛ: js/pages/team.js
 * РОЛЬ: Логика страницы управления командой
 * 
 * ОСОБЕННОСТИ:
 *   - Список участников команды
 *   - Статистика команды
 *   - Приглашения
 *   - Интеграция с маркетплейсом
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла для страницы команды
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
let tasks = [];

console.log('[team.js] Модуль загружен');

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRoleLabel(role) {
    const labels = {
        admin: 'Администратор',
        manager: 'Менеджер',
        agent: 'Агент'
    };
    return labels[role] || role;
}

function getRoleClass(role) {
    return `role-${role}`;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

async function loadTeamData() {
    const user = getCurrentSupabaseUser();
    if (!user) return;
    
    // Получаем профиль пользователя с company_id
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
    
    if (profileError || !profile?.company_id) {
        // У пользователя нет компании
        teamMembers = [];
        invites = [];
        return;
    }
    
    // Загружаем участников компании
    const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, name, email, role, github_username')
        .eq('company_id', profile.company_id);
    
    if (!membersError && members) {
        teamMembers = members.map(m => ({
            ...m,
            tasks_completed: 0,
            tasks_active: 0
        }));
    } else {
        teamMembers = [];
    }
    
    // Загружаем приглашения
    const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending');
    
    if (!invitesError && invitesData) {
        invites = invitesData;
    } else {
        invites = [];
    }
}

function renderTeamStats() {
    const totalMembers = teamMembers.length;
    const totalTasksCompleted = teamMembers.reduce((sum, m) => sum + (m.tasks_completed || 0), 0);
    const activeModules = 2;
    
    document.getElementById('membersCount').textContent = totalMembers;
    document.getElementById('activeModulesCount').textContent = activeModules;
    document.getElementById('tasksCompleted').textContent = totalTasksCompleted;
}

function renderMembersList() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    if (teamMembers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Пока нет участников</p>
                <button onclick="window.location.href='invite-supabase.html'" style="margin-top: 12px; padding: 8px 20px; background: var(--accent); border: none; border-radius: 40px; color: white; cursor: pointer;">
                    Пригласить
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

function renderInvitesList() {
    const container = document.getElementById('invitesList');
    if (!container) return;
    
    if (invites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
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
                <span>${escapeHtml(invite.email)}</span>
            </div>
            <div class="invite-status status-${invite.status}">
                ${invite.status === 'pending' ? '⏳ Ожидает' : '✅ Принято'}
            </div>
        </div>
    `).join('');
}

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
    
    console.log('[team] Инициализация завершена');
}
