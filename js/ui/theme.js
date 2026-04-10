/**
 * ============================================
 * ФАЙЛ: js/ui/theme.js
 * РОЛЬ: Управление темой оформления (светлая/тёмная)
 * 
 * ОСОБЕННОСТИ:
 *   - Поддержка новой системы CSS-переменных из variables.css
 *   - Сохранение темы в localStorage
 *   - Определение системных настроек
 *   - Единая точка управления темой
 *   - ЧИСТЫЕ ES6 ЭКСПОРТЫ (БЕЗ ГЛОБАЛЬНЫХ ОБЪЕКТОВ)
 * 
 * ЗАВИСИМОСТИ:
 *   - CSS: variables.css, theme.css
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Обновлен под новую систему переменных
 *   - 31.03.2026: Добавлена поддержка системных настроек
 *   - 10.04.2026: УДАЛЁН ГЛОБАЛЬНЫЙ ОБЪЕКТ window.CRM.ui.theme и window.theme (правило №5)
 * ============================================
 */

// Конфигурация тем
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
export function initTheme() {
    const savedTheme = localStorage.getItem('crm_theme');
    
    if (savedTheme && THEMES[savedTheme]) {
        setTheme(savedTheme);
    } else {
        // Определяем системные настройки
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
    
    // Слушаем изменения системной темы
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Меняем тему только если пользователь не установил свою
        if (!localStorage.getItem('crm_theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
    
    console.log('[theme] Инициализирована тема:', currentTheme);
}

/**
 * Установка темы
 * @param {string} theme - название темы ('dark' или 'light')
 */
export function setTheme(theme) {
    if (!THEMES[theme]) {
        console.warn('[theme] Неизвестная тема:', theme);
        return;
    }
    
    currentTheme = theme;
    
    // Применяем класс к root элементу
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(THEMES[theme].class);
    
    // Для обратной совместимости добавляем класс и на body
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(THEMES[theme].class);
    
    // Сохраняем в localStorage
    localStorage.setItem('crm_theme', theme);
    
    // Обновляем текст кнопки в сайдбаре (если есть)
    updateThemeButton();
    
    // Диспатчим событие для других компонентов
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    
    console.log('[theme] Тема изменена на:', theme);
}

/**
 * Обновление кнопки переключения темы в сайдбаре
 */
function updateThemeButton() {
    const themeBtn = document.querySelector('.theme-btn');
    if (!themeBtn) return;
    
    const isDark = currentTheme === 'dark';
    const icon = isDark ? 'fa-sun' : 'fa-moon';
    const text = isDark ? 'Светлая тема' : 'Тёмная тема';
    
    themeBtn.innerHTML = `<i class="fas ${icon}"></i> <span>${text}</span>`;
}

/**
 * Переключение между темами
 */
export function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

/**
 * Получить текущую тему
 * @returns {string}
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * Проверить, активна ли темная тема
 * @returns {boolean}
 */
export function isDarkTheme() {
    return currentTheme === 'dark';
}

// Автоматическая инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

console.log('[js/ui/theme.js] Загружен. Доступны экспорты: initTheme, setTheme, toggleTheme, getCurrentTheme, isDarkTheme');
