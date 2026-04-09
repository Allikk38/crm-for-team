/**
 * ============================================
 * ФАЙЛ: js/components/widgets/team-analytics-widget.js
 * РОЛЬ: Виджет аналитики команды для дашборда
 * 
 * ОСОБЕННОСТИ:
 *   - KPI команды (всего задач, просрочено, выполнено)
 *   - Нагрузка по агентам (топ-3)
 *   - График активности за неделю
 *   - Доступен только для менеджеров и админов (по правам)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/tasks-supabase.js
 *   - js/components/widget.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание виджета
 *   - 09.04.2026: Переход с role на permission_sets
 * ============================================
 */

import Widget from '../widget.js';
import { supabase } from '../../core/supabase.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';
import { canViewTeamKpi, isAdmin } from '../../core/permissions.js';

console.log('[team-analytics-widget] Загрузка...');

class TeamAnalyticsWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.settings = {
            refreshInterval: options.settings?.refreshInterval || 300000,
            ...options.settings
        };
        
        this.data = {
            totalTasks: 0,
            completedTasks: 0,
            overdueTasks: 0,
            activeUsers: 0,
            topAgents: [],
            weeklyActivity: []
        };
        
        console.log('[team-analytics-widget] Создан');
    }
    
    /**
     * Проверить доступность виджета
     */
    isAvailable() {
        return canViewTeamKpi() || isAdmin();
    }
    
    async fetchData() {
        // Проверяем доступность
        if (!this.isAvailable()) {
            throw new Error('Виджет доступен только менеджерам и администраторам');
        }
        
        const cached = this.getCachedData();
        if (cached && !this.options.forceRefresh) {
            this.data = cached;
            return cached;
        }
        
        try {
            // Загружаем всех пользователей
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                .select('*');
            
            if (usersError) throw usersError;
            
            // Загружаем все задачи
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*');
            
            if (tasksError) throw tasksError;
            
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];
            
            // Статистика
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'completed').length;
            const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today).length;
            
            // Активные пользователи (кто имеет задачи)
            const usersWithTasks = new Set(tasks.map(t => t.assigned_to).filter(Boolean));
            const activeUsers = usersWithTasks.size;
            
            // Топ агентов по выполненным задачам
            // Фильтруем агентов по permission_sets, а не по role
            const agentStats = users
                .filter(u => u.permission_sets?.includes('AGENT') || u.role === 'agent')
                .map(agent => {
                    const agentTasks = tasks.filter(t => t.assigned_to === agent.github_username);
                    const completed = agentTasks.filter(t => t.status === 'completed').length;
                    const active = agentTasks.filter(t => t.status !== 'completed').length;
                    return {
                        name: agent.name,
                        github_username: agent.github_username,
                        completed,
                        active,
                        total: agentTasks.length
                    };
                })
                .filter(a => a.total > 0)
                .sort((a, b) => b.completed - a.completed)
                .slice(0, 3);
            
            // Активность за неделю
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                days.push(date.toISOString().split('T')[0]);
            }
            
            const weeklyActivity = days.map(day => {
                const count = tasks.filter(t => 
                    t.status === 'completed' && 
                    t.completed_at && 
                    t.completed_at.split('T')[0] === day
                ).length;
                return { day: day.slice(5), count };
            });
            
            this.data = {
                totalTasks,
                completedTasks,
                overdueTasks,
                activeUsers,
                topAgents: agentStats,
                weeklyActivity
            };
            
            this.cacheData(this.data, 2 * 60 * 1000);
            
        } catch (error) {
            console.error('[team-analytics-widget] Ошибка:', error);
            throw error;
        }
        
        return this.data;
    }
    
    async render() {
        if (!this.container) return;
        
        // Проверяем доступность
        if (!this.isAvailable()) {
            this.container.innerHTML = `
                <div class="widget-locked" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-muted);">
                    <i class="fas fa-lock" style="font-size: 32px; margin-bottom: 12px;"></i>
                    <div>Виджет доступен только менеджерам</div>
                    <small style="font-size: 11px; margin-top: 8px;">Требуется право view_team_kpi</small>
                </div>
            `;
            return;
        }
        
        await this.fetchData();
        
        const completionRate = this.data.totalTasks > 0 
            ? Math.round((this.data.completedTasks / this.data.totalTasks) * 100) 
            : 0;
        
        this.container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column;">
                <!-- KPI ряд -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 12px; background: var(--hover-bg); border-radius: 16px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent);">${this.data.totalTasks}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Всего задач</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: var(--hover-bg); border-radius: 16px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #4caf50;">${this.data.completedTasks}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Выполнено</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: var(--hover-bg); border-radius: 16px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #ff6b6b;">${this.data.overdueTasks}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Просрочено</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: var(--hover-bg); border-radius: 16px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent);">${completionRate}%</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Выполнение</div>
                    </div>
                </div>
                
                <!-- Топ агентов -->
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <i class="fas fa-trophy" style="color: var(--accent); font-size: 0.9rem;"></i>
                        <span style="font-weight: 600; font-size: 0.85rem;">Лучшие агенты</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${this.renderTopAgents()}
                    </div>
                </div>
                
                <!-- График активности -->
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <i class="fas fa-chart-line" style="color: var(--accent); font-size: 0.9rem;"></i>
                        <span style="font-weight: 600; font-size: 0.85rem;">Активность за неделю</span>
                    </div>
                    <div style="display: flex; align-items: flex-end; gap: 8px; height: 80px;">
                        ${this.renderWeeklyChart()}
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    renderTopAgents() {
        if (this.data.topAgents.length === 0) {
            return '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.8rem;">Нет данных</div>';
        }
        
        return this.data.topAgents.map((agent, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--hover-bg); border-radius: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1rem;">${medal}</span>
                        <span style="font-weight: 500; font-size: 0.85rem;">${this.escapeHtml(agent.name)}</span>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <span style="font-size: 0.7rem; color: #4caf50;"><i class="fas fa-check-circle"></i> ${agent.completed}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted);"><i class="fas fa-tasks"></i> ${agent.active}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderWeeklyChart() {
        if (this.data.weeklyActivity.length === 0) {
            return '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Нет данных</div>';
        }
        
        const maxCount = Math.max(...this.data.weeklyActivity.map(d => d.count), 1);
        
        return this.data.weeklyActivity.map(day => {
            const height = (day.count / maxCount) * 60;
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div style="width: 100%; height: 60px; display: flex; flex-direction: column-reverse;">
                        <div style="height: ${Math.max(4, height)}px; background: linear-gradient(180deg, var(--accent), var(--accent-hover)); border-radius: 4px 4px 0 0; transition: height 0.3s;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: var(--text-muted);">${day.day}</div>
                    <div style="font-size: 0.65rem; color: var(--accent); font-weight: 500;">${day.count}</div>
                </div>
            `;
        }).join('');
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupEventListeners() {
        if (!window.CRM?.EventBus) return;
        
        this.subscribe('task:created', () => this.refresh());
        this.subscribe('task:updated', () => this.refresh());
        this.subscribe('task:deleted', () => this.refresh());
        
        this.setAutoRefresh(this.settings.refreshInterval);
    }
    
    async refresh() {
        this.clearCache();
        await this.render();
    }
}

// Регистрируем виджет
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.TeamAnalyticsWidget = TeamAnalyticsWidget;
    console.log('[team-analytics-widget] ✅ Зарегистрирован');
}

export default TeamAnalyticsWidget;
