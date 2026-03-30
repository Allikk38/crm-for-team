/**
 * ============================================
 * ФАЙЛ: js/components/widgets/welcome-widget.js
 * РОЛЬ: Виджет приветствия и советов
 * ============================================
 */

import Widget from '../widget.js';
import { getCurrentSupabaseUser } from '../../core/supabase-session.js';

console.log('[welcome-widget] Загрузка...');

class WelcomeWidget extends Widget {
    constructor(container, options = {}) {
        super(container, options);
        this.user = null;
        console.log('[welcome-widget] Создан');
    }
    
    async fetchData() {
        this.user = getCurrentSupabaseUser();
        return this.user;
    }
    
    async render() {
        if (!this.container) return;
        
        await this.fetchData();
        
        const hour = new Date().getHours();
        let greeting = '';
        if (hour < 12) greeting = 'Доброе утро';
        else if (hour < 18) greeting = 'Добрый день';
        else greeting = 'Добрый вечер';
        
        const userName = this.user?.name || 'Пользователь';
        
        const tips = [
            { icon: 'fa-search', text: 'Используйте Ctrl+K для быстрого поиска' },
            { icon: 'fa-tasks', text: 'Завершайте задачи, чтобы повысить KPI' },
            { icon: 'fa-chart-line', text: 'Следите за прогрессом в реальном времени' },
            { icon: 'fa-calendar', text: 'Планируйте задачи в календаре' }
        ];
        
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        this.container.innerHTML = `
            <div style="padding: 8px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <i class="fas fa-rocket" style="font-size: 32px; color: var(--accent);"></i>
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">${greeting}, ${userName}!</h3>
                        <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-muted);">Рады видеть вас в CRM</p>
                    </div>
                </div>
                <div style="background: var(--hover-bg); border-radius: 12px; padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <i class="fas fa-lightbulb" style="color: var(--accent);"></i>
                        <span style="font-weight: 600; font-size: 12px;">Совет дня</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${randomTip.icon}" style="color: var(--accent); font-size: 14px;"></i>
                        <span style="font-size: 13px;">${randomTip.text}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widgets = window.CRM.Widgets || {};
    window.CRM.Widgets.WelcomeWidget = WelcomeWidget;
}

export default WelcomeWidget;