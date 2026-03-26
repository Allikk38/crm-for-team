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
        bodyClass: 'theme-dark'
    },
    light: {
        name: 'Светлая',
        icon: 'fa-sun',
        bodyClass: 'theme-light'
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
        // По умолчанию тёмная (или определяем системные настройки)
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
    
    // Добавляем кнопку переключения в интерфейс
    addThemeToggle();
}

/**
 * Установка темы
 * @param {string} theme - название темы ('dark' или 'light')
 */
function setTheme(theme) {
    if (!THEMES[theme]) return;
    
    currentTheme = theme;
    
    // Удаляем старые классы и добавляем новый
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(THEMES[theme].bodyClass);
    localStorage.setItem('crm_theme', theme);
    
    // Обновляем иконку кнопки, если она уже есть
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fas ${THEMES[theme].icon}"></i>`;
        toggleBtn.title = `${THEMES[theme].name} тема`;
    }
}

/**
 * Переключение между темами
 */
function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

/**
 * Добавление кнопки переключения темы в интерфейс
 */
function addThemeToggle() {
    // Ищем контейнер для кнопки (рядом с user-info)
    const headerTop = document.querySelector('.header-top');
    if (headerTop && !document.getElementById('themeToggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'themeToggle';
        toggleBtn.className = 'theme-toggle';
        toggleBtn.innerHTML = `<i class="fas ${THEMES[currentTheme].icon}"></i>`;
        toggleBtn.title = `${THEMES[currentTheme].name} тема`;
        toggleBtn.onclick = toggleTheme;
        
        // Добавляем в header-top после user-info
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.after(toggleBtn);
        } else {
            headerTop.appendChild(toggleBtn);
        }
    }
}

// ============================================
// ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ (обратная совместимость)
// ============================================

// Основной глобальный объект CRM
window.CRM = window.CRM || {};
window.CRM.ui = window.CRM.ui || {};

// Экспортируем функции в CRM.ui
window.CRM.ui.theme = {
    initTheme,
    setTheme,
    toggleTheme
};

// Для обратной совместимости со старым кодом
window.theme = {
    initTheme,
    setTheme,
    toggleTheme
};

// Экспортируем константы для возможного использования
window.CRM.constants = window.CRM.constants || {};
window.CRM.constants.THEMES = THEMES;

// Логируем загрузку модуля
console.log('[js/ui/theme.js] Загружен. Доступно: window.theme, window.CRM.ui.theme');
