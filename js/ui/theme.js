/**
 * ============================================
 * ФАЙЛ: js/ui/theme.js
 * РОЛЬ: Управление темой оформления (светлая/тёмная)
 * ЗАВИСИМОСТИ:
 *   - Нет внешних зависимостей
 * ИСПОЛЬЗУЕТСЯ В:
 *   - Все страницы CRM
 * ============================================
 */

// Константы тем
const THEMES = {
    dark: {
        name: 'Тёмная',
        icon: 'fa-moon',
        class: 'theme-dark'
    },
    light: {
        name: 'Светлая',
        icon: 'fa-sun',
        class: 'theme-light'
    }
};

let currentTheme = 'dark';

/**
 * Инициализация темы
 * Загружает сохранённую тему или определяет системные настройки
 */
function initTheme() {
    const savedTheme = localStorage.getItem('crm_theme');
    if (savedTheme && THEMES[savedTheme]) {
        setTheme(savedTheme);
    } else {
        // Определяем системные настройки
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
    
    console.log('[theme] Инициализирована тема:', currentTheme);
}

/**
 * Установка темы
 * @param {string} theme - название темы ('dark' или 'light')
 */
function setTheme(theme) {
    if (!THEMES[theme]) return;
    
    currentTheme = theme;
    
    // Применяем классы к html и body для полной совместимости
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(THEMES[theme].class);
    
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(THEMES[theme].class);
    
    // Сохраняем в localStorage
    localStorage.setItem('crm_theme', theme);
    
    // Обновляем текст кнопки в сайдбаре (если есть)
    const themeBtn = document.querySelector('.theme-btn');
    if (themeBtn) {
        const isDark = theme === 'dark';
        themeBtn.innerHTML = isDark 
            ? '<i class="fas fa-sun"></i> <span>Светлая тема</span>' 
            : '<i class="fas fa-moon"></i> <span>Тёмная тема</span>';
    }
    
    console.log('[theme] Тема изменена на:', theme);
}

/**
 * Переключение между темами
 */
function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

/**
 * Получить текущую тему
 * @returns {string}
 */
function getCurrentTheme() {
    return currentTheme;
}

// ============================================
// ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================

// Основной глобальный объект CRM
window.CRM = window.CRM || {};
window.CRM.ui = window.CRM.ui || {};

// Экспортируем функции в CRM.ui
window.CRM.ui.theme = {
    initTheme,
    setTheme,
    toggleTheme,
    getCurrentTheme
};

// Для обратной совместимости со старым кодом
window.theme = {
    initTheme,
    setTheme,
    toggleTheme,
    getCurrentTheme
};

console.log('[js/ui/theme.js] Загружен. Доступно: window.theme, window.CRM.ui.theme');