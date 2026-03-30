/**
 * ============================================
 * ФАЙЛ: js/components/dashboard-container.js
 * РОЛЬ: Контейнер для управления виджетами на дашборде
 * 
 * ОСОБЕННОСТИ:
 *   - Загрузка конфигурации дашборда из БД
 *   - Управление сеткой виджетов
 *   - Режим редактирования
 *   - Добавление/удаление виджетов
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание контейнера
 * ============================================
 */

import { getActiveDashboard, saveDashboardLayout, getAvailableWidgets } from '../services/dashboards-supabase.js';

console.log('[dashboard-container] Загрузка...');

class DashboardContainer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.dashboard = null;
        this.widgets = new Map(); // widgetId -> widgetInstance
        this.editMode = false;
        
        console.log('[dashboard-container] Создан');
    }
    
    async init() {
        console.log('[dashboard-container] Инициализация...');
        
        // Загружаем дашборд
        this.dashboard = await getActiveDashboard();
        if (!this.dashboard) {
            console.error('[dashboard-container] Дашборд не найден');
            return;
        }
        
        // Отрисовываем
        await this.render();
        
        // Подписываемся на события
        this.subscribeEvents();
        
        console.log('[dashboard-container] Инициализирован');
    }
    
    async render() {
        if (!this.container) return;
        
        const layout = this.dashboard.layout;
        const widgets = layout?.widgets || [];
        
        // Создаем сетку
        const gridHtml = `
            <div class="dashboard-toolbar">
                <h1 class="dashboard-title">
                    <i class="fas fa-chart-line"></i> 
                    ${this.dashboard.name}
                </h1>
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
                ${widgets.map(widget => this.renderWidgetPlaceholder(widget)).join('')}
            </div>
        `;
        
        this.container.innerHTML = gridHtml;
        
        // Загружаем виджеты
        await this.loadWidgets(widgets);
        
        // Привязываем события
        this.bindEvents();
    }
    
    renderWidgetPlaceholder(widgetConfig) {
        return `
            <div class="widget-card" data-widget-id="${widgetConfig.id}" data-module-id="${widgetConfig.module}">
                <div class="widget-header">
                    <div class="widget-title">
                        <i class="fas ${this.getWidgetIcon(widgetConfig.id)}"></i>
                        <span>${widgetConfig.title || widgetConfig.id}</span>
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
                    <div class="widget-loading">Загрузка виджета...</div>
                </div>
            </div>
        `;
    }
    
    getWidgetIcon(widgetId) {
        const icons = {
            'my-tasks': 'fa-tasks',
            'tasks-summary': 'fa-chart-simple',
            'overdue-tasks': 'fa-exclamation-triangle',
            'deals-pipeline': 'fa-chart-line',
            'weekly-chart': 'fa-chart-line',
            'agent-ranking': 'fa-trophy'
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
            // Получаем класс виджета
            const WidgetClass = this.getWidgetClass(widgetConfig.id);
            if (!WidgetClass) {
                contentContainer.innerHTML = `
                    <div class="widget-empty">
                        <i class="fas fa-puzzle-piece"></i>
                        <div>Виджет "${widgetConfig.id}" не найден</div>
                    </div>
                `;
                return;
            }
            
            // Создаем экземпляр
            const widget = new WidgetClass(contentContainer, {
                widgetId: widgetConfig.id,
                moduleId: widgetConfig.module,
                settings: widgetConfig.settings || {},
                dashboardId: this.dashboard.id
            });
            
            // Сохраняем
            this.widgets.set(widgetConfig.id, widget);
            
            // Рендерим
            await widget.render();
            
        } catch (error) {
            console.error(`[dashboard-container] Ошибка загрузки виджета ${widgetConfig.id}:`, error);
            contentContainer.innerHTML = `
                <div class="widget-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Ошибка загрузки виджета</div>
                    <button onclick="location.reload()">Повторить</button>
                </div>
            `;
        }
    }
    
    getWidgetClass(widgetId) {
        // Маппинг виджетов на классы
        const widgets = {
            'my-tasks': window.CRM?.Widgets?.MyTasksWidget
        };
        
        const WidgetClass = widgets[widgetId];
        if (!WidgetClass) {
            console.warn(`[dashboard-container] Виджет ${widgetId} не найден`);
        }
        
        return WidgetClass;
    }
    
    bindEvents() {
        // Кнопка обновления
        const refreshBtn = this.container.querySelector('#refreshDashboard');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshAllWidgets();
        }
        
        // Кнопка редактирования
        const editBtn = this.container.querySelector('#editDashboard');
        if (editBtn) {
            editBtn.onclick = () => this.toggleEditMode();
        }
        
        // Кнопка добавления виджета
        const addBtn = this.container.querySelector('#addWidgetBtn');
        if (addBtn) {
            addBtn.onclick = () => this.showWidgetPalette();
        }
        
        // Кнопки обновления виджетов
        const refreshWidgetBtns = this.container.querySelectorAll('.refresh-widget');
        refreshWidgetBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const widgetId = btn.dataset.widgetId;
                this.refreshWidget(widgetId);
            };
        });
        
        // Кнопки удаления (в режиме редактирования)
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
            // Включаем drag-and-drop
            this.enableDragAndDrop();
        } else {
            // Сохраняем новую конфигурацию
            await this.saveLayout();
        }
    }
    
    enableDragAndDrop() {
        const grid = this.container.querySelector('#dashboardGrid');
        if (!grid) return;
        
        // Простая реализация drag-and-drop
        let dragSrc = null;
        
        const cards = grid.querySelectorAll('.widget-card');
        cards.forEach(card => {
            card.setAttribute('draggable', true);
            
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
                if (dragSrc !== card) {
                    // Меняем местами
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
        // Собираем новый порядок виджетов
        const grid = this.container.querySelector('#dashboardGrid');
        const cards = grid.querySelectorAll('.widget-card');
        
        const newWidgets = [];
        cards.forEach(card => {
            const widgetId = card.dataset.widgetId;
            const moduleId = card.dataset.moduleId;
            
            // Находим старую конфигурацию
            const oldConfig = this.dashboard.layout.widgets.find(w => w.id === widgetId);
            if (oldConfig) {
                newWidgets.push({
                    ...oldConfig,
                    position: { order: newWidgets.length }
                });
            }
        });
        
        // Обновляем layout
        this.dashboard.layout.widgets = newWidgets;
        
        // Сохраняем в БД
        const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
        if (success) {
            console.log('[dashboard-container] Дашборд сохранен');
            this.editMode = false;
            await this.render();
        }
    }
    
    async removeWidget(widgetId) {
        // Удаляем из конфигурации
        const index = this.dashboard.layout.widgets.findIndex(w => w.id === widgetId);
        if (index !== -1) {
            this.dashboard.layout.widgets.splice(index, 1);
            
            // Сохраняем
            const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
            if (success) {
                // Уничтожаем виджет
                const widget = this.widgets.get(widgetId);
                if (widget && widget.destroy) {
                    widget.destroy();
                }
                this.widgets.delete(widgetId);
                
                // Перерисовываем
                await this.render();
            }
        }
    }
    
    async showWidgetPalette() {
        const availableWidgets = getAvailableWidgets();
        
        // Создаем палитру
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
                            <div class="widget-palette-desc">${widget.description || ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(palette);
        
        // Анимация открытия
        setTimeout(() => palette.classList.add('open'), 10);
        
        // Закрытие
        const closeBtn = palette.querySelector('.widget-palette-close');
        closeBtn.onclick = () => {
            palette.classList.remove('open');
            setTimeout(() => palette.remove(), 300);
        };
        
        // Добавление виджета
        const items = palette.querySelectorAll('.widget-palette-item');
        items.forEach(item => {
            item.onclick = async () => {
                const widgetId = item.dataset.widgetId;
                const moduleId = item.dataset.moduleId;
                const widgetDef = availableWidgets.find(w => w.id === widgetId);
                
                // Добавляем в конфигурацию
                this.dashboard.layout.widgets.push({
                    id: widgetId,
                    module: moduleId,
                    title: widgetDef.title,
                    settings: widgetDef.settings || {},
                    position: { order: this.dashboard.layout.widgets.length }
                });
                
                // Сохраняем
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
        
        // Обновляем виджеты при изменениях
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

// Экспортируем
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.DashboardContainer = DashboardContainer;
}

export default DashboardContainer;
