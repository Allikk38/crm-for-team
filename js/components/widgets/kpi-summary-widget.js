/**
 * ============================================
 * ФАЙЛ: js/components/widgets/kpi-summary-widget.js
 * РОЛЬ: Виджет KPI показателей для дашборда
 * ============================================
 */

import Widget from '../widget.js';
import { getTasks } from '../../services/tasks-supabase.js';

console.log('[kpi-summary-widget] Загрузка...');

class KpiSummaryWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        
        this.settings = {
            refreshInterval: options.settings?.refreshInterval || 300000,
            ...options.settings
        };
        
        this.data = {
            activeTasks: 0,
            complexesCount: 0,
            usersCount: 0
        };
        
        console.log('[kpi-summary-widget] Создан');
    }
    
    async fetchData() {
        const cached = this.getCachedData();
        if (cached && !this.options.forceRefresh) {
            this.data = cached;
            return cached;
        }
        
        try {
            // Загружаем задачи
            const tasks = await getTasks();
            const activeTasks = tasks.filter(t => t.status !== 'completed').length;
            
            // Загружаем объекты
            let complexesCount = 0;
            try {
                const { count, error } = await window.supabase
                    .from('complexes')
                    .select('*', { count: 'exact', head: true });
                if (!error) complexesCount = count || 0;
            } catch (e) {
                console.warn('[kpi-summary] Ошибка загрузки объектов:', e);
            }
            
            // Загружаем пользователей
            let usersCount = 1;
            try {
                const { count, error } = await window.supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });
                if (!error) usersCount = count || 1;
            } catch (e) {
                console.warn('[kpi-summary] Ошибка загрузки пользователей:', e);
            }
            
            this.data = {
                activeTasks: activeTasks,
                complexesCount: complexesCount,
                usersCount: usersCount
            };
            
            this.cacheData(this.data, 2 * 60 * 1000);
            
        } catch (error) {
            console.error('[kpi-summary-widget] Ошибка:', error);
            throw error;
        }
        
        return this.data;
    }
    
    async render() {
        if (!this.container) return;
        
        await this.fetchData();
        
        this.container.innerHTML = `
            <div style="height: 100%;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; height: 100%;">
                    <div onclick="window.location.href='tasks-supabase.html'" style="cursor: pointer; text-align: center; padding: 16px; background: var(--hover-bg); border-radius: 16px; transition: all 0.2s;">
                        <i class="fas fa-play-circle" style="font-size: 24px; color: var(--accent); margin-bottom: 8px; display: inline-block;"></i>
                        <div style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, var(--text-primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                            ${this.data.activeTasks}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Активные задачи</div>
                    </div>
                    <div onclick="window.location.href='complexes-supabase.html'" style="cursor: pointer; text-align: center; padding: 16px; background: var(--hover-bg); border-radius: 16px; transition: all 0.2s;">
                        <i class="fas fa-building" style="font-size: 24px; color: var(--accent); margin-bottom: 8px; display: inline-block;"></i>
                        <div style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, var(--text-primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                            ${this.data.complexesCount}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Объекты</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--hover-bg); border-radius: 16px; transition: all 0.2s;">
                        <i class="fas fa-users" style="font-size: 24px; color: var(--accent); margin-bottom: 8px; display: inline-block;"></i>
                        <div style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, var(--text-primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                            ${this.data.usersCount}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Пользователи</div>
                    </div>
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
    window.CRM.Widgets.KpiSummaryWidget = KpiSummaryWidget;
}

export default KpiSummaryWidget;