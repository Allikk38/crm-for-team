/**
 * ============================================
 * ФАЙЛ: loader.js
 * РОЛЬ: Централизованная загрузка модулей
 * СТАТУС: НОВЫЙ МОДУЛЬ
 * ВЕРСИЯ: 1.0
 * ============================================
 */

// Список модулей для загрузки (порядок важен)
const MODULES_TO_LOAD = [
    'js/utils/constants.js',
    'js/utils/helpers.js'
    // Постепенно добавляем новые модули
];

// Флаг для отслеживания использования новой системы
window.USE_NEW_MODULE_SYSTEM = true;

// Функция загрузки одного модуля
function loadModule(modulePath) {
    return new Promise((resolve, reject) => {
        // Проверяем, не загружен ли уже модуль
        const existingScript = document.querySelector(`script[src="${modulePath}"]`);
        if (existingScript) {
            console.log(`[loader.js] Модуль уже загружен: ${modulePath}`);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = modulePath;
        script.onload = () => {
            console.log(`[loader.js] Загружен: ${modulePath}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`[loader.js] Ошибка загрузки: ${modulePath}`);
            reject(new Error(`Failed to load ${modulePath}`));
        };
        document.head.appendChild(script);
    });
}

// Функция загрузки всех модулей
async function loadAllModules() {
    console.log('[loader.js] Начало загрузки модулей...');
    
    for (const modulePath of MODULES_TO_LOAD) {
        try {
            await loadModule(modulePath);
        } catch (error) {
            console.error(`[loader.js] Критическая ошибка при загрузке ${modulePath}:`, error);
            // Продолжаем загрузку остальных модулей
        }
    }
    
    console.log('[loader.js] Все модули загружены');
}

// Инициализация приложения
async function initApp() {
    console.log('[loader.js] Инициализация приложения...');
    
    await loadAllModules();
    
    // Проверяем, какие модули доступны
    if (window.CRM) {
        console.log('[loader.js] CRM объект доступен');
        if (window.CRM.constants) console.log('[loader.js] - constants.js загружен');
        if (window.CRM.helpers) console.log('[loader.js] - helpers.js загружен');
    }
    
    // Здесь позже будет инициализация существующих модулей
    // Пока оставляем существующую систему работать как есть
    
    console.log('[loader.js] Инициализация завершена');
}

// Запускаем после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
