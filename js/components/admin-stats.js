/**
 * ============================================
 * ФАЙЛ: js/components/admin-stats.js
 * РОЛЬ: Компонент статистики в админ-панели
 * 
 * ФУНКЦИОНАЛ:
 *   - Общая статистика системы
 *   - Количество пользователей, модулей, лицензий
 *   - График активности
 *   - Топ пользователей по активности
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/marketplace-service.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из admin.html в отдельный компонент
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import * as marketplace from '../services/marketplace-service.js';

console.log('[admin-stats] Компонент загружен');

export class AdminStats {
    constructor(container) {
        this.container = container;
        this.stats = {
            users: 0,
            companies: 0,
            licenses: 0,
            modules: 0,
            activeModules: 0,
            revenue: 0
        };
        this.recentActivity = [];
        this.topUsers = [];
        this.isLoading = false;
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========

    async loadStats() {
        // Пользователи
        const { count: usersCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        this.stats.users = usersCount || 0;

        // Компании
        const { count: companiesCount } = await supabase
            .from('companies')
            .select('*', { count: 'exact', head: true });
        this.stats.companies = companiesCount || 0;

        // Лицензии
        const { count: licensesCount } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');
        this.stats.licenses = licensesCount || 0;

        // Модули в каталоге
        const catalog = await marketplace.getCatalog();
        this.stats.modules = catalog.length;
        this.stats.activeModules = catalog.filter(m => m.is_active).length;

        // Суммарная выручка (из цен купленных лицензий)
        await this.loadRevenue();

        // Последняя активность
        await this.loadRecentActivity();

        // Топ пользователей
        await this.loadTopUsers();
    }

    async loadRevenue() {
        const { data: licenses } = await supabase
            .from('licenses')
            .select(`
                license_type,
                item:item_id(price_personal, price_team_3, price_team_10, price_team_unlimited)
            `)
            .eq('status', 'active');

        if (!licenses) return;

        this.stats.revenue = licenses.reduce((sum, license) => {
            const item = license.item || {};
            const priceField = `price_${license.license_type}`;
            const price = item[priceField] || 0;
            return sum + price;
        }, 0);
    }

    async loadRecentActivity() {
        // Последние созданные пользователи
        const { data: recentUsers } = await supabase
            .from('profiles')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        // Последние купленные лицензии
        const { data: recentLicenses } = await supabase
            .from('licenses')
            .select(`
                id,
                purchased_at,
                buyer:buyer_user_id(name),
                item:item_id(name)
            `)
            .order('purchased_at', { ascending: false })
            .limit(5);

        this.recentActivity = [
            ...(recentUsers || []).map(u => ({
                type: 'user',
                icon: 'fa-user-plus',
                text: `Зарегистрировался ${this.escapeHtml(u.name)}`,
                time: u.created_at
            })),
            ...(recentLicenses || []).map(l => ({
                type: 'license',
                icon: 'fa-key',
                text: `${this.escapeHtml(l.buyer?.name || 'Пользователь')} купил ${this.escapeHtml(l.item?.name || 'модуль')}`,
                time: l.purchased_at
            }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
    }

    async loadTopUsers() {
        // Пользователи с наибольшим количеством лицензий
        const { data: userLicenses } = await supabase
            .from('licenses')
            .select('buyer_user_id, buyer:buyer_user_id(name)')
            .eq('status', 'active');

        if (!userLicenses) return;

        const counts = {};
        userLicenses.forEach(l => {
            const userId = l.buyer_user_id;
            if (!counts[userId]) {
                counts[userId] = {
                    name: l.buyer?.name || 'Пользователь',
                    count: 0
                };
            }
            counts[userId].count++;
        });

        this.topUsers = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    // ========== РЕНДЕРИНГ ==========

    async render() {
        this.isLoading = true;
        this.renderLoading();

        await this.loadStats();
        this.isLoading = false;

        this.container.innerHTML = `
            <div class="stats-dashboard">
                ${this.renderKpiCards()}
                ${this.renderCharts()}
                ${this.renderActivityAndTop()}
            </div>
        `;

        this.attachEvents();
        this.addStyles();
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-spinner fa-pulse fa-2x" style="color: var(--text-muted);"></i>
                <p>Загрузка статистики...</p>
            </div>
        `;
    }

    renderKpiCards() {
        const formatRevenue = (this.stats.revenue / 100).toLocaleString();

        return `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon users">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="kpi-content">
                        <div class="kpi-value">${this.stats.users}</div>
                        <div class="kpi-label">Пользователей</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon companies">
                        <i class="fas fa-building"></i>
                    </div>
                    <div class="kpi-content">
                        <div class="kpi-value">${this.stats.companies}</div>
                        <div class="kpi-label">Компаний</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon licenses">
                        <i class="fas fa-key"></i>
                    </div>
                    <div class="kpi-content">
                        <div class="kpi-value">${this.stats.licenses}</div>
                        <div class="kpi-label">Активных лицензий</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon modules">
                        <i class="fas fa-puzzle-piece"></i>
                    </div>
                    <div class="kpi-content">
                        <div class="kpi-value">${this.stats.activeModules}/${this.stats.modules}</div>
                        <div class="kpi-label">Модулей активно</div>
                    </div>
                </div>

                <div class="kpi-card highlight">
                    <div class="kpi-icon revenue">
                        <i class="fas fa-ruble-sign"></i>
                    </div>
                    <div class="kpi-content">
                        <div class="kpi-value">${formatRevenue} ₽</div>
                        <div class="kpi-label">Общая выручка</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCharts() {
        return `
            <div class="charts-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <h3><i class="fas fa-chart-line"></i> Рост пользователей</h3>
                        <select id="periodSelect" class="period-select">
                            <option value="7">7 дней</option>
                            <option value="30" selected>30 дней</option>
                            <option value="90">90 дней</option>
                        </select>
                    </div>
                    <div class="chart-container" id="userGrowthChart">
                        <div class="chart-placeholder">
                            <i class="fas fa-chart-bar"></i>
                            <p>Выберите период для отображения</p>
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <div class="chart-header">
                        <h3><i class="fas fa-chart-pie"></i> Распределение ролей</h3>
                    </div>
                    <div class="chart-container" id="rolesChart">
                        ${this.renderRolesDistribution()}
                    </div>
                </div>
            </div>
        `;
    }

    renderRolesDistribution() {
        // Статичные данные для демо
        const roles = [
            { name: 'Администраторы', count: 1, color: '#6c6cff' },
            { name: 'Менеджеры', count: 2, color: '#4caf50' },
            { name: 'Агенты', count: 5, color: '#ffc107' },
            { name: 'Наблюдатели', count: 1, color: '#9e9e9e' }
        ];

        const total = roles.reduce((sum, r) => sum + r.count, 0);

        return `
            <div class="roles-distribution">
                ${roles.map(r => {
                    const percent = (r.count / total) * 100;
                    return `
                        <div class="role-bar-item">
                            <div class="role-info">
                                <span class="role-color" style="background: ${r.color};"></span>
                                <span class="role-name">${r.name}</span>
                                <span class="role-count">${r.count}</span>
                            </div>
                            <div class="role-bar">
                                <div class="role-bar-fill" style="width: ${percent}%; background: ${r.color};"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderActivityAndTop() {
        return `
            <div class="bottom-section">
                <div class="activity-card">
                    <div class="card-header">
                        <h3><i class="fas fa-history"></i> Последняя активность</h3>
                    </div>
                    <div class="activity-list">
                        ${this.recentActivity.length === 0 ? `
                            <div class="empty-activity">
                                <i class="fas fa-inbox"></i>
                                <p>Нет данных</p>
                            </div>
                        ` : this.recentActivity.map(activity => `
                            <div class="activity-item">
                                <div class="activity-icon">
                                    <i class="fas ${activity.icon}"></i>
                                </div>
                                <div class="activity-content">
                                    <div class="activity-text">${activity.text}</div>
                                    <div class="activity-time">${this.formatTimeAgo(activity.time)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="top-card">
                    <div class="card-header">
                        <h3><i class="fas fa-trophy"></i> Топ пользователей</h3>
                        <span class="card-subtitle">По количеству лицензий</span>
                    </div>
                    <div class="top-list">
                        ${this.topUsers.length === 0 ? `
                            <div class="empty-activity">
                                <i class="fas fa-users"></i>
                                <p>Нет данных</p>
                            </div>
                        ` : this.topUsers.map((user, index) => `
                            <div class="top-item">
                                <div class="top-rank ${index < 3 ? `rank-${index + 1}` : ''}">${index + 1}</div>
                                <div class="top-info">
                                    <div class="top-name">${this.escapeHtml(user.name)}</div>
                                </div>
                                <div class="top-value">${user.count} лиц.</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

    attachEvents() {
        this.container.querySelector('#periodSelect')?.addEventListener('change', async (e) => {
            const days = parseInt(e.target.value);
            await this.loadUserGrowthChart(days);
        });
    }

    async loadUserGrowthChart(days) {
        const container = this.container.querySelector('#userGrowthChart');
        if (!container) return;

        container.innerHTML = `
            <div class="loading-small">
                <i class="fas fa-spinner fa-pulse"></i>
            </div>
        `;

        // Загружаем данные
        const { data: users } = await supabase
            .from('profiles')
            .select('created_at')
            .order('created_at', { ascending: true });

        if (!users) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <i class="fas fa-chart-bar"></i>
                    <p>Нет данных</p>
                </div>
            `;
            return;
        }

        // Группируем по дням
        const dailyCounts = {};
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyCounts[dateStr] = 0;
        }

        users.forEach(u => {
            const dateStr = u.created_at.split('T')[0];
            if (dailyCounts[dateStr] !== undefined) {
                dailyCounts[dateStr]++;
            }
        });

        const values = Object.values(dailyCounts);
        const maxValue = Math.max(...values, 1);

        container.innerHTML = `
            <div class="bar-chart">
                ${Object.entries(dailyCounts).map(([date, count]) => {
                    const height = (count / maxValue) * 150;
                    const day = date.slice(5);
                    return `
                        <div class="bar-item">
                            <div class="bar" style="height: ${Math.max(4, height)}px;" title="${count} пользователей"></div>
                            <div class="bar-value">${count}</div>
                            <div class="bar-label">${day}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    formatTimeAgo(dateStr) {
        if (!dateStr) return '—';
        
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин. назад`;
        if (hours < 24) return `${hours} ч. назад`;
        if (days < 7) return `${days} дн. назад`;
        
        return date.toLocaleDateString('ru-RU');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addStyles() {
        if (document.querySelector('#admin-stats-styles')) return;

        const style = document.createElement('style');
        style.id = 'admin-stats-styles';
        style.textContent = `
            .stats-dashboard {
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            .kpi-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 20px;
            }

            .kpi-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 20px;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                transition: all 0.3s;
            }

            .kpi-card:hover {
                transform: translateY(-4px);
                border-color: var(--accent);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
            }

            .kpi-card.highlight {
                background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                border-color: transparent;
            }

            .kpi-card.highlight .kpi-value,
            .kpi-card.highlight .kpi-label {
                color: white;
            }

            .kpi-icon {
                width: 56px;
                height: 56px;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }

            .kpi-icon.users { background: rgba(108, 108, 255, 0.15); color: #6c6cff; }
            .kpi-icon.companies { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
            .kpi-icon.licenses { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
            .kpi-icon.modules { background: rgba(33, 150, 243, 0.15); color: #2196f3; }
            .kpi-icon.revenue { background: rgba(255, 255, 255, 0.2); color: white; }

            .kpi-card.highlight .kpi-icon {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }

            .kpi-content {
                flex: 1;
            }

            .kpi-value {
                font-size: 2rem;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1.2;
            }

            .kpi-label {
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            .charts-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }

            .chart-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 20px;
                padding: 20px;
            }

            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .chart-header h3 {
                font-size: 1rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .period-select {
                padding: 6px 12px;
                background: var(--input-bg);
                border: 1px solid var(--card-border);
                border-radius: 8px;
                color: var(--text-primary);
                font-size: 0.8rem;
            }

            .chart-container {
                min-height: 200px;
            }

            .chart-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: var(--text-muted);
            }

            .chart-placeholder i {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .bar-chart {
                display: flex;
                align-items: flex-end;
                justify-content: space-around;
                height: 200px;
                gap: 8px;
            }

            .bar-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .bar {
                width: 100%;
                max-width: 30px;
                background: linear-gradient(180deg, var(--accent), var(--accent-hover));
                border-radius: 6px 6px 0 0;
                transition: height 0.5s ease;
                min-height: 4px;
            }

            .bar-value {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--accent);
            }

            .bar-label {
                font-size: 0.65rem;
                color: var(--text-muted);
            }

            .roles-distribution {
                padding: 10px 0;
            }

            .role-bar-item {
                margin-bottom: 20px;
            }

            .role-info {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .role-color {
                width: 12px;
                height: 12px;
                border-radius: 4px;
            }

            .role-name {
                flex: 1;
                font-size: 0.85rem;
            }

            .role-count {
                font-weight: 600;
                color: var(--accent);
            }

            .role-bar {
                height: 6px;
                background: var(--input-bg);
                border-radius: 3px;
                overflow: hidden;
            }

            .role-bar-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.5s ease;
            }

            .bottom-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }

            .activity-card, .top-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 20px;
                padding: 20px;
            }

            .card-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 20px;
            }

            .card-header h3 {
                font-size: 1rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .card-subtitle {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-left: auto;
            }

            .activity-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 300px;
                overflow-y: auto;
            }

            .activity-item {
                display: flex;
                gap: 12px;
            }

            .activity-icon {
                width: 32px;
                height: 32px;
                background: rgba(108, 108, 255, 0.1);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--accent);
                font-size: 14px;
            }

            .activity-content {
                flex: 1;
            }

            .activity-text {
                font-size: 0.85rem;
                margin-bottom: 4px;
            }

            .activity-time {
                font-size: 0.7rem;
                color: var(--text-muted);
            }

            .empty-activity {
                text-align: center;
                padding: 40px;
                color: var(--text-muted);
            }

            .empty-activity i {
                font-size: 32px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .top-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .top-item {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .top-rank {
                width: 28px;
                height: 28px;
                background: var(--hover-bg);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 0.8rem;
            }

            .top-rank.rank-1 { background: #ffd700; color: #000; }
            .top-rank.rank-2 { background: #c0c0c0; color: #000; }
            .top-rank.rank-3 { background: #cd7f32; color: #fff; }

            .top-info {
                flex: 1;
            }

            .top-name {
                font-weight: 500;
                font-size: 0.9rem;
            }

            .top-value {
                font-weight: 700;
                color: var(--accent);
            }

            .loading-small {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: var(--text-muted);
            }

            @media (max-width: 1200px) {
                .kpi-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (max-width: 900px) {
                .charts-section,
                .bottom-section {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 600px) {
                .kpi-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ========== ОБНОВЛЕНИЕ ==========

    async refresh() {
        await this.render();
    }

    destroy() {
        console.log('[admin-stats] Компонент уничтожен');
        this.container.innerHTML = '';
    }
}

export default AdminStats;
