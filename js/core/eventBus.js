/**
 * ============================================
 * ФАЙЛ: js/core/eventBus.js
 * РОЛЬ: Шина событий для обмена данными между модулями
 * 
 * ОСОБЕННОСТИ:
 *   - Модули могут общаться, не зная о существовании друг друга
 *   - Если модуль не загружен - просто игнорируем
 *   - Поддержка подписки на события
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание шины событий
 * ============================================
 */

console.log('[eventBus] Загрузка шины событий...');

class EventBus {
    constructor() {
        this.events = new Map();
        this.debug = false;
    }
    
    /**
     * Подписаться на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        
        if (this.debug) {
            console.log(`[eventBus] Подписка на "${event}"`);
        }
        
        // Возвращаем функцию для отписки
        return () => this.off(event, callback);
    }
    
    /**
     * Отписаться от события
     */
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }
    
    /**
     * Вызвать событие
     * @param {string} event - Название события
     * @param {any} data - Данные события
     */
    emit(event, data) {
        if (!this.events.has(event)) return;
        
        if (this.debug) {
            console.log(`[eventBus] Событие "${event}"`, data);
        }
        
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[eventBus] Ошибка в обработчике "${event}":`, error);
            }
        });
    }
    
    /**
     * Вызвать событие и ждать ответа
     * @param {string} event - Название события
     * @param {any} data - Данные события
     * @returns {Promise<any>}
     */
    async ask(event, data) {
        return new Promise((resolve) => {
            const responseEvent = `${event}:response`;
            const timeout = setTimeout(() => {
                this.off(responseEvent, handler);
                resolve(null);
            }, 5000);
            
            const handler = (response) => {
                clearTimeout(timeout);
                this.off(responseEvent, handler);
                resolve(response);
            };
            
            this.once(responseEvent, handler);
            this.emit(event, { ...data, _requestId: Date.now() });
        });
    }
    
    /**
     * Подписаться на событие один раз
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }
    
    /**
     * Проверить, есть ли подписчики на событие
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).size > 0;
    }
}

// Создаем глобальную шину событий
window.CRM = window.CRM || {};
window.CRM.EventBus = new EventBus();

// Включаем debug в режиме разработки
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.CRM.EventBus.debug = true;
}

console.log('[eventBus] Шина событий загружена');
