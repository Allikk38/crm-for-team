/**
 * ============================================
 * ФАЙЛ: js/components/widgets/base-widget.js
 * РОЛЬ: Базовый класс для всех виджетов дашборда
 * 
 * ФУНКЦИОНАЛ:
 *   - Общие методы отображения состояний (loading, error, empty)
 *   - Базовый жизненный цикл виджета
 *   - Управление контейнером
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Создание базового класса
 * ============================================
 */

console.log('[base-widget] Загрузка...');

class BaseWidget {
    /**
     * @param {HTMLElement} container - DOM элемент для рендеринга
     * @param {Object} options - Настройки виджета
     * @param {string} options.widgetId - ID виджета
     * @param {string} options.moduleId - ID модуля
     * @param {Object} options.settings - Пользовательские настройки
     * @param {string} options.dashboardId - ID дашборда
     */
    constructor(container, options = {}) {
        if (!container) {
            throw new Error('[base-widget] Контейнер не может быть пустым');
        }
        
        this.container = container;
        this.widgetId = options.widgetId || 'unknown';
        this.moduleId = options.moduleId || 'unknown';
        this.settings = options.settings || {};
        this.dashboardId = options.dashboardId || null;
        
        console.log(`[base-widget] Создан виджет ${this.widgetId}`);
    }
    
    /**
     * Показать состояние загрузки
     */
    showLoading() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="widget-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; min-height: 150px;">
                <div class="widget-spinner" style="width: 32px; height: 32px; border: 3px solid var(--card-border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span style="color: var(--text-muted);">Загрузка...</span>
            </div>
        `;
    }
    
    /**
     * Показать сообщение об ошибке
     * @param {string} message - Текст ошибки
     * @param {boolean} showRetry - Показывать кнопку повтора
     */
    showError(message = 'Ошибка загрузки', showRetry = true) {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="widget-error" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; min-height: 150px; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: #ff6b6b;"></i>
                <div style="color: #ff6b6b; font-weight: 500;">${message}</div>
                ${showRetry ? `
                    <button class="widget-retry-btn" onclick="this.closest('.widget-content').widgetInstance?.render()" style="margin-top: 8px; padding: 6px 16px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-sync-alt"></i> Повторить
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Показать пустое состояние
     * @param {string} message - Сообщение
     * @param {string} icon - Иконка Font Awesome
     */
    showEmpty(message = 'Нет данных', icon = 'fa-inbox') {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="widget-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; min-height: 150px; text-align: center;">
                <i class="fas ${icon}" style="font-size: 32px; opacity: 0.5; color: var(--text-muted);"></i>
                <div style="color: var(--text-muted);">${message}</div>
            </div>
        `;
    }
    
    /**
     * Показать сообщение о недоступности виджета
     * @param {string} requiredTier - Требуемый тариф
     */
    showLocked(requiredTier = 'PRO') {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="widget-locked" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; min-height: 150px; text-align: center;">
                <i class="fas fa-lock" style="font-size: 32px; color: var(--text-muted);"></i>
                <div style="color: var(--text-muted);">Виджет недоступен в вашем тарифе</div>
                <div style="font-size: 12px; color: var(--text-muted);">Требуется тариф ${requiredTier}</div>
                <button onclick="window.location.href='settings.html#billing'" style="margin-top: 8px; padding: 6px 16px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-crown"></i> Повысить тариф
                </button>
            </div>
        `;
    }
    
    /**
     * Основной метод рендеринга (должен быть переопределен)
     */
    async render() {
        console.warn(`[base-widget] Метод render() не переопределен в ${this.widgetId}`);
        this.showEmpty('Виджет в разработке', 'fa-puzzle-piece');
    }
    
    /**
     * Обновление данных виджета (должен быть переопределен)
     */
    async refresh() {
        console.log(`[base-widget] Обновление виджета ${this.widgetId}`);
        await this.render();
    }
    
    /**
     * Очистка ресурсов перед удалением (должен быть переопределен)
     */
    destroy() {
        console.log(`[base-widget] Уничтожение виджета ${this.widgetId}`);
        
        // Очищаем контейнер
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Удаляем ссылки
        this.container = null;
    }
    
    /**
     * Получить настройку виджета
     * @param {string} key - Ключ настройки
     * @param {*} defaultValue - Значение по умолчанию
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }
    
    /**
     * Обновить настройки виджета
     * @param {Object} newSettings - Новые настройки
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log(`[base-widget] Настройки виджета ${this.widgetId} обновлены`);
    }
}

// Добавляем стили для анимации спиннера
if (typeof document !== 'undefined' && !document.querySelector('#base-widget-styles')) {
    const style = document.createElement('style');
    style.id = 'base-widget-styles';
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .widget-loading,
        .widget-error,
        .widget-empty,
        .widget-locked {
            animation: widgetFadeIn 0.3s ease;
        }
        
        @keyframes widgetFadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.BaseWidget = BaseWidget;
}

export default BaseWidget;
