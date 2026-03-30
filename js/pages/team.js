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

function loadDemoData() {
    const saved = localStorage.getItem('team_members');
    if (saved) {
        teamMembers = JSON.parse(saved);
    } else {
        teamMembers = [
            { id: 'admin', name: 'Администратор', email: 'admin@crm.com', role: 'admin', github_username: 'admin', tasks_completed: 45, tasks_active: 3 },
            { id: 'manager1', name: 'Дмитрий Волков', email: 'dmitry@crm.com', role: 'manager', github_username: 'dmitry', tasks_completed: 32, tasks_active: 5 },
            { id: 'agent1', name: 'Анна Петрова', email: 'anna@crm.com', role: 'agent', github_username: 'anna', tasks_completed: 28, tasks_active: 4 },
            { id: 'agent2', name: 'Иван Соколов', email: 'ivan@crm.com', role: 'agent', github_username: 'ivan', tasks_completed: 19, tasks_active: 6 },
            { id: 'agent3', name: 'Елена Смирнова', email: 'elena@crm.com', role: 'agent', github_username: 'elena', tasks_completed: 24, tasks_active: 2 }
        ];
    }
    
    const savedInvites = localStorage.getItem('team_invites');
    if (savedInvites) {
        invites = JSON.parse(savedInvites);
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
    
    // Проверка прав
    const userRole = currentUser?.role?.toLowerCase();
    if (userRole !== 'manager' && userRole !== 'admin') {
        const main = document.querySelector('.main-content');
        if (main) {
            main.innerHTML = `
                <div class="info-panel" style="text-align: center; padding: 60px;">
                    <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <h2>Доступ ограничен</h2>
                    <p>Эта страница доступна только менеджерам и администраторам.</p>
                    <a href="index-supabase.html" class="nav-btn" style="margin-top: 20px; display: inline-block; padding: 10px 20px; background: var(--accent); border-radius: 40px; color: white; text-decoration: none;">Вернуться на главную</a>
                </div>
            `;
        }
        return;
    }
    
    loadDemoData();
    renderTeamStats();
    renderMembersList();
    renderInvitesList();
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[team] Инициализация завершена');
}