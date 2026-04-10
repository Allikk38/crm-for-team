/**
 * ============================================
 * ФАЙЛ: js/components/dashboard-container.js
 * РОЛЬ: Контейнер для управления виджетами на дашборде
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание контейнера
 *   - 30.03.2026: Исправлено дублирование виджетов
 *   - 30.03.2026: Добавлены новые виджеты (KPI, прогресс, приветствие)
 *   - 30.03.2026: Переход на чистые импорты виджетов
 *   - 30.03.2026: Добавлен виджет TeamAnalyticsWidget
 *   - 08.04.2026: Интеграция с planManager, добавлены тарифные ограничения
 *   - 08.04.2026: Добавлен виджет QuickTaskWidget (быстрая задача)
 *   - 08.04.2026: Исправлена инициализация PlanManager и синтаксис класса
 *   - 08.04.2026: Переход на чистый импорт planManager
 *   - 08.04.2026: Добавлен drag-and-drop для перестановки виджетов
 * ============================================
 */

import { getActiveDashboard, saveDashboardLayout } from '../services/dashboards-supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import planManager from '../core/planManager.js';

// Импорты виджетов
import KpiSummaryWidget from './widgets/kpi-summary-widget.js';
import MyTasksWidget from './widgets/my-tasks-widget.js';
import ProjectProgressWidget from './widgets/project-progress-widget.js';
import WelcomeWidget from './widgets/welcome-widget.js';
import AgentRankingWidget from './widgets/agent-ranking-widget.js';
import TeamAnalyticsWidget from './widgets/team-analytics-widget.js';
import QuickTaskWidget from './widgets/quick-task-widget.js';
import { eventBus } from '../core/eventBus.js';

console.log('[dashboard-container] Загрузка...');

// Конфигурация тарифов для виджетов
const WIDGET_TIERS = {
    'my-tasks': 'FREE',
    'welcome': 'FREE',
    'quick-task': 'FREE',
    'kpi-summary': 'PRO',
    'project-progress': 'PRO',
    'agent-ranking': 'BUSINESS',
    'team-analytics': 'BUSINESS'
};

