/**
 * ============================================
 * ФАЙЛ: js/components/widgets/agent-ranking-widget.js
 * РОЛЬ: Виджет рейтинга агентов для дашборда
 * 
 * ОСОБЕННОСТИ:
 *   - Топ-5 агентов по завершенным задачам
 *   - Фильтр по периоду (неделя / месяц / всё время)
 *   - Отображение процента выполнения от всех задач агента
 *   - Иконки мест для топ-3 (🥇🥈🥉)
 *   - Автообновление при изменении задач
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/components/widget.js
 *   - js/services/tasks-supabase.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание виджета
 *   - 09.04.2026: Переход с role на permission_sets
 * ============================================
 */

import Widget from '../widget.js';
import { getTasks } from '../../services/tasks-supabase.js';
import { supabase } from '../../core/supabase.js';
import { canViewTeamKpi, isAdmin } from '../../core/permissions.js';

console.log('[agent-ranking-widget] Загрузка...');

export class AgentRankingWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.settings = {
            limit: options.settings?.limit || 5,
            period: options.settings?.period || 'all',
            refreshInterval: options.settings?.refreshInterval || 300000,
            ...options.settings
        };
        
        this.data = {
            ranking: [],
            period: this.settings.period
        };
        
        this.agents = [];
        this.tasks = [];
        
        console.log('[agent-ranking-widget] Создан');
    }
    
    /**
     * Проверить доступность виджета
     */
    isAvailable() {
        return canViewTeamKpi() || isAdmin();
    }
    
    getPeriodStartDate(period) {
        const now = new Date();
        
        switch (period) {
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                weekAgo.setHours(0, 0, 0, 0);
                return weekAgo.toISOString();
                
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                monthAgo.setHours(0, 0, 0, 0);
                return monthAgo.toISOString();
                
            default:
                return null;
        }
    }
    
    async loadAgents() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, role, github_username, permission_sets');
            
            if (error) {
                console.error('[agent-ranking] Ошибка загрузки агентов:', error);
                return [];
            }
            
            // Фильтруем агентов по permission_sets
            const agents = (data || []).filter(u => 
                u.permission_sets?.includes('AGENT') || u.role === 'agent'
            );
            
            console.log(`[agent-ranking] Загружено агентов: ${agents.length}`);
            return agents;
        } catch (error) {
            console.error('[agent-ranking] Ошибка загрузки агентов:', error);
            return [];
        }
    }
    
    async loadTasksWithFilter() {
        try {
            const allTasks = await getTasks();
            
            const startDate = this.getPeriodStartDate(this.settings.period);
            if (!startDate) {
                return allTasks;
            }
            
            const filteredTasks = allTasks.filter(task => {
                if (task.status !== 'completed') return false;
                if (!task.completed_at) return false;
                return task.completed_at >= startDate;
            });
            
            console.log(`[agent-ranking] Задач за период: ${filteredTasks.length} (всего: ${allTasks.length})`);
            return filteredTasks;
            
        } catch (error) {
            console.error('[agent-ranking] Ошибка загрузки задач:', error);
            return [];
        }
    }
    
    calculateStats(agents, tasks) {
        const tasksByAgent = new Map();
        
        tasks.forEach(task => {
            const assignee = task.assigned_to;
            if (!assignee) return;
            
            if (!tasksByAgent.has(assignee)) {
                tasksByAgent.set(assignee, {
                    completed: 0,
                    total: 0
                });
            }
            
            const stats = tasksByAgent.get(assignee);
            stats.total++;
            if (task.status === 'completed') {
                stats.completed++;
            }
        });
        
        const ranking = agents
            .map(agent => {
                const username = agent.github_username || agent.name;
                const stats = tasksByAgent.get(username) || { completed: 0, total: 0 };
                
                const completed = stats.completed;
                const total = stats.total;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                return {
                    id: agent.id,
                    name: agent.name,
                    username: username,
                    completed: completed,
                    total: total,
                    percent: percent
                };
            })
            .filter(agent => agent.total > 0)
            .sort((a, b) => b.completed - a.completed)
            .slice(0, this.settings.limit);
        
        return ranking;
    }
    
    async fetchData() {
        // Проверяем доступность
        if (!this.isAvailable()) {
            throw new Error('Виджет доступен только менеджерам и администраторам');
        }
        
        const cached = this.getCachedData();
        if (cached && cached.period === this.settings.period && !this.options.forceRefresh) {
            this.data = cached;
            return cached;
        }
        
        try {
            this.agents = await this.loadAgents();
            this.tasks = await this.loadTasksWithFilter();
            
            const ranking = this.calculateStats(this.agents, this.tasks);
            
            this.data = {
                ranking: ranking,
                period: this.settings.period,
                totalAgents: this.agents.length,
                totalCompleted: ranking.reduce((sum, a) => sum + a.completed, 0)
            };
            
            this.cacheData(this.data, 2 * 60 * 1000);
            
        } catch (error) {
            console.error('[agent-ranking-widget] Ошибка:', error);
            throw error;
        }
        
        return this.data;
    }
    
    getRankIcon(index) {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}`;
    }
    
    changePeriod(period) {
        if (period === this.settings.period) return;
        
        this.settings.period = period;
        this.clearCache();
        this.refresh();
    }
    
    renderControls() {
        const periods = [
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
            { value: 'all', label: 'Всё' }
        ];
        
        return `
            <div style="display: flex; gap: 4px; background: var(--hover-bg); padding: 2px; border-radius: 20px;">
                ${periods.map(p => `
                    <button 
                        class="period-btn-${p.value}"
                        data-period="${p.value}"
                        style="
                            padding: 4px 12px;
                            border: none;
                            border-radius: 16px;
                            font-size: 12px;
                            cursor: pointer;
                            background: ${this.settings.period === p.value ? 'var(--accent)' : 'transparent'};
                            color: ${this.settings.period === p.value ? 'white' : 'var(--text-muted)'};
                            transition: all 0.2s;
                        "
                    >
                        ${p.label}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    renderRanking() {
        const { ranking } = this.data;
        
        if (ranking.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); text-align: center; padding: 32px;">
                    <i class="fas fa-chart-line" style="font-size: 32px; opacity: 0.5;"></i>
                    <div>Нет данных за выбранный период</div>
                    <small style="font-size: 11px;">Завершенные задачи появятся здесь</small>
                </div>
            `;
        }
        
        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${ranking.map((agent, index) => `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--hover-bg); border-radius: 12px; transition: all 0.2s;">
                        <div style="width: 32px; text-align: center; font-size: 20px; font-weight: 600;">
                            ${this.getRankIcon(index)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 500; font-size: 14px;">${this.escapeHtml(agent.name)}</div>
                            <div style="display: flex; gap: 16px; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                                <span><i class="fas fa-check-circle"></i> ${agent.completed} завершено</span>
                                <span><i class="fas fa-tasks"></i> ${agent.total} всего</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; font-weight: 700; color: var(--accent);">${agent.percent}%</div>
                            <div style="font-size: 10px; color: var(--text-muted);">выполнено</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        
        this.container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; background: var(--card-bg); border-radius: 16px;">
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-trophy" style="color: var(--accent);"></i>
                        <span style="font-weight: 600;">Рейтинг агентов</span>
                        ${this.data.totalAgents > 0 ? `<span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px;">${this.data.totalCompleted}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${this.renderControls()}
                        <button class="refresh-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Обновить">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
                <div style="flex: 1; padding: 16px; overflow-y: auto;">
                    ${this.renderRanking()}
                </div>
            </div>
        `;
        
        this.attachEvents();
    }
    
    attachEvents() {
        const refreshBtn = this.container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refresh();
        }
        
        const periodBtns = this.container.querySelectorAll('[data-period]');
        periodBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const period = btn.dataset.period;
                this.changePeriod(period);
            };
        });
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

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.AgentRankingWidget = AgentRankingWidget;
}

export default AgentRankingWidget;
