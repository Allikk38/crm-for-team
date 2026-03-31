/**
 * ============================================
 * ФАЙЛ: js/core/navigator.js
 * РОЛЬ: Главная страница-навигатор - отображение всех модулей
 * 
 * ОСОБЕННОСТИ:
 *   - Автоматическое построение сетки модулей из реестра
 *   - Поддержка пользовательских настроек (порядок, видимость)
 *   - Группировка модулей по категориям
 *   - Сохранение состояния в localStorage
 *   - Интеграция с системой прав
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Переименован из navigation.js в navigator.js
 * ============================================
 */

console.log('[navigator] Загрузка системы навигации...');

// ========== КАТЕГОРИИ ПО УМОЛЧАНИЮ ==========

const DEFAULT_CATEGORIES = {
    essentials: {
        id: 'essentials',
        name: 'Основные',
        icon: 'fa-star',
        order: 0,
        system: true,
        adminOnly: false
    },
    business: {
        id: 'business',
        name: 'Бизнес',
        icon: 'fa-briefcase',
        order: 1,
        system: true,
        adminOnly: false
    },
    personal: {
        id: 'personal',
        name: 'Личное',
        icon: 'fa-user',
        order: 2,
        system: true,
        adminOnly: false
    },
    tools: {
        id: 'tools',
        name: 'Инструменты',
        icon: 'fa-tools',
        order: 3,
        system: true,
        adminOnly: false
    },
    admin: {
        id: 'admin',
        name: 'Управление',
        icon: 'fa-cog',
        order: 4,
        system: true,
        adminOnly: true
    },
    other: {
        id: 'other',
        name: 'Другое',
        icon: 'fa-ellipsis-h',
        order: 5,
        system: true,
        adminOnly: false
    }
};

// ========== ХРАНИЛИЩЕ ==========

let userCategories = null;
let userNavigationOrder = null;
let hiddenModules = null;

const STORAGE_KEYS = {
    CATEGORIES: 'crm_nav_categories',
    ORDER: 'crm_nav_order',
    HIDDEN: 'crm_nav_hidden',
    MODE: 'crm_nav_mode'
};

// ========== ЗАГРУЗКА НАСТРОЕК ==========

function loadUserPreferences() {
    try {
        const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
        if (savedCategories) userCategories = JSON.parse(savedCategories);
        
        const savedOrder = localStorage.getItem(STORAGE_KEYS.ORDER);
        if (savedOrder) userNavigationOrder = JSON.parse(savedOrder);
        
        const savedHidden = localStorage.getItem(STORAGE_KEYS.HIDDEN);
        if (savedHidden) {
            hiddenModules = new Set(JSON.parse(savedHidden));
        } else {
            hiddenModules = new Set();
        }
    } catch (e) {
        console.warn('[navigator] Ошибка загрузки настроек:', e);
        userCategories = null;
        userNavigationOrder = null;
        hiddenModules = new Set();
    }
}

function saveUserPreferences() {
    try {
        if (userCategories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(userCategories));
        if (userNavigationOrder) localStorage.setItem(STORAGE_KEYS.ORDER, JSON.stringify(userNavigationOrder));
        if (hiddenModules && hiddenModules.size > 0) {
            localStorage.setItem(STORAGE_KEYS.HIDDEN, JSON.stringify(Array.from(hiddenModules)));
        } else {
            localStorage.removeItem(STORAGE_KEYS.HIDDEN);
        }
    } catch (e) {
        console.warn('[navigator] Ошибка сохранения настроек:', e);
    }
}

// ========== ПОЛУЧЕНИЕ МОДУЛЕЙ ИЗ REGISTRY ==========

function getModulesFromRegistry() {
    if (!window.CRM?.Registry) {
        console.warn('[navigator] Registry не загружен');
        return [];
    }
    
    const allModules = window.CRM.Registry.getAllModules();
    const availableModules = [];
    
    for (const module of allModules) {
        const isAvailable = window.CRM.Registry.isModuleAvailable(module.id);
        if (!isAvailable) continue;
        
        const fullModule = window.CRM.Registry.getModule(module.id);
        if (!fullModule) continue;
        
        const categoryId = fullModule.category || 'other';
        const isHidden = hiddenModules?.has(module.id) || false;
        
        availableModules.push({
            id: module.id,
            name: fullModule.name,
            icon: fullModule.icon || 'fa-puzzle-piece',
            href: fullModule.mainPage || `/app/${module.id}.html`,
            category: categoryId,
            order: fullModule.order || 100,
            permissions: fullModule.requiredPermissions || [],
            roles: fullModule.requiredRoles || null,
            isHidden: isHidden,
            metrics: null
        });
    }
    
    return availableModules;
}

function getAllCategories() {
    const categories = { ...DEFAULT_CATEGORIES };
    if (userCategories) {
        for (const [id, cat] of Object.entries(userCategories)) {
            if (!categories[id]) categories[id] = cat;
        }
    }
    return categories;
}

function groupModulesByCategory(modules) {
    const categories = getAllCategories();
    const grouped = {};
    
    for (const [id, cat] of Object.entries(categories)) {
        grouped[id] = { ...cat, items: [] };
    }
    
    for (const module of modules) {
        const categoryId = module.category;
        if (grouped[categoryId]) {
            grouped[categoryId].items.push(module);
        } else {
            grouped.other.items.push(module);
        }
    }
    
    for (const groupId in grouped) {
        grouped[groupId].items.sort((a, b) => {
            if (userNavigationOrder && userNavigationOrder[a.id] !== undefined && userNavigationOrder[b.id] !== undefined) {
                return userNavigationOrder[a.id] - userNavigationOrder[b.id];
            }
            return (a.order || 100) - (b.order || 100);
        });
    }
    
    return Object.values(grouped).sort((a, b) => (a.order || 100) - (b.order || 100));
}

