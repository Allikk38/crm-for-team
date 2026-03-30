/**
 * ============================================
 * ФАЙЛ: js/components/widget.js
 * РОЛЬ: Базовый класс для всех виджетов дашборда
 * 
 * ОСОБЕННОСТИ:
 *   - Единый интерфейс для всех виджетов
 *   - Встроенная подписка на события EventBus
 *   - Автоматическое обновление по интервалу
 *   - Управление состоянием загрузки
 *   - Кэширование данных
 *   - Поддержка разных размеров сетки
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/eventBus.js
 *   - js/utils/helpers.js (escapeHtml, formatDate)
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание базового класса виджета
 * ============================================
 */

console.log('[widget.js] Базовый класс виджета загружен');

/**
 * Базовый класс виджета
 */
class Widget {
    /**
     * Конструктор виджета
     * @param {HTMLElement} container - DOM элемент для рендеринга
     * @param {Object} options - Настройки виджета
     * @param {Object} options.settings - Пользовательские настройки виджета
     * @param {string} options.widgetId - ID виджета
     * @param {string} options.moduleId - ID модуля
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.widgetId = options.widgetId || 'unknown';
        this.moduleId = options.moduleId || 'unknown';
        this.settings = options.settings || {};
        this.data = null;
        this.loading = false;
        this.error = null;
        this.intervalId = null;
        this.subscriptions = new Map(); // Храним подписки для отписки
        this.cacheKey = `widget_${this.widgetId}_${JSON.stringify(this.settings)}`;
        
        console.log(`[widget] Создан виджет: ${this.widgetId}`);
    }
    
    /**
     * Основной метод рендеринга (должен быть переопределен)
     */
    async render() {
        console.log(`[widget] Рендеринг виджета ${this.widgetId} не реализован`);
        this.showPlaceholder('Виджет в разработке');
    }
    
    /**
     * Обновить данные виджета
     */
    async refresh() {
        if (this.loading) return;
        
        console.log(`[widget] Обновление виджета ${this.widgetId}`);
        this.loading = true;
        this.showLoading();
        
        try {
            await this.fetchData();
            await this.render();
            this.loading = false;
            this.error = null;
        } catch (error) {
            console.error(`[widget] Ошибка обновления ${this.widgetId}:`, error);
            this.error = error.message;
            this.showError(error.message);
            this.loading = false;
        }
    }
    
    /**
     * Загрузка данных (должен быть переопределен)
     */
    async fetchData() {
        // Переопределить в наследнике
        return {};
    }
    
    /**
     * Показать индикатор загрузки
     */
    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="widget-loading">
                <div class="widget-spinner"></div>
                <span>Загрузка...</span>
            </div>
        `;
    }
    
    /**
     * Показать сообщение об ошибке
     * @param {string} message - Текст ошибки
     */
    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="widget-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
                <button class="widget-retry-btn" onclick="this.closest('.widget').__widget?.refresh()">
                    <i class="fas fa-sync-alt"></i> Повторить
                </button>
            </div>
        `;
    }
    
    /**
     * Показать плейсхолдер
     * @param {string} message - Текст плейсхолдера
     */
    showPlaceholder(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="widget-placeholder">
                <i class="fas fa-cog"></i>
                <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
            </div>
        `;
    }
    
    /**
     * Показать пустое состояние
     * @param {string} message - Текст
     */
    showEmpty(message = 'Нет данных') {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="widget-empty">
                <i class="fas fa-inbox"></i>
                <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
            </div>
        `;
    }
    
    /**
     * Подписаться на событие EventBus
     * @param {string} event - Название события
     * @param {Function} handler - Обработчик
     * @param {boolean} autoRefresh - Автоматически обновлять виджет при событии
     */
    subscribe(event, handler, autoRefresh = true) {
        if (!window.CRM?.EventBus) {
            console.warn('[widget] EventBus не доступен');
            return;
        }
        
        const callback = async (data) => {
            if (handler && typeof handler === 'function') {
                await handler(data);
            }
            if (autoRefresh && this.shouldHandleEvent(event, data)) {
                await this.refresh();
            }
        };
        
        const unsubscribe = window.CRM.EventBus.on(event, callback);
        
        // Сохраняем для отписки
        if (!this.subscriptions.has(event)) {
            this.subscriptions.set(event, []);
        }
        this.subscriptions.get(event).push(unsubscribe);
        
        return unsubscribe;
    }
    
    /**
     * Определить, нужно ли обрабатывать событие
     * @param {string} event - Название события
     * @param {any} data - Данные события
     * @returns {boolean}
     */
    shouldHandleEvent(event, data) {
        // По умолчанию обрабатываем все события
        // В наследниках можно переопределить для фильтрации
        return true;
    }
    
    /**
     * Установить автообновление по интервалу
     * @param {number} intervalMs - Интервал в миллисекундах
     */
    setAutoRefresh(intervalMs) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(() => {
            if (!this.loading) {
                this.refresh();
            }
        }, intervalMs);
        
        console.log(`[widget] Автообновление установлено: ${intervalMs}ms`);
    }
    
    /**
     * Сохранить данные в кэш
     * @param {any} data - Данные для кэширования
     * @param {number} ttl - Время жизни в миллисекундах (по умолчанию 5 минут)
     */
    cacheData(data, ttl = 5 * 60 * 1000) {
        try {
            const cacheItem = {
                data: data,
                timestamp: Date.now(),
                ttl: ttl
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheItem));
            this.data = data;
        } catch (error) {
            console.warn('[widget] Не удалось сохранить кэш:', error);
        }
    }
    
    /**
     * Получить данные из кэша
     * @returns {any|null}
     */
    getCachedData() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;
            
            const { data, timestamp, ttl } = JSON.parse(cached);
            if (Date.now() - timestamp < ttl) {
                return data;
            }
            
            // Кэш устарел
            localStorage.removeItem(this.cacheKey);
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Очистить кэш виджета
     */
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
        } catch (error) {}
    }
    
    /**
     * Отписаться от всех событий
     */
    unsubscribeAll() {
        for (const [event, unsubscribes] of this.subscriptions) {
            for (const unsubscribe of unsubscribes) {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            }
        }
        this.subscriptions.clear();
    }
    
    /**
     * Остановить автообновление
     */
    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    /**
     * Обновить размер виджета (для GridStack)
     * @param {number} width - Новая ширина
     * @param {number} height - Новая высота
     */
    onResize(width, height) {
        // Переопределить в наследнике при необходимости
        console.log(`[widget] Изменение размера: ${width}x${height}`);
    }
    
    /**
     * Уничтожить виджет (освободить ресурсы)
     */
    destroy() {
        console.log(`[widget] Уничтожение виджета ${this.widgetId}`);
        this.stopAutoRefresh();
        this.unsubscribeAll();
        this.clearCache();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
    
    /**
     * Показать уведомление
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип (info, success, warning, error)
     */
    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(type, message);
        } else {
            console.log(`[widget] ${type}: ${message}`);
        }
    }
}

/**
 * Регистрируем виджет в глобальном объекте
 */
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Widget = Widget;
    console.log('[widget.js] Базовый класс виджета зарегистрирован');
}

// Экспорт для модулей
export default Widget;
