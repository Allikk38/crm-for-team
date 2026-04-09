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
 *   - js/services/team-supabase.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание файла для страницы команды
 *   - 08.04.2026: Замена демо-данных на загрузку из Supabase
 *   - 09.04.2026: Переход с role на permission_sets для отображения
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { isAdmin, canManageTeam, getUserPermissions } from '../core/permissions.js';

let currentUser = null;
let teamMembers = [];
let invites = [];
let userCompanyId = null;

console.log('[team.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRoleLabel(user) {
    // Определяем по permission_sets
    const permissionSets = user.permission_sets || [];
    
    if (permissionSets.includes('ADMIN') || user.role === 'admin') {
        return 'Администратор';
    }
    if (permissionSets.includes('MANAGER') || user.role === 'manager') {
        return 'Менеджер';
    }
    if (permissionSets.includes('AGENT') || user.role === 'agent') {
        return 'Агент';
    }
    return 'Сотрудник';
}

function getRoleClass(user) {
    const permissionSets = user.permission_sets || [];
    
    if (permissionSets.includes('ADMIN') || user.role === 'admin') return 'role-admin';
    if (permissionSets.includes('MANAGER') || user.role === 'manager') return 'role-manager';
    if (permissionSets.includes('AGENT') || user.role === 'agent') return 'role-agent';
    return 'role-viewer';
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadTeamData() {
    const user = getCurrentSupabaseUser();
    if (!user) return;
    
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
        teamMembers = [];
        invites = [];
        return;
    }
    
    // Загружаем участников компании
    const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, name, email, role, github_username, permission_sets')
        .eq('company_id', userCompanyId);
    
    if (!membersError && members) {
        teamMembers = members.map(m => ({
            ...m,
            tasks_completed: 0,
            tasks_active: 0
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

// ========== РЕНДЕРИНГ ==========

function renderNoCompanyState() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; padding: 40px 20px;">
            <i class="fas fa-users-slash" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
            <h3 style="margin-bottom: 8px;">У вас пока нет команды</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Создайте команду, чтобы приглашать коллег и работать вместе</p>
            <button id="createTeamBtn" style="padding: 12px 24px; background: var(--accent); border: none; border-radius: 40px; color: white; font-weight: 600; cursor: pointer; font-size: 1rem;">
                <i class="fas fa-plus" style="margin-right: 8px;"></i> Создать команду
            </button>
        </div>
    `;
    
    document.getElementById('createTeamBtn')?.addEventListener('click', createTeam);
    
    const invitesTitle = document.querySelector('.section-title:nth-of-type(2)');
    const invitesContainer = document.getElementById('invitesList')?.parentElement;
    if (invitesTitle) invitesTitle.style.display = 'none';
    if (invitesContainer) invitesContainer.style.display = 'none';
    
    const inviteBtn = document.querySelector('.invite-btn');
    if (inviteBtn) inviteBtn.style.display = 'none';
}

function showCompanySections() {
    const invitesTitle = document.querySelector('.section-title:nth-of-type(2)');
    const invitesContainer = document.getElementById('invitesList')?.parentElement;
    if (invitesTitle) invitesTitle.style.display = 'flex';
    if (invitesContainer) invitesContainer.style.display = 'block';
    
    const inviteBtn = document.querySelector('.invite-btn');
    if (inviteBtn) inviteBtn.style.display = 'inline-flex';
}

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

function renderMembersList() {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    if (!userCompanyId) {
        renderNoCompanyState();
        return;
    }
    
    showCompanySections();
    
    if (teamMembers.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-users"></i>
                <p>Пока нет участников</p>
                <button id="inviteEmptyBtn" style="margin-top: 12px; padding: 8px 20px; background: var(--accent); border: none; border-radius: 40px; color: white; cursor: pointer;">
                    <i class="fas fa-envelope" style="margin-right: 6px;"></i> Пригласить
                </button>
            </div>
        `;
        document.getElementById('inviteEmptyBtn')?.addEventListener('click', () => {
            window.location.href = 'invite.html';
        });
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
                    <span class="role-badge ${getRoleClass(member)}">${getRoleLabel(member)}</span>
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

// ========== СОЗДАНИЕ КОМАНДЫ ==========

async function createTeam() {
    const user = getCurrentSupabaseUser();
    if (!user) {
        alert('Необходимо авторизоваться');
        return;
    }
    
    const companyName = prompt('Введите название команды:');
    if (!companyName || companyName.trim() === '') return;
    
    try {
        const { createCompany } = await import('../services/team-supabase.js');
        await createCompany(companyName.trim());
        alert('✅ Команда успешно создана!');
        location.reload();
    } catch (error) {
        console.error('[team] Ошибка создания команды:', error);
        alert('❌ Ошибка при создании команды: ' + error.message);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initTeamPage() {
    console.log('[team] Инициализация страницы...');
    
    try {
        const isAuth = await requireSupabaseAuth('auth-supabase.html');
        if (!isAuth) return;
        
        currentUser = getCurrentSupabaseUser();
        updateSupabaseUserInterface();
        
        await loadTeamData();
        
        renderTeamStats();
        renderMembersList();
        renderInvitesList();
        
        // Навешиваем обработчик на кнопку приглашения
        document.querySelector('.invite-btn')?.addEventListener('click', () => {
            window.location.href = 'invite.html';
        });
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
        
        console.log('[team] Инициализация завершена');
    } catch (error) {
        console.error('[team] КРИТИЧЕСКАЯ ОШИБКА:', error);
    }
}
