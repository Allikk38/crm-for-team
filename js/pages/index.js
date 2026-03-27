/**
 * ============================================
 * ФАЙЛ: js/pages/index.js
 * РОЛЬ: Логика главной страницы (дашборд) с Supabase
 * 
 * ОСОБЕННОСТИ:
 *   - KPI показатели с анимацией
 *   - График динамики задач по дням
 *   - Рейтинг агентов
 *   - Прогресс проекта
 *   - Приветствие пользователя
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из index-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { getTasks } from '../services/tasks-supabase.js';

// Состояние страницы
let tasks = [];
let currentUser = null;

console.log('[index.js] Модуль загружен');

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

function animateValue(element, targetValue, suffix = '') {
    if (!element) return;
    let current = 0;
    const increment = targetValue / 30;
    const interval = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
            element.textContent = targetValue + suffix;
            clearInterval(interval);
        } else {
            element.textContent = Math.floor(current) + suffix;
        }
    }, 20);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadDashboardData() {
    try {
        tasks = await getTasks();
        console.log('[index] Загружено задач:', tasks.length);
        
        // Активные задачи (не завершенные)
        const activeTasks = tasks.filter(t => t.status !== 'completed');
        document.getElementById('tasksCount').textContent = activeTasks.length;
        
        // Завершенные за неделю
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const completedThisWeek = tasks.filter(t => {
            if (t.status !== 'completed') return false;
            if (!t.completed_at) return false;
            return new Date(t.completed_at) > weekAgo;
        }).length;
        document.getElementById('kpiCompletedWeek').textContent = completedThisWeek;
        
        // Просроченные
        const today = new Date().toISOString().split('T')[0];
        const overdueTasks = tasks.filter(t => {
            if (t.status === 'completed') return false;
            if (!t.due_date) return false;
            return t.due_date < today;
        });
        document.getElementById('kpiOverdue').textContent = overdueTasks.length;
        
        // Конверсия
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const conversion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        document.getElementById('kpiConversion').textContent = conversion + '%';
        
        // Прогресс
        document.getElementById('completedTasksLarge').textContent = completedTasks;
        document.getElementById('totalTasksLarge').textContent = totalTasks;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        document.getElementById('progressPercentLarge').textContent = progressPercent + '%';
        const progressFill = document.getElementById('progressFillLarge');
        if (progressFill) progressFill.style.width = progressPercent + '%';
        
        // Недельная динамика
        renderWeeklyChart();
        
        // Объекты (пока заглушка — позже загрузим из БД)
        document.getElementById('complexesCount').textContent = '0';
        
        // Загружаем пользователей для рейтинга
        await loadAgentRanking();
        
        // Приветствие
        if (currentUser) {
            const hour = new Date().getHours();
            let greeting = '';
            if (hour < 12) greeting = 'Доброе утро';
            else if (hour < 18) greeting = 'Добрый день';
            else greeting = 'Добрый вечер';
            document.getElementById('welcomeMessage').innerHTML = greeting + ', ' + escapeHtml(currentUser.name) + '! 👋 Рады видеть вас в CRM.';
        }
        
        console.log('[index] Дашборд загружен');
        
    } catch (error) {
        console.error('[index] Ошибка загрузки данных:', error);
    }
}

function renderWeeklyChart() {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    
    const weeklyData = days.map((_, index) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];
        
        return tasks.filter(t => {
            if (t.status !== 'completed') return false;
            if (!t.completed_at) return false;
            return t.completed_at.split('T')[0] === dateStr;
        }).length;
    });
    
    const maxValue = Math.max(...weeklyData, 1);
    const barsContainer = document.getElementById('weeklyBars');
    
    if (barsContainer) {
        barsContainer.innerHTML = weeklyData.map(value => {
            const height = (value / maxValue) * 80 + 20;
            return `<div class="chart-bar-mini" style="height: ${height}px;" title="${value} задач"></div>`;
        }).join('');
    }
}

async function loadAgentRanking() {
    try {
        // Загружаем всех пользователей с ролью agent
        const { data: agents } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'agent');
        
        if (!agents || agents.length === 0) {
            renderEmptyRanking();
            return;
        }
        
        // Считаем завершенные задачи по каждому агенту
        const ranking = agents.map(agent => {
            const agentTasks = tasks.filter(t => t.assigned_to === agent.github_username);
            const completed = agentTasks.filter(t => t.status === 'completed').length;
            return {
                name: agent.name,
                completed: completed,
                github_username: agent.github_username
            };
        });
        
        ranking.sort((a, b) => b.completed - a.completed);
        const topAgents = ranking.slice(0, 5);
        
        const container = document.getElementById('agentRanking');
        if (!container) return;
        
        if (topAgents.length === 0) {
            renderEmptyRanking();
            return;
        }
        
        let html = '';
        for (let i = 0; i < topAgents.length; i++) {
            const agent = topAgents[i];
            html += `
                <div class="agent-ranking-item">
                    <div class="agent-ranking-name">
                        <div class="agent-ranking-badge">${i + 1}</div>
                        <span>${escapeHtml(agent.name)}</span>
                    </div>
                    <div class="agent-ranking-value">${agent.completed} задач</div>
                </div>
            `;
        }
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[index] Ошибка загрузки рейтинга агентов:', error);
        renderEmptyRanking();
    }
}

function renderEmptyRanking() {
    const container = document.getElementById('agentRanking');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                <i class="fas fa-info-circle"></i> Нет данных
            </div>
        `;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initIndexPage() {
    console.log('[index] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[index] Текущий пользователь:', currentUser?.name);
    
    await loadDashboardData();
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[index] Анимации инициализированы');
    }
    
    console.log('[index] Инициализация завершена');
}