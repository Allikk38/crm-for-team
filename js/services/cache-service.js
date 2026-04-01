/**
 * ============================================
 * ФАЙЛ: js/services/cache-service.js
 * РОЛЬ: Единый сервис кэширования для всего приложения
 * 
 * ФУНКЦИОНАЛ:
 *   - Поддержка memory, sessionStorage, localStorage
 *   - TTL (время жизни) для записей
 *   - Автоматическая очистка просроченных записей при получении
 * 
 * ЗАВИСИМОСТИ:
 *   - нет внешних зависимостей
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   import cacheService from './cache-service.js';
 *   cacheService.set('key', data, { ttl: 300, storage: 'session' });
 *   const data = cacheService.get('key');
 * 
 * ИСТОРИЯ:
 *   - 02.04.2026: Создание сервиса
 * ============================================
 */

class CacheService {
    constructor() {
        this.memoryCache = new Map();
        this.debug = localStorage.getItem('CRM_DEBUG') === 'true';
    }

    /**
     * Получить данные из кэша
     * @param {string} key - Ключ кэша
     * @param {string} storage - 'memory', 'session', 'local'
     * @returns {any|null}
     */
    get(key, storage = 'memory') {
        let data = null;
        
        switch(storage) {
            case 'memory':
                data = this.memoryCache.get(key);
                break;
            case 'session':
                const sessionData = sessionStorage.getItem(`cache_${key}`);
                if (sessionData) {
                    try {
                        data = JSON.parse(sessionData);
                    } catch (e) {
                        console.warn(`[Cache] Ошибка парсинга ${key}:`, e);
                        return null;
                    }
                }
                break;
            case 'local':
                const localData = localStorage.getItem(`cache_${key}`);
                if (localData) {
                    try {
                        data = JSON.parse(localData);
                    } catch (e) {
                        console.warn(`[Cache] Ошибка парсинга ${key}:`, e);
                        return null;
                    }
                }
                break;
            default:
                return null;
        }
        
        if (!data) return null;
        
        // Проверяем TTL
        if (data.expiresAt && Date.now() > data.expiresAt) {
            this.invalidate(key, storage);
            if (this.debug) console.log(`[Cache] EXPIRED: ${key} (${storage})`);
            return null;
        }
        
        if (this.debug) console.log(`[Cache] HIT: ${key} (${storage})`);
        return data.value;
    }

    /**
     * Сохранить данные в кэш
     * @param {string} key - Ключ кэша
     * @param {any} value - Данные
     * @param {Object} options - { ttl, storage }
     */
    set(key, value, options = {}) {
        const { ttl = 300, storage = 'memory' } = options;
        const cacheData = {
            value,
            expiresAt: Date.now() + (ttl * 1000),
            createdAt: Date.now()
        };
        
        switch(storage) {
            case 'memory':
                this.memoryCache.set(key, cacheData);
                break;
            case 'session':
                sessionStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
                break;
            case 'local':
                localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
                break;
            default:
                return false;
        }
        
        if (this.debug) console.log(`[Cache] SET: ${key} (${storage}, TTL: ${ttl}s)`);
        return true;
    }

    /**
     * Инвалидировать кэш по ключу
     * @param {string} key - Ключ кэша
     * @param {string} storage - 'memory', 'session', 'local', 'all'
     */
    invalidate(key, storage = 'all') {
        if (storage === 'all' || storage === 'memory') {
            this.memoryCache.delete(key);
        }
        if (storage === 'all' || storage === 'session') {
            sessionStorage.removeItem(`cache_${key}`);
        }
        if (storage === 'all' || storage === 'local') {
            localStorage.removeItem(`cache_${key}`);
        }
        
        if (this.debug) console.log(`[Cache] INVALIDATED: ${key} (${storage})`);
    }

    /**
     * Очистить весь кэш в указанном хранилище
     * @param {string} storage - 'memory', 'session', 'local', 'all'
     */
    clear(storage = 'all') {
        if (storage === 'all' || storage === 'memory') {
            this.memoryCache.clear();
        }
        
        if (storage === 'all' || storage === 'session') {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith('cache_')) {
                    sessionStorage.removeItem(key);
                }
            }
        }
        
        if (storage === 'all' || storage === 'local') {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache_')) {
                    localStorage.removeItem(key);
                }
            }
        }
        
        if (this.debug) console.log(`[Cache] CLEARED: ${storage}`);
    }

    /**
     * Проверить наличие ключа в кэше (без получения значения)
     * @param {string} key 
     * @param {string} storage 
     * @returns {boolean}
     */
    has(key, storage = 'memory') {
        const value = this.get(key, storage);
        return value !== null;
    }
}

// Создаем и экспортируем единственный экземпляр
const cacheService = new CacheService();
export default cacheService;