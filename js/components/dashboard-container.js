/**
 * ============================================
 * ФАЙЛ: js/components/dashboard-container.js
 * РОЛЬ: Контейнер для управления виджетами на дашборде
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание контейнера
 *   - 30.03.2026: Исправлена обработка виджетов
 * ============================================
 */

import { getActiveDashboard, saveDashboardLayout, getAvailableWidgets } from '../services/dashboards-supabase.js';

console.log('[dashboard-container] Загрузка...');

class DashboardContainer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.dashboard = null;
        this.widgets = new Map();
        this.editMode = false;
        
        console.log('[dashboard-container] Создан');
    }
    
    async init() {
        console.log('[dashboard-container] Инициализация...');
        
        this.dashboard = await getActiveDashboard();
        if (!this.dashboard) {
            console.error('[dashboard-container] Дашборд не найден');
            this.showEmptyState();
            return;
        }
        
        await this.render();
        this.subscribeEvents();
        
        console.log('[dashboard-container] Инициализирован');
    }
    
    showEmptyState() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="dashboard-empty">
                <i class="fas fa-puzzle-piece"></i>
                <h3>Нет виджетов</h3>
                <p>Нажмите "Настроить", чтобы добавить виджеты</p>
                <button class="dashboard-btn primary" id="initAddWidgetBtn">
                    <i class="fas fa-plus"></i> Добавить виджет
                </button>
            </div>
        `;
        
        const addBtn = this.container.querySelector('#initAddWidgetBtn');
        if (addBtn) {
            addBtn.onclick = () => this.showWidgetPalette();
        }
    }
    
    async render() {
        if (!this.container) return;
        
        const layout = this.dashboard.layout;
        const widgets = layout?.widgets || [];
        
        if (widgets.length === 0) {
            this.showEmptyState();
            return;
        }
        
        const gridHtml = `
            <div class="dashboard-toolbar">
                <div class="dashboard-title">
                    <i class="fas fa-chart-line"></i> 
                    ${this.dashboard.name}
                </div>
                <div class="dashboard-controls">
                    <button class="dashboard-btn" id="refreshDashboard">
                        <i class="fas fa-sync-alt"></i> Обновить
                    </button>
                    <button class="dashboard-btn" id="editDashboard">
                        <i class="fas fa-edit"></i> 
                        ${this.editMode ? 'Сохранить' : 'Настроить'}
                    </button>
                    <button class="dashboard-btn primary" id="addWidgetBtn">
                        <i class="fas fa-plus"></i> Добавить виджет
                    </button>
                </div>
            </div>
            <div class="dashboard-grid ${this.editMode ? 'edit-mode' : ''}" id="dashboardGrid">
                ${widgets.map((widget, index) => this.renderWidgetPlaceholder(widget, index)).join('')}
            </div>
        `;
        
        this.container.innerHTML = gridHtml;
        
        // Загружаем виджеты
        await this.loadWidgets(widgets);
        
        // Привязываем события
        this.bindEvents();
    }
    
    renderWidgetPlaceholder(widgetConfig, index) {
        const widgetTitle = this.getWidgetTitle(widgetConfig.id);
        const widgetIcon = this.getWidgetIcon(widgetConfig.id);
        
        return `
            <div class="widget-card" data-widget-id="${widgetConfig.id}" data-widget-index="${index}">
                <div class="widget-header">
                    <div class="widget-title">
                        <i class="fas ${widgetIcon}"></i>
                        <span>${widgetConfig.title || widgetTitle}</span>
                    </div>
                    <div class="widget-actions">
                        ${this.editMode ? `
                            <button class="widget-action-btn remove-widget" data-widget-id="${widgetConfig.id}" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="widget-action-btn drag-handle" title="Переместить">
                                <i class="fas fa-grip-vertical"></i>
                            </button>
                        ` : ''}
                        <button class="widget-action-btn refresh-widget" data-widget-id="${widgetConfig.id}" title="Обновить">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-content" data-widget-content="${widgetConfig.id}">
                    <div class="widget-loading">
                        <div class="widget-spinner"></div>
                        <span>Загрузка ${widgetTitle}...</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    getWidgetTitle(widgetId) {
        const titles = {
            'my-tasks': 'Мои задачи',
            'tasks-summary': 'Сводка задач',
            'overdue-tasks': 'Просроченные задачи',
            'kpi-summary': 'KPI показатели',
            'weekly-chart': 'Динамика задач',
            'agent-ranking': 'Топ агентов',
            'deals-pipeline': 'Воронка продаж',
            'calendar-mini': 'Календарь'
        };
        return titles[widgetId] || widgetId;
    }
    
    getWidgetIcon(widgetId) {
        const icons = {
            'my-tasks': 'fa-tasks',
            'tasks-summary': 'fa-chart-simple',
            'overdue-tasks': 'fa-exclamation-triangle',
            'kpi-summary': 'fa-chart-line',
            'weekly-chart': 'fa-chart-line',
            'agent-ranking': 'fa-trophy',
            'deals-pipeline': 'fa-chart-line',
            'calendar-mini': 'fa-calendar'
        };
        return icons[widgetId] || 'fa-puzzle-piece';
    }
    
    async loadWidgets(widgets) {
        for (const widgetConfig of widgets) {
            await this.loadWidget(widgetConfig);
        }
    }
    
    async loadWidget(widgetConfig) {
        const contentContainer = this.container.querySelector(`[data-widget-content="${widgetConfig.id}"]`);
        if (!contentContainer) return;
        
        try {
            const WidgetClass = this.getWidgetClass(widgetConfig.id);
            if (!WidgetClass) {
                contentContainer.innerHTML = `
                    <div class="widget-empty">
                        <i class="fas fa-puzzle-piece"></i>
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
                dashboardId: this.dashboard.id
            });
            
            this.widgets.set(widgetConfig.id, widget);
            await widget.render();
            
        } catch (error) {
            console.error(`[dashboard-container] Ошибка загрузки виджета ${widgetConfig.id}:`, error);
            contentContainer.innerHTML = `
                <div class="widget-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Ошибка загрузки</div>
                    <button onclick="location.reload()">Повторить</button>
                </div>
            `;
        }
    }
    
    getWidgetClass(widgetId) {
        // Только существующие виджеты
        const widgetsMap = {
            'my-tasks': window.CRM?.Widgets?.MyTasksWidget
        };
        
        const WidgetClass = widgetsMap[widgetId];
        if (!WidgetClass && widgetId !== 'my-tasks') {
            console.log(`[dashboard-container] Виджет ${widgetId} не найден, будет показан плейсхолдер`);
        }
        
        return WidgetClass;
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
        
        if (this.editMode) {
            this.enableDragAndDrop();
        } else {
            await this.saveLayout();
        }
    }
    
    enableDragAndDrop() {
        const grid = this.container.querySelector('#dashboardGrid');
        if (!grid) return;
        
        let dragSrc = null;
        const cards = grid.querySelectorAll('.widget-card');
        
        cards.forEach(card => {
            card.setAttribute('draggable', true);
            card.style.cursor = 'grab';
            
            card.addEventListener('dragstart', (e) => {
                dragSrc = card;
                e.dataTransfer.effectAllowed = 'move';
                card.style.opacity = '0.5';
            });
            
            card.addEventListener('dragend', (e) => {
                card.style.opacity = '';
                dragSrc = null;
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                if (dragSrc && dragSrc !== card) {
                    const parent = grid;
                    const children = [...parent.children];
                    const dragIndex = children.indexOf(dragSrc);
                    const dropIndex = children.indexOf(card);
                    
                    if (dragIndex < dropIndex) {
                        card.after(dragSrc);
                    } else {
                        card.before(dragSrc);
                    }
                }
            });
        });
    }
    
    async saveLayout() {
        const grid = this.container.querySelector('#dashboardGrid');
        const cards = grid.querySelectorAll('.widget-card');
        
        const newWidgets = [];
        cards.forEach((card, index) => {
            const widgetId = card.dataset.widgetId;
            const oldConfig = this.dashboard.layout.widgets.find(w => w.id === widgetId);
            if (oldConfig) {
                newWidgets.push({
                    ...oldConfig,
                    position: { order: index }
                });
            }
        });
        
        this.dashboard.layout.widgets = newWidgets;
        
        const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
        if (success) {
            console.log('[dashboard-container] Дашборд сохранен');
            this.editMode = false;
            await this.render();
        }
    }
    
    async removeWidget(widgetId) {
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
            }
        ];
        
        const palette = document.createElement('div');
        palette.className = 'widget-palette';
        palette.innerHTML = `
            <div class="widget-palette-header">
                <div class="widget-palette-title">
                    <i class="fas fa-plus"></i> Добавить виджет
                </div>
                <button class="widget-palette-close">&times;</button>
            </div>
            <div class="widget-palette-list">
                ${availableWidgets.map(widget => `
                    <div class="widget-palette-item" data-widget-id="${widget.id}" data-module-id="${widget.moduleId}">
                        <i class="fas ${this.getWidgetIcon(widget.id)}"></i>
                        <div class="widget-palette-info">
                            <div class="widget-palette-name">${widget.title}</div>
                            <div class="widget-palette-desc">${widget.description}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(palette);
        setTimeout(() => palette.classList.add('open'), 10);
        
        const closeBtn = palette.querySelector('.widget-palette-close');
        closeBtn.onclick = () => {
            palette.classList.remove('open');
            setTimeout(() => palette.remove(), 300);
        };
        
        const items = palette.querySelectorAll('.widget-palette-item');
        items.forEach(item => {
            item.onclick = async () => {
                const widgetId = item.dataset.widgetId;
                const moduleId = item.dataset.moduleId;
                const widgetDef = availableWidgets.find(w => w.id === widgetId);
                
                this.dashboard.layout.widgets.push({
                    id: widgetId,
                    module: moduleId,
                    title: widgetDef.title,
                    settings: widgetDef.settings || {},
                    position: { order: this.dashboard.layout.widgets.length }
                });
                
                const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
                if (success) {
                    palette.classList.remove('open');
                    setTimeout(() => palette.remove(), 300);
                    await this.render();
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
    }
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.DashboardContainer = DashboardContainer;
}

export default DashboardContainer;
