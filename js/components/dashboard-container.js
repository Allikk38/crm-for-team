/**
 * ============================================
 * ФАЙЛ: js/components/dashboard-container.js
 * РОЛЬ: Контейнер для управления виджетами на дашборде
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание контейнера
 *   - 30.03.2026: Исправлено дублирование виджетов
 *   - 30.03.2026: Добавлены новые виджеты (KPI, прогресс, приветствие)
 * ============================================
 */

import { getActiveDashboard, saveDashboardLayout } from '../services/dashboards-supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[dashboard-container] Загрузка...');

class DashboardContainer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.dashboard = null;
        this.widgets = new Map(); // widgetId -> widgetInstance
        this.editMode = false;
        this.initialized = false;
        this.renderInProgress = false;
        
        console.log('[dashboard-container] Создан');
    }
    
    async init() {
        console.log('[dashboard-container] Инициализация...');
        
        await this.waitForUser(5000);
        
        try {
            this.dashboard = await getActiveDashboard();
            if (!this.dashboard || !this.dashboard.layout) {
                console.error('[dashboard-container] Дашборд не найден');
                this.showEmptyState();
                return;
            }
            
            await this.render();
            this.subscribeEvents();
            this.initialized = true;
            console.log('[dashboard-container] Инициализирован');
        } catch (error) {
            console.error('[dashboard-container] Ошибка инициализации:', error);
            this.showErrorState(error.message);
        }
    }
    
    waitForUser(maxWaitMs = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkUser = () => {
                const user = getCurrentSupabaseUser();
                if (user) {
                    console.log('[dashboard-container] Пользователь загружен:', user.name);
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= maxWaitMs) {
                    console.warn('[dashboard-container] Таймаут ожидания пользователя');
                    resolve(false);
                    return;
                }
                
                setTimeout(checkUser, 100);
            };
            
            checkUser();
        });
    }
    
    showEmptyState() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="dashboard-empty" style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-puzzle-piece" style="font-size: 64px; opacity: 0.5; margin-bottom: 20px; display: block;"></i>
                <h3>Нет виджетов</h3>
                <p>Нажмите "Настроить", чтобы добавить виджеты</p>
                <button class="dashboard-btn primary" id="initAddWidgetBtn" style="padding: 10px 24px; background: var(--accent); color: white; border: none; border-radius: 12px; cursor: pointer;">
                    <i class="fas fa-plus"></i> Добавить виджет
                </button>
            </div>
        `;
        
        const addBtn = this.container.querySelector('#initAddWidgetBtn');
        if (addBtn) {
            addBtn.onclick = () => this.showWidgetPalette();
        }
    }
    
    showErrorState(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="dashboard-empty" style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #ff6b6b; margin-bottom: 20px; display: block;"></i>
                <h3>Ошибка загрузки</h3>
                <p>${message || 'Не удалось загрузить дашборд'}</p>
                <button class="dashboard-btn" id="retryInitBtn" style="padding: 10px 24px; background: var(--hover-bg); border: none; border-radius: 12px; cursor: pointer;">
                    <i class="fas fa-sync-alt"></i> Повторить
                </button>
            </div>
        `;
        
        const retryBtn = this.container.querySelector('#retryInitBtn');
        if (retryBtn) {
            retryBtn.onclick = () => this.init();
        }
    }
    
    async render() {
        if (!this.container || this.renderInProgress) return;
        
        this.renderInProgress = true;
        
        try {
            if (!this.dashboard || !this.dashboard.layout) {
                this.showEmptyState();
                return;
            }
            
            // Удаляем существующие виджеты
            this.widgets.forEach((widget, id) => {
                if (widget && widget.destroy) {
                    widget.destroy();
                }
            });
            this.widgets.clear();
            
            const widgets = this.dashboard.layout.widgets || [];
            
            if (widgets.length === 0) {
                this.showEmptyState();
                return;
            }
            
            // Удаляем дубликаты по id
            const uniqueWidgets = [];
            const seenIds = new Set();
            for (const widget of widgets) {
                if (!seenIds.has(widget.id)) {
                    seenIds.add(widget.id);
                    uniqueWidgets.push(widget);
                } else {
                    console.warn(`[dashboard-container] Дубликат виджета ${widget.id} удален`);
                }
            }
            
            // Если были дубликаты, обновляем дашборд
            if (uniqueWidgets.length !== widgets.length) {
                this.dashboard.layout.widgets = uniqueWidgets;
                await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
            }
            
            const gridHtml = `
                <div class="dashboard-toolbar" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--card-bg); border-bottom: 1px solid var(--card-border); flex-wrap: wrap; gap: 12px;">
                    <div class="dashboard-title" style="font-size: 18px; font-weight: 600;">
                        <i class="fas fa-chart-line" style="color: var(--accent);"></i> 
                        ${this.dashboard.name || 'Мой дашборд'}
                    </div>
                    <div class="dashboard-controls" style="display: flex; gap: 12px;">
                        <button class="dashboard-btn" id="refreshDashboard" style="padding: 8px 16px; border-radius: 10px; background: var(--hover-bg); border: none; cursor: pointer;">
                            <i class="fas fa-sync-alt"></i> Обновить
                        </button>
                        <button class="dashboard-btn" id="editDashboard" style="padding: 8px 16px; border-radius: 10px; background: var(--hover-bg); border: none; cursor: pointer;">
                            <i class="fas fa-edit"></i> 
                            ${this.editMode ? 'Сохранить' : 'Настроить'}
                        </button>
                        <button class="dashboard-btn primary" id="addWidgetBtn" style="padding: 8px 16px; border-radius: 10px; background: var(--accent); color: white; border: none; cursor: pointer;">
                            <i class="fas fa-plus"></i> Добавить
                        </button>
                    </div>
                </div>
                <div class="dashboard-grid" id="dashboardGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; padding: 20px;">
                    ${uniqueWidgets.map((widget, index) => this.renderWidgetPlaceholder(widget, index)).join('')}
                </div>
            `;
            
            this.container.innerHTML = gridHtml;
            
            // Загружаем виджеты
            for (const widgetConfig of uniqueWidgets) {
                await this.loadWidget(widgetConfig);
            }
            
            this.bindEvents();
            
        } finally {
            this.renderInProgress = false;
        }
    }
    
    renderWidgetPlaceholder(widgetConfig, index) {
        const widgetTitle = this.getWidgetTitle(widgetConfig.id);
        const widgetIcon = this.getWidgetIcon(widgetConfig.id);
        
        return `
            <div class="widget-card" data-widget-id="${widgetConfig.id}" data-widget-index="${index}" style="background: var(--card-bg); border-radius: 16px; border: 1px solid var(--card-border); overflow: hidden;">
                <div class="widget-header" style="padding: 12px 16px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                    <div class="widget-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                        <i class="fas ${widgetIcon}" style="color: var(--accent);"></i>
                        <span>${widgetConfig.title || widgetTitle}</span>
                    </div>
                    <div class="widget-actions" style="display: flex; gap: 8px;">
                        ${this.editMode ? `
                            <button class="widget-action-btn remove-widget" data-widget-id="${widgetConfig.id}" title="Удалить" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        <button class="widget-action-btn refresh-widget" data-widget-id="${widgetConfig.id}" title="Обновить" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-content" data-widget-content="${widgetConfig.id}" style="padding: 16px; min-height: 200px;">
                    <div class="widget-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px;">
                        <div class="widget-spinner" style="width: 32px; height: 32px; border: 3px solid var(--card-border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                        <span>Загрузка ${widgetTitle}...</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    getWidgetTitle(widgetId) {
        const titles = {
            'my-tasks': 'Мои задачи',
            'kpi-summary': 'Ключевые показатели',
            'project-progress': 'Прогресс проекта',
            'welcome': 'Приветствие'
        };
        return titles[widgetId] || widgetId;
    }
    
    getWidgetIcon(widgetId) {
        const icons = {
            'my-tasks': 'fa-tasks',
            'kpi-summary': 'fa-chart-line',
            'project-progress': 'fa-chart-simple',
            'welcome': 'fa-rocket'
        };
        return icons[widgetId] || 'fa-puzzle-piece';
    }
    
    async loadWidget(widgetConfig) {
        const contentContainer = this.container.querySelector(`[data-widget-content="${widgetConfig.id}"]`);
        if (!contentContainer) return;
        
        // Проверяем, не загружен ли уже этот виджет
        if (this.widgets.has(widgetConfig.id)) {
            console.log(`[dashboard-container] Виджет ${widgetConfig.id} уже загружен`);
            return;
        }
        
        try {
            const WidgetClass = this.getWidgetClass(widgetConfig.id);
            if (!WidgetClass) {
                contentContainer.innerHTML = `
                    <div class="widget-empty" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fas fa-puzzle-piece" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                        <div>Виджет "${widgetConfig.id}" в разработке</div>
                        <small>Скоро появится</small>
                    </div>
                `;
                return;
            }
            
            const widget = new WidgetClass(contentContainer, {
                widgetId: widgetConfig.id,
                moduleId: widgetConfig.module,
                settings: widgetConfig.settings || {},
                dashboardId: this.dashboard?.id
            });
            
            this.widgets.set(widgetConfig.id, widget);
            await widget.render();
            console.log(`[dashboard-container] Виджет ${widgetConfig.id} загружен`);
            
        } catch (error) {
            console.error(`[dashboard-container] Ошибка загрузки виджета ${widgetConfig.id}:`, error);
            contentContainer.innerHTML = `
                <div class="widget-error" style="text-align: center; padding: 40px; color: #ff6b6b;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                    <div>Ошибка загрузки</div>
                    <button onclick="location.reload()" style="margin-top: 12px; padding: 6px 12px; border-radius: 8px; background: var(--accent); color: white; border: none; cursor: pointer;">Повторить</button>
                </div>
            `;
        }
    }
    
    getWidgetClass(widgetId) {
        const widgetsMap = {
            'my-tasks': window.CRM?.Widgets?.MyTasksWidget,
            'kpi-summary': window.CRM?.Widgets?.KpiSummaryWidget,
            'project-progress': window.CRM?.Widgets?.ProjectProgressWidget,
            'welcome': window.CRM?.Widgets?.WelcomeWidget
        };
        return widgetsMap[widgetId];
    }
    
    bindEvents() {
        const refreshBtn = this.container.querySelector('#refreshDashboard');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshAllWidgets();
        }
        
        const editBtn = this.container.querySelector('#editDashboard');
        if (editBtn) {
            editBtn.onclick = () => this.toggleEditMode();
        }
        
        const addBtn = this.container.querySelector('#addWidgetBtn');
        if (addBtn) {
            addBtn.onclick = () => this.showWidgetPalette();
        }
        
        const refreshWidgetBtns = this.container.querySelectorAll('.refresh-widget');
        refreshWidgetBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const widgetId = btn.dataset.widgetId;
                this.refreshWidget(widgetId);
            };
        });
        
        if (this.editMode) {
            const removeBtns = this.container.querySelectorAll('.remove-widget');
            removeBtns.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const widgetId = btn.dataset.widgetId;
                    this.removeWidget(widgetId);
                };
            });
        }
    }
    
    async toggleEditMode() {
        this.editMode = !this.editMode;
        await this.render();
    }
    
    async removeWidget(widgetId) {
        if (!this.dashboard || !this.dashboard.layout) return;
        
        const index = this.dashboard.layout.widgets.findIndex(w => w.id === widgetId);
        if (index !== -1) {
            this.dashboard.layout.widgets.splice(index, 1);
            
            const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
            if (success) {
                const widget = this.widgets.get(widgetId);
                if (widget && widget.destroy) {
                    widget.destroy();
                }
                this.widgets.delete(widgetId);
                await this.render();
            }
        }
    }
    
    async showWidgetPalette() {
        const availableWidgets = [
            {
                id: 'my-tasks',
                moduleId: 'tasks',
                title: 'Мои задачи',
                description: 'Показывает ваши текущие задачи',
                settings: { limit: 10 }
            },
            {
                id: 'kpi-summary',
                moduleId: 'index',
                title: 'Ключевые показатели',
                description: 'Активные задачи, объекты, пользователи',
                settings: { refreshInterval: 300000 }
            },
            {
                id: 'project-progress',
                moduleId: 'index',
                title: 'Прогресс проекта',
                description: 'Общий прогресс выполнения задач',
                settings: {}
            },
            {
                id: 'welcome',
                moduleId: 'index',
                title: 'Приветствие',
                description: 'Персональное приветствие и советы',
                settings: {}
            }
        ];
        
        const palette = document.createElement('div');
        palette.className = 'widget-palette';
        palette.style.cssText = `
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: 320px;
            background: var(--card-bg);
            border-left: 1px solid var(--card-border);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
        `;
        
        palette.innerHTML = `
            <div class="widget-palette-header" style="padding: 20px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                <div class="widget-palette-title" style="font-size: 18px; font-weight: 600;">
                    <i class="fas fa-plus"></i> Добавить виджет
                </div>
                <button class="widget-palette-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
            </div>
            <div class="widget-palette-list" style="flex: 1; overflow-y: auto; padding: 16px;">
                ${availableWidgets.map(widget => `
                    <div class="widget-palette-item" data-widget-id="${widget.id}" data-module-id="${widget.moduleId}" style="padding: 12px; background: var(--hover-bg); border-radius: 12px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px;">
                        <i class="fas ${this.getWidgetIcon(widget.id)}" style="font-size: 20px; color: var(--accent);"></i>
                        <div class="widget-palette-info" style="flex: 1;">
                            <div class="widget-palette-name" style="font-weight: 600; margin-bottom: 4px;">${widget.title}</div>
                            <div class="widget-palette-desc" style="font-size: 12px; opacity: 0.7;">${widget.description}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(palette);
        setTimeout(() => palette.style.transform = 'translateX(0)', 10);
        
        const closeBtn = palette.querySelector('.widget-palette-close');
        closeBtn.onclick = () => {
            palette.style.transform = 'translateX(100%)';
            setTimeout(() => palette.remove(), 300);
        };
        
        const items = palette.querySelectorAll('.widget-palette-item');
        items.forEach(item => {
            item.onclick = async () => {
                const widgetId = item.dataset.widgetId;
                const moduleId = item.dataset.moduleId;
                const widgetDef = availableWidgets.find(w => w.id === widgetId);
                
                if (this.dashboard && this.dashboard.layout) {
                    // Проверяем, нет ли уже такого виджета
                    const exists = this.dashboard.layout.widgets.some(w => w.id === widgetId);
                    if (exists) {
                        alert('Этот виджет уже добавлен');
                        return;
                    }
                    
                    this.dashboard.layout.widgets.push({
                        id: widgetId,
                        module: moduleId,
                        title: widgetDef.title,
                        settings: widgetDef.settings || {},
                        position: { order: this.dashboard.layout.widgets.length }
                    });
                    
                    const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
                    if (success) {
                        palette.style.transform = 'translateX(100%)';
                        setTimeout(() => palette.remove(), 300);
                        await this.render();
                    }
                }
            };
        });
    }
    
    async refreshWidget(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (widget && widget.refresh) {
            await widget.refresh();
        }
    }
    
    async refreshAllWidgets() {
        for (const [widgetId, widget] of this.widgets) {
            if (widget.refresh) {
                await widget.refresh();
            }
        }
    }
    
    subscribeEvents() {
        if (!window.CRM?.EventBus) return;
        
        window.CRM.EventBus.on('task:created', () => {
            this.refreshAllWidgets();
        });
        
        window.CRM.EventBus.on('task:updated', () => {
            this.refreshAllWidgets();
        });
        
        window.CRM.EventBus.on('task:deleted', () => {
            this.refreshAllWidgets();
        });
        
        window.CRM.EventBus.on('complex:created', () => {
            this.refreshAllWidgets();
        });
        
        window.CRM.EventBus.on('user:created', () => {
            this.refreshAllWidgets();
        });
    }
}

// Добавляем анимацию спиннера
if (!document.querySelector('#widget-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'widget-spinner-style';
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.DashboardContainer = DashboardContainer;
}

export default DashboardContainer;