// ========== ESCAPE HTML ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== РЕНДЕР СТРАНИЦЫ НАВИГАТОРА ==========

let currentRenderMode = localStorage.getItem(STORAGE_KEYS.MODE) || 'grid';

export function renderNavigatorPage(containerId = 'navigatorContent') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[navigator] Контейнер не найден:', containerId);
        return;
    }
    
    const modules = getModulesFromRegistry();
    const groupedModules = groupModulesByCategory(modules.filter(m => !m.isHidden));
    const currentPath = window.location.pathname;
    
    let html = '';
    
    if (currentRenderMode === 'grid') {
        html = renderGridView(groupedModules, currentPath);
    } else {
        html = renderListView(groupedModules, currentPath);
    }
    
    container.innerHTML = html;
    
    // Добавляем обработчики кликов
    attachCardHandlers();
    
    console.log('[navigator] Страница отрисована, режим:', currentRenderMode, 'модулей:', modules.length);
}

function renderListView(groups, currentPath) {
    let html = '';
    
    for (const group of groups) {
        if (group.items.length === 0) continue;
        
        html += `
            <div class="nav-category">
                <div class="nav-category-header">
                    <i class="fas ${group.icon}"></i>
                    <h2>${escapeHtml(group.name)}</h2>
                    <span class="nav-category-count">${group.items.length}</span>
                </div>
                <div class="nav-category-items">
                    ${group.items.map(item => renderListItem(item, currentPath)).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function renderGridView(groups, currentPath) {
    let html = '';
    
    for (const group of groups) {
        if (group.items.length === 0) continue;
        
        html += `
            <div class="nav-category">
                <div class="nav-category-header">
                    <i class="fas ${group.icon}"></i>
                    <h2>${escapeHtml(group.name)}</h2>
                    <span class="nav-category-count">${group.items.length}</span>
                </div>
                <div class="nav-grid">
                    ${group.items.map(item => renderGridCard(item, currentPath)).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function renderListItem(item, currentPath) {
    const isActive = item.href === currentPath;
    
    return `
        <a href="${item.href}" class="nav-list-item ${isActive ? 'active' : ''}" data-module-id="${item.id}">
            <i class="fas ${item.icon}"></i>
            <span>${escapeHtml(item.name)}</span>
            <i class="fas fa-chevron-right"></i>
        </a>
    `;
}

function renderGridCard(item, currentPath) {
    const isActive = item.href === currentPath;
    
    return `
        <div class="nav-card" data-module-id="${item.id}" data-href="${item.href}">
            <div class="nav-card-icon">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="nav-card-title">${escapeHtml(item.name)}</div>
            <div class="nav-card-desc">${escapeHtml(getModuleDescription(item.id))}</div>
            <button class="nav-card-btn">Открыть</button>
        </div>
    `;
}

function getModuleDescription(moduleId) {
    const descriptions = {
        'dashboard': 'Главная панель управления',
        'tasks': 'Управление задачами',
        'deals': 'Сделки и заявки',
        'calendar': 'Календарь событий',
        'notes': 'Быстрые заметки',
        'habits': 'Отслеживание привычек',
        'pomodoro': 'Таймер продуктивности',
        'complexes': 'Управление объектами',
        'counterparties': 'База контрагентов',
        'team': 'Управление командой',
        'profile': 'Настройки профиля',
        'notifications': 'Уведомления',
        'marketplace': 'Магазин модулей',
        'my-modules': 'Установленные модули',
        'admin': 'Администрирование'
    };
    return descriptions[moduleId] || 'Модуль системы';
}

function attachCardHandlers() {
    document.querySelectorAll('.nav-card').forEach(card => {
        const href = card.dataset.href;
        if (href) {
            card.addEventListener('click', () => {
                window.location.href = href;
            });
        }
    });
}

// ========== УПРАВЛЕНИЕ НАСТРОЙКАМИ ==========

export function setModuleVisibility(moduleId, isVisible) {
    if (isVisible) {
        hiddenModules?.delete(moduleId);
    } else {
        hiddenModules?.add(moduleId);
    }
    saveUserPreferences();
    renderNavigatorPage();
}

export function setModuleOrder(moduleId, order) {
    if (!userNavigationOrder) userNavigationOrder = {};
    userNavigationOrder[moduleId] = order;
    saveUserPreferences();
    renderNavigatorPage();
}

export function setRenderMode(mode) {
    currentRenderMode = mode;
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
    renderNavigatorPage();
}

export function getRenderMode() {
    return currentRenderMode;
}

export function getModules() {
    return getModulesFromRegistry();
}

export function getCategories() {
    return getAllCategories();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export function initNavigator() {
    console.log('[navigator] Инициализация...');
    loadUserPreferences();
    renderNavigatorPage();
}

// Глобальный экспорт
if (typeof window !== 'undefined') {
    window.CRM = window.CRM || {};
    window.CRM.Navigator = {
        init: initNavigator,
        render: renderNavigatorPage,
        setModuleVisibility,
        setModuleOrder,
        setRenderMode,
        getRenderMode,
        getModules,
        getCategories
    };
}

console.log('[navigator] Система навигации загружена');