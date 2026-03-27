/**
 * ============================================
 * ФАЙЛ: js/pages/manager.js
 * РОЛЬ: Логика страницы панели менеджера (Supabase версия)
 * 
 * ОСОБЕННОСТИ:
 *   - KPI показатели с анимацией
 *   - Нагрузка по агентам с прогресс-барами
 *   - Список просроченных задач
 *   - График активности по дням
 *   - Фильтрация по пользователю
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из manager-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

// Состояние страницы
let allTasks = [];
let allUsers = [];
let currentUser = null;
let selectedUser = 'all';

console.log('[manager.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadTasks() {
    // Для админа и менеджера - все задачи (без фильтра по user_id)
    const { data, error } = await supabase
        .from('tasks')
        .select('*');
    
    if (!error && data) {
        allTasks = data;
        console.log(`[manager] Загружено ${allTasks.length} задач (все)`);
    } else {
        console.error('[manager] Ошибка загрузки задач:', error);
        allTasks = [];
    }
}

async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
        allUsers = data.filter(u => u.role === 'agent');
        console.log(`[manager] Загружено ${allUsers.length} агентов`);
        updateUserSelect();
    }
}

function updateUserSelect() {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = '<option value="all">Все агенты</option>';
    for (const user of allUsers) {
        select.innerHTML += `<option value="${user.github_username}">${escapeHtml(user.name)}</option>`;
    }
}

// ========== РАСЧЁТ KPI ==========

function calculateKPI() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    let tasks = allTasks;
    if (selectedUser !== 'all') {
        tasks = allTasks.filter(t => t.assigned_to === selectedUser);
    }
    
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today);
    const closedThisWeek = tasks.filter(t => t.status === 'completed' && t.completed_at && t.completed_at >= weekAgoStr).length;
    
    return { total, overdue: overdue.length, closedWeek: closedThisWeek, inProgress, overdueList: overdue };
}

// ========== РАСЧЁТ НАГРУЗКИ АГЕНТОВ ==========

function calculateAgentLoad() {
    const today = new Date().toISOString().split('T')[0];
    const result = [];
    
    for (const agent of allUsers) {
        const agentTasks = allTasks.filter(t => t.assigned_to === agent.github_username);
        const activeTasks = agentTasks.filter(t => t.status !== 'completed').length;
        const overdueTasks = agentTasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today).length;
        const completedTasks = agentTasks.filter(t => t.status === 'completed').length;
        
        const maxLoad = 10;
        const loadPercent = Math.min(100, (activeTasks / maxLoad) * 100);
        
        result.push({
            id: agent.id,
            name: agent.name,
            github_username: agent.github_username,
            activeTasks,
            overdueTasks,
            completedTasks,
            loadPercent
        });
    }
    
    result.sort((a, b) => b.activeTasks - a.activeTasks);
    return result;
}

// ========== РЕНДЕРИНГ ==========

function renderKPI(kpi) {
    document.getElementById('totalTasks').textContent = kpi.total;
    document.getElementById('overdueTasks').textContent = kpi.overdue;
    document.getElementById('closedWeek').textContent = kpi.closedWeek;
    document.getElementById('inProgress').textContent = kpi.inProgress;
}

function renderAgentLoad(agentLoad) {
    const container = document.getElementById('agentList');
    if (!container) return;
    
    if (agentLoad.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет агентов в системе</p></div>';
        return;
    }
    
    let html = '';
    for (const agent of agentLoad) {
        const loadColor = agent.loadPercent > 80 ? '#ff6b6b' : (agent.loadPercent > 50 ? '#ffc107' : '#4caf50');
        
        html += `
            <div class="agent-item">
                <div class="agent-header">
                    <div class="agent-name">
                        <i class="fas fa-user-circle"></i>
                        <span>${escapeHtml(agent.name)}</span>
                    </div>
                    <div class="agent-stats">
                        <span><i class="fas fa-tasks"></i> ${agent.activeTasks} активных</span>
                        ${agent.overdueTasks > 0 ? `<span class="overdue-badge"><i class="fas fa-exclamation-triangle"></i> ${agent.overdueTasks} просрочено</span>` : ''}
                        <span><i class="fas fa-check-circle"></i> ${agent.completedTasks} завершено</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="progress-bar-container" style="flex: 1;">
                        <div class="progress-bar" style="width: ${agent.loadPercent}%; background: ${loadColor};"></div>
                    </div>
                    <span style="font-size: 0.7rem;">${Math.round(agent.loadPercent)}%</span>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderOverdueTasks(overdueList) {
    const container = document.getElementById('overdueTasksList');
    if (!container) return;
    
    if (overdueList.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>Нет просроченных задач</p></div>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    let html = '';
    for (const task of overdueList) {
        const assignee = allUsers.find(u => u.github_username === task.assigned_to);
        const assigneeName = assignee ? assignee.name : 'Не назначен';
        const daysOverdue = Math.floor((new Date(today) - new Date(task.due_date)) / (1000 * 60 * 60 * 24));
        
        html += `
            <div class="overdue-task">
                <div>
                    <div class="overdue-title">${escapeHtml(task.title)}</div>
                    <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 4px;">
                        <i class="fas fa-user"></i> ${escapeHtml(assigneeName)} | 
                        <i class="fas fa-calendar"></i> просрочено на ${daysOverdue} дн.
                    </div>
                </div>
                <button class="action-btn" onclick="window.goToTask('${task.id}')">Перейти →</button>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }
    
    let tasks = allTasks;
    if (selectedUser !== 'all') {
        tasks = allTasks.filter(t => t.assigned_to === selectedUser);
    }
    
    const closedByDay = days.map(day => 
        tasks.filter(t => t.status === 'completed' && t.completed_at && t.completed_at.split('T')[0] === day).length
    );
    
    const maxCount = Math.max(...closedByDay, 1);
    
    let html = '<div class="chart-bars">';
    for (let i = 0; i < days.length; i++) {
        const height = (closedByDay[i] / maxCount) * 120;
        const dayLabel = days[i].slice(5);
        html += `
            <div class="chart-bar">
                <div class="bar" style="height: ${Math.max(4, height)}px;"></div>
                <div class="bar-label">${dayLabel}</div>
                <div style="font-size: 0.65rem; color: var(--accent);">${closedByDay[i]}</div>
            </div>
        `;
    }
    html += '</div>';
    
    container.innerHTML = html;
}

// ========== ОБНОВЛЕНИЕ ВСЕХ ДАННЫХ ==========

async function refreshAll() {
    await loadTasks();
    const kpi = calculateKPI();
    renderKPI(kpi);
    renderAgentLoad(calculateAgentLoad());
    renderOverdueTasks(kpi.overdueList);
    renderActivityChart();
}

// ========== ПЕРЕХОД К ЗАДАЧЕ ==========

window.goToTask = function(taskId) {
    window.location.href = `tasks-supabase.html?task=${taskId}`;
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initManagerPage() {
    console.log('[manager] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    console.log('[manager] Пользователь:', currentUser?.name, 'роль:', currentUser?.role);
    
    // Проверка прав доступа (только менеджер или админ)
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
    
    await loadUsers();
    await refreshAll();
    
    document.getElementById('userSelect').addEventListener('change', (e) => {
        selectedUser = e.target.value;
        refreshAll();
    });
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[manager] Анимации инициализированы');
    }
    
    console.log('[manager] Инициализация завершена');
}