class DashboardContainer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.dashboard = null;
        this.widgets = new Map();
        this.editMode = false;
        this.initialized = false;
        this.renderInProgress = false;
        
        // Используем импортированный planManager
        this.planManager = planManager;
        
        console.log('[dashboard-container] Создан, planManager:', !!this.planManager);
    }
    
    /**
     * Получить тариф виджета
     * @param {string} widgetId 
     * @returns {string} 'FREE'|'PRO'|'BUSINESS'|'ENTERPRISE'
     */
    getWidgetTier(widgetId) {
        return WIDGET_TIERS[widgetId] || 'FREE';
    }
    
    /**
     * Проверить доступность виджета в текущем тарифе
     * @param {string} widgetId 
     * @returns {boolean}
     */
    isWidgetAvailable(widgetId) {
        if (!this.planManager) {
            console.warn('[dashboard-container] PlanManager недоступен, разрешаем все виджеты');
            return true;
        }
        
        const widgetTier = this.getWidgetTier(widgetId);
        const currentPlan = this.planManager.getUserPlan();
        
        console.log(`[dashboard-container] Проверка ${widgetId}: tier=${widgetTier}, plan=${currentPlan?.id}`);
        
        const tierLevels = {
            'FREE': 0,
            'PRO': 1,
            'BUSINESS': 2,
            'ENTERPRISE': 3
        };
        
        const planLevels = {
            'free': 0,
            'pro': 1,
            'business': 2,
            'enterprise': 3
        };
        
        const requiredLevel = tierLevels[widgetTier] || 0;
        const userLevel = planLevels[currentPlan?.id] || 0;
        
        const available = userLevel >= requiredLevel;
        console.log(`[dashboard-container] ${widgetId}: required=${requiredLevel}, user=${userLevel}, available=${available}`);
        
        return available;
    }
    
    /**
     * Получить отображаемое название тарифа
     * @param {string} tier 
     * @returns {string}
     */
    getTierDisplayName(tier) {
        const names = {
            'FREE': 'Бесплатный',
            'PRO': 'PRO',
            'BUSINESS': 'Бизнес',
            'ENTERPRISE': 'Корпоративный'
        };
        return names[tier] || tier;
    }
    
    /**
     * Получить цвет бейджа для тарифа
     * @param {string} tier 
     * @returns {string}
     */
    getTierBadgeColor(tier) {
        const colors = {
            'FREE': '#4caf50',
            'PRO': '#2196f3',
            'BUSINESS': '#9c27b0',
            'ENTERPRISE': '#ff9800'
        };
        return colors[tier] || '#757575';
    }
    
    /**
     * Инициализация дашборда
     */
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
            
            // Добавляем стили для drag-and-drop
            this.addDragDropStyles();
            
            console.log('[dashboard-container] Инициализирован');
        } catch (error) {
            console.error('[dashboard-container] Ошибка инициализации:', error);
            this.showErrorState(error.message);
        }
    }
    
    /**
     * Ожидание загрузки пользователя
     * @param {number} maxWaitMs 
     * @returns {Promise<boolean>}
     */
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
    
    /**
     * Показать пустое состояние дашборда
     */
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
    
    /**
     * Показать состояние ошибки
     * @param {string} message 
     */
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
    
    /**
     * Основной рендеринг дашборда
     */
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
            
            // Фильтруем виджеты по доступности
            const availableWidgets = widgets.filter(widget => {
                const isAvailable = this.isWidgetAvailable(widget.id);
                if (!isAvailable) {
                    console.warn(`[dashboard-container] Виджет ${widget.id} недоступен в текущем тарифе, скрыт`);
                }
                return isAvailable;
            });
            
            if (availableWidgets.length === 0) {
                this.showEmptyState();
                return;
            }
            
            // Удаляем дубликаты по id
            const uniqueWidgets = [];
            const seenIds = new Set();
            for (const widget of availableWidgets) {
                if (!seenIds.has(widget.id)) {
                    seenIds.add(widget.id);
                    uniqueWidgets.push(widget);
                } else {
                    console.warn(`[dashboard-container] Дубликат виджета ${widget.id} удален`);
                }
            }
            
            // Если были изменения, обновляем дашборд
            if (uniqueWidgets.length !== availableWidgets.length || availableWidgets.length !== widgets.length) {
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
            
            const fullHtml = gridHtml + `
                <div class="dashboard-promo" style="margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
                    <div class="promo-card" style="background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border-radius: 20px; padding: 24px; color: white; cursor: pointer;" onclick="window.location.href='marketplace.html'">
                        <i class="fas fa-store" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                        <h3 style="margin-bottom: 8px;">🧩 Маркетплейс модулей</h3>
                        <p style="opacity: 0.9; font-size: 0.85rem;">Расширьте возможности платформы. Добавьте модули для недвижимости, финансов, образования и здоровья.</p>
                        <button style="margin-top: 16px; padding: 8px 20px; background: white; border: none; border-radius: 40px; color: var(--accent); font-weight: 500; cursor: pointer;">Перейти в магазин →</button>
                    </div>
                    
                    <div class="promo-card" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 24px; cursor: pointer;" onclick="window.location.href='invite.html'">
                        <i class="fas fa-users" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--accent);"></i>
                        <h3 style="margin-bottom: 8px;">👥 Пригласить команду</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">Работайте вместе над проектами, делясь задачами и достижениями. Пригласите коллег в команду.</p>
                        <button style="margin-top: 16px; padding: 8px 20px; background: var(--hover-bg); border: 1px solid var(--card-border); border-radius: 40px; color: var(--text-primary); font-weight: 500; cursor: pointer;">Пригласить →</button>
                    </div>
                </div>
            `;

            this.container.innerHTML = fullHtml;
            
            // Загружаем виджеты
            for (const widgetConfig of uniqueWidgets) {
                await this.loadWidget(widgetConfig);
            }
            
            this.bindEvents();
            
        } finally {
            this.renderInProgress = false;
        }
    }
    
    /**
     * Рендеринг плейсхолдера виджета
     * @param {Object} widgetConfig 
     * @param {number} index 
     * @returns {string}
     */
    renderWidgetPlaceholder(widgetConfig, index) {
        const widgetTitle = this.getWidgetTitle(widgetConfig.id);
        const widgetIcon = this.getWidgetIcon(widgetConfig.id);
        const widgetTier = this.getWidgetTier(widgetConfig.id);
        const tierColor = this.getTierBadgeColor(widgetTier);
        
        return `
            <div class="widget-card" data-widget-id="${widgetConfig.id}" data-widget-index="${index}" 
                 draggable="${this.editMode}" 
                 style="background: var(--card-bg); border-radius: 16px; border: 1px solid var(--card-border); overflow: hidden; ${this.editMode ? 'cursor: grab;' : ''}">
                <div class="widget-header" style="padding: 12px 16px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                    <div class="widget-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                        <i class="fas ${widgetIcon}" style="color: var(--accent);"></i>
                        <span>${widgetConfig.title || widgetTitle}</span>
                        <span class="widget-tier-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 10px; background: ${tierColor}20; color: ${tierColor}; margin-left: 8px;">${widgetTier}</span>
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
    
    /**
     * Получить заголовок виджета
     * @param {string} widgetId 
     * @returns {string}
     */
    getWidgetTitle(widgetId) {
        const titles = {
            'my-tasks': 'Мои задачи',
            'quick-task': 'Быстрая задача',
            'kpi-summary': 'Ключевые показатели',
            'project-progress': 'Прогресс проекта',
            'welcome': 'Приветствие',
            'agent-ranking': 'Топ агентов',
            'team-analytics': 'Аналитика команды'
        };
        return titles[widgetId] || widgetId;
    }
    
    /**
     * Получить иконку виджета
     * @param {string} widgetId 
     * @returns {string}
     */
    getWidgetIcon(widgetId) {
        const icons = {
            'my-tasks': 'fa-tasks',
            'quick-task': 'fa-bolt',
            'kpi-summary': 'fa-chart-line',
            'project-progress': 'fa-chart-simple',
            'welcome': 'fa-rocket',
            'agent-ranking': 'fa-trophy',
            'team-analytics': 'fa-chart-simple'
        };
        return icons[widgetId] || 'fa-puzzle-piece';
    }
    
    /**
     * Загрузить виджет
     * @param {Object} widgetConfig 
     */
    async loadWidget(widgetConfig) {
        const contentContainer = this.container.querySelector(`[data-widget-content="${widgetConfig.id}"]`);
        if (!contentContainer) return;
        
        if (this.widgets.has(widgetConfig.id)) {
            console.log(`[dashboard-container] Виджет ${widgetConfig.id} уже загружен`);
            return;
        }
        
        if (!this.isWidgetAvailable(widgetConfig.id)) {
            contentContainer.innerHTML = `
                <div class="widget-locked" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-lock" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                    <div>Виджет недоступен в вашем тарифе</div>
                    <button onclick="window.location.href='settings.html#billing'" style="margin-top: 12px; padding: 6px 12px; border-radius: 8px; background: var(--accent); color: white; border: none; cursor: pointer;">Повысить тариф</button>
                </div>
            `;
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
    
    /**
     * Получить класс виджета по ID
     * @param {string} widgetId 
     * @returns {class|null}
     */
    getWidgetClass(widgetId) {
        const widgetsMap = {
            'my-tasks': MyTasksWidget,
            'quick-task': QuickTaskWidget,
            'kpi-summary': KpiSummaryWidget,
            'project-progress': ProjectProgressWidget,
            'welcome': WelcomeWidget,
            'agent-ranking': AgentRankingWidget,
            'team-analytics': TeamAnalyticsWidget
        };
        return widgetsMap[widgetId];
    }
    
    /**
     * Привязать обработчики событий
     */
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
        
        // Настройка drag-and-drop
        this.setupDragAndDrop();
    }
        /**
     * Настройка drag-and-drop для виджетов
     */
    setupDragAndDrop() {
        if (!this.editMode) return;
        
        const grid = this.container.querySelector('#dashboardGrid');
        if (!grid) return;
        
        const widgets = grid.querySelectorAll('.widget-card[draggable="true"]');
        let draggedElement = null;
        
        widgets.forEach(widget => {
            widget.addEventListener('dragstart', (e) => {
                draggedElement = widget;
                const widgetId = widget.dataset.widgetId;
                widget.classList.add('dragging');
                widget.style.opacity = '0.5';
                widget.style.cursor = 'grabbing';
                e.dataTransfer.setData('text/plain', widgetId);
                e.dataTransfer.effectAllowed = 'move';
            });
            
            widget.addEventListener('dragend', (e) => {
                widget.classList.remove('dragging');
                widget.style.opacity = '';
                widget.style.cursor = '';
                draggedElement = null;
                
                widgets.forEach(w => w.classList.remove('drag-over'));
            });
            
            widget.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (draggedElement && widget !== draggedElement) {
                    widget.classList.add('drag-over');
                }
            });
            
            widget.addEventListener('dragleave', () => {
                widget.classList.remove('drag-over');
            });
            
            widget.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                widget.classList.remove('drag-over');
                
                const targetId = widget.dataset.widgetId;
                const sourceId = e.dataTransfer.getData('text/plain');
                
                if (!sourceId || !targetId || sourceId === targetId) return;
                
                const sourceIndex = this.dashboard.layout.widgets.findIndex(w => w.id === sourceId);
                const targetIndex = this.dashboard.layout.widgets.findIndex(w => w.id === targetId);
                
                if (sourceIndex === -1 || targetIndex === -1) return;
                
                const widgetsArray = this.dashboard.layout.widgets;
                const [movedWidget] = widgetsArray.splice(sourceIndex, 1);
                widgetsArray.splice(targetIndex, 0, movedWidget);
                
                widgetsArray.forEach((w, i) => {
                    w.position = { order: i };
                });
                
                const success = await saveDashboardLayout(this.dashboard.id, this.dashboard.layout);
                
                if (success) {
                    await this.render();
                    console.log(`[dashboard-container] Виджет ${sourceId} перемещен на позицию ${targetIndex}`);
                }
            });
        });
        
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        grid.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }
        /**
     * Добавить стили для drag-and-drop
     */
    addDragDropStyles() {
        if (document.querySelector('#drag-drop-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'drag-drop-styles';
        style.textContent = `
            .widget-card[draggable="true"] {
                transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
            }
            
            .widget-card[draggable="true"]:hover {
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
                transform: translateY(-2px);
            }
            
            .widget-card.dragging {
                opacity: 0.5;
                transform: scale(0.98);
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
                cursor: grabbing !important;
            }
            
            .widget-card.drag-over {
                border: 2px dashed var(--accent) !important;
                background: var(--hover-bg) !important;
                transform: scale(1.02);
            }
        `;
        document.head.appendChild(style);
    }
    /**
     * Переключить режим редактирования
     */
    async toggleEditMode() {
        this.editMode = !this.editMode;
        await this.render();
    }
    
    /**
     * Удалить виджет
     * @param {string} widgetId 
     */
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
    
    /**
     * Показать палитру доступных виджетов
     */
    async showWidgetPalette() {
        const availableWidgets = [
            {
                id: 'quick-task',
                moduleId: 'tasks',
                title: 'Быстрая задача',
                description: 'Быстрое создание задачи с выбором приоритета',
                settings: {}
            },
            {
                id: 'my-tasks',
                moduleId: 'tasks',
                title: 'Мои задачи',
                description: 'Показывает ваши текущие задачи',
                settings: { limit: 10 }
            },
            {
                id: 'welcome',
                moduleId: 'index',
                title: 'Приветствие',
                description: 'Персональное приветствие и советы',
                settings: {}
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
                id: 'agent-ranking',
                moduleId: 'index',
                title: 'Топ агентов',
                description: 'Рейтинг агентов по завершенным задачам',
                settings: { limit: 5, period: 'all' }
            },
            {
                id: 'team-analytics',
                moduleId: 'index',
                title: 'Аналитика команды',
                description: 'KPI команды, топ агентов, график активности',
                settings: { refreshInterval: 300000 }
            }
        ];
        
        const palette = document.createElement('div');
        palette.className = 'widget-palette';
        palette.style.cssText = `
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: 360px;
            background: var(--card-bg);
            border-left: 1px solid var(--card-border);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
        `;
        
        const groupedWidgets = {
            'FREE': [],
            'PRO': [],
            'BUSINESS': []
        };
        
        availableWidgets.forEach(widget => {
            const tier = this.getWidgetTier(widget.id);
            if (groupedWidgets[tier]) {
                groupedWidgets[tier].push(widget);
            }
        });
        
        const currentPlan = this.planManager?.getUserPlan() || { id: 'free' };
        
        let widgetsHtml = '';
        
        for (const [tier, widgets] of Object.entries(groupedWidgets)) {
            if (widgets.length === 0) continue;
            
            const tierColor = this.getTierBadgeColor(tier);
            const tierName = this.getTierDisplayName(tier);
            const isTierAvailable = this.isWidgetAvailable(widgets[0]?.id || '');
            
            widgetsHtml += `
                <div class="widget-palette-section" style="margin-bottom: 20px;">
                    <div class="widget-palette-section-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--card-border);">
                        <span class="widget-tier-badge" style="font-size: 11px; padding: 3px 10px; border-radius: 12px; background: ${tierColor}20; color: ${tierColor}; font-weight: 600;">${tierName}</span>
                        ${!isTierAvailable ? '<span style="font-size: 11px; color: var(--text-muted); margin-left: auto;"><i class="fas fa-lock"></i> Требуется повышение тарифа</span>' : ''}
                    </div>
                    ${widgets.map(widget => {
                        const isAvailable = this.isWidgetAvailable(widget.id);
                        const widgetTier = this.getWidgetTier(widget.id);
                        const tierColor = this.getTierBadgeColor(widgetTier);
                        
                        return `
                            <div class="widget-palette-item ${!isAvailable ? 'locked' : ''}" 
                                 data-widget-id="${widget.id}" 
                                 data-module-id="${widget.moduleId}" 
                                 data-available="${isAvailable}"
                                 style="padding: 12px; background: var(--hover-bg); border-radius: 12px; margin-bottom: 10px; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; transition: all 0.2s; display: flex; align-items: flex-start; gap: 12px; opacity: ${isAvailable ? '1' : '0.6'};">
                                <i class="fas ${this.getWidgetIcon(widget.id)}" style="font-size: 20px; color: ${isAvailable ? 'var(--accent)' : 'var(--text-muted)'}; margin-top: 2px;"></i>
                                <div class="widget-palette-info" style="flex: 1;">
                                    <div class="widget-palette-name" style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                                        ${widget.title}
                                        <span class="widget-tier-badge" style="font-size: 9px; padding: 2px 6px; border-radius: 10px; background: ${tierColor}20; color: ${tierColor};">${widgetTier}</span>
                                    </div>
                                    <div class="widget-palette-desc" style="font-size: 12px; opacity: 0.7;">${widget.description}</div>
                                    ${!isAvailable ? `
                                        <div style="margin-top: 8px;">
                                            <button class="upgrade-btn" data-tier="${widgetTier}" style="padding: 4px 12px; border-radius: 16px; background: ${tierColor}; color: white; border: none; cursor: pointer; font-size: 11px;">
                                                <i class="fas fa-crown"></i> Повысить до ${this.getTierDisplayName(widgetTier)}
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                ${!isAvailable ? '<i class="fas fa-lock" style="color: var(--text-muted); margin-top: 2px;"></i>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        palette.innerHTML = `
            <div class="widget-palette-header" style="padding: 20px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center;">
                <div class="widget-palette-title" style="font-size: 18px; font-weight: 600;">
                    <i class="fas fa-plus"></i> Добавить виджет
                </div>
                <button class="widget-palette-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
            </div>
            <div class="widget-palette-subheader" style="padding: 12px 20px; background: var(--hover-bg); border-bottom: 1px solid var(--card-border);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-tag" style="color: var(--accent);"></i>
                    <span style="font-size: 13px;">Текущий тариф: <strong style="color: var(--accent);">${this.getTierDisplayName(currentPlan.id === 'free' ? 'FREE' : currentPlan.id.toUpperCase())}</strong></span>
                </div>
            </div>
            <div class="widget-palette-list" style="flex: 1; overflow-y: auto; padding: 20px;">
                ${widgetsHtml}
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
            item.onclick = async (e) => {
                const isAvailable = item.dataset.available === 'true';
                
                if (!isAvailable) {
                    return;
                }
                
                const widgetId = item.dataset.widgetId;
                const moduleId = item.dataset.moduleId;
                const widgetDef = availableWidgets.find(w => w.id === widgetId);
                
                if (this.dashboard && this.dashboard.layout) {
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
        
        const upgradeBtns = palette.querySelectorAll('.upgrade-btn');
        upgradeBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'settings.html#billing';
            };
        });
    }
    
    /**
     * Обновить конкретный виджет
     * @param {string} widgetId 
     */
    async refreshWidget(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (widget && widget.refresh) {
            await widget.refresh();
        }
    }
    
    /**
     * Обновить все виджеты
     */
    async refreshAllWidgets() {
        for (const [widgetId, widget] of this.widgets) {
            if (widget.refresh) {
                await widget.refresh();
            }
        }
    }
    
    /**
     * Подписаться на события шины событий
     */
    subscribeEvents() {
    if (!eventBus) {
        console.warn('[dashboard-container] EventBus недоступен, события не будут обрабатываться');
        return;
    }
    
    try {
        eventBus.on('task:created', () => {
            console.log('[dashboard-container] task:created, обновляем виджеты');
            this.refreshAllWidgets();
        });
        
        eventBus.on('task:updated', () => {
            this.refreshAllWidgets();
        });
        
        eventBus.on('task:deleted', () => {
            this.refreshAllWidgets();
        });
        
        eventBus.on('complex:created', () => {
            this.refreshAllWidgets();
        });
        
        eventBus.on('user:created', () => {
            this.refreshAllWidgets();
        });
        
        console.log('[dashboard-container] Подписки на события активированы');
    } catch (error) {
        console.warn('[dashboard-container] Ошибка подписки на события:', error);
    }
}

// Добавляем стили для спиннера
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


export default DashboardContainer;
