/**
 * ============================================
 * ФАЙЛ: js/utils/pathManager.js
 * РОЛЬ: ЕДИНСТВЕННЫЙ источник правды для путей в приложении
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: УДАЛЁН ГЛОБАЛЬНЫЙ ОБЪЕКТ window.CRM.PathManager (правило №5)
 * ============================================
 */

// Определяем БАЗОВЫЙ ПУТЬ один раз при загрузке скрипта
const BASE_PATH = (() => {
    const path = window.location.pathname;
    
    // Проверяем GitHub Pages /crm-for-team/...
    const ghPagesMatch = path.match(/^(\/crm-for-team)/);
    if (ghPagesMatch) {
        console.log('[pathManager] Режим GitHub Pages, BASE_PATH =', ghPagesMatch[1]);
        return ghPagesMatch[1];
    }
    
    // Проверяем другие GitHub Pages репозитории
    if (window.location.hostname.includes('github.io')) {
        const parts = path.split('/').filter(p => p);
        if (parts.length > 0) {
            const base = '/' + parts[0];
            console.log('[pathManager] Режим GitHub Pages (универсальный), BASE_PATH =', base);
            return base;
        }
    }
    
    // Локальный режим
    console.log('[pathManager] Режим локальной разработки, BASE_PATH = ""');
    return '';
})();

console.log('[pathManager] Инициализирован, BASE_PATH =', BASE_PATH);

/**
 * Получить полный URL для страницы
 * @param {string} page - Имя файла (например, 'tasks.html', 'deals.html')
 * @returns {string} Готовый URL
 */
export function getPageUrl(page) {
    // Определяем, где мы сейчас находимся
    const currentPath = window.location.pathname;
    
    // Если мы уже в папке app, используем относительный путь
    if (currentPath.includes('/app/')) {
        return `./${page}`;
    }
    
    // Для всех остальных случаев (корень, GitHub Pages) формируем с учётом BASE_PATH
    if (BASE_PATH) {
        return `${BASE_PATH}/app/${page}`;
    }
    
    // Локально, но не в app
    return `app/${page}`;
}

/**
 * Получить URL для детальной страницы сделки
 */
export function getDealDetailUrl(dealId) {
    return getPageUrl(`deal-detail.html?id=${dealId}`);
}

/**
 * Получить URL для задачи с параметром
 */
export function getTaskUrl(taskId) {
    return getPageUrl(`tasks.html?task=${taskId}`);
}

// Экспортируем константу
export { BASE_PATH };
