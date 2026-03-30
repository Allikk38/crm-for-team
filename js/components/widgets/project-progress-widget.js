/**
 * ============================================
 * ФАЙЛ: js/components/widgets/project-progress-widget.js
 * РОЛЬ: Виджет прогресса проекта
 * ============================================
 */

import Widget from '../widget.js';
import { getTasks } from '../../services/tasks-supabase.js';

console.log('[project-progress-widget] Загрузка...');

class ProjectProgressWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.data = {
            completed: 0,
            total: 0,
            percent: 0,
            speed: 0
        };
        
        console.log('[project-progress-widget] Создан');
    }
    
    async fetchData() {
        const cached = this.getCachedData();
        if (cached && !this.options.forceRefresh) {
            this.data = cached;
            return cached;
        }
        
        const tasks = await getTasks();
        const completed = tasks.filter(t => t.status === 'completed').length;
        const total = tasks.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const completedThisWeek = tasks.filter(t => {
            if (t.status !== 'completed') return false;
            if (!t.completed_at) return false;
            return new Date(t.completed_at) > weekAgo;
        }).length;
        const speed = Math.round(completedThisWeek / 7);
        
        this.data = { completed, total, percent, speed };
        this.cacheData(this.data, 2 * 60 * 1000);
        
        return this.data;
    }
    
    async render() {
        if (!this.container) return;
        
        await this.fetchData();
        
        this.container.innerHTML = `
            <div style="padding: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 600;">Общий прогресс</span>
                    <span style="font-size: 18px; font-weight: 700; color: var(--accent);">${this.data.percent}%</span>
                </div>
                <div style="height: 8px; background: var(--input-bg); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${this.data.percent}%; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-hover)); transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 12px;">
                    <span><i class="fas fa-check-circle"></i> ${this.data.completed} завершено</span>
                    <span><i class="fas fa-list"></i> ${this.data.total} всего</span>
                </div>
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--card-border); display: flex; justify-content: space-between; font-size: 12px;">
                    <span><i class="fas fa-bolt"></i> Скорость: ${this.data.speed} задач/день</span>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (!window.CRM?.EventBus) return;
        
        this.subscribe('task:created', () => this.refresh());
        this.subscribe('task:updated', () => this.refresh());
        this.subscribe('task:deleted', () => this.refresh());
        
        this.setAutoRefresh(5 * 60 * 1000);
    }
    
    async refresh() {
        this.clearCache();
        await this.render();
    }
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.ProjectProgressWidget = ProjectProgressWidget;
}

export default ProjectProgressWidget;