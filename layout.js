/**
 * ============================================
 * ФАЙЛ: layout.js
 * РОЛЬ: Управление боковой навигационной панелью с группировкой модулей
 * 
 * ОСОБЕННОСТИ:
 *   - Автоматическая группировка модулей из реестра
 *   - Категории: Основные, Бизнес, Личное, Инструменты, Управление
 *   - Сохранение состояния сворачивания
 *   - Адаптивное мобильное меню
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/permissions.js (для проверки прав)
 *   - js/utils/helpers.js (escapeHtml)
 *   - js/services/pomodoro.js (виджет помодоро)
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Полная переработка, добавлена группировка модулей
 *   - 02.04.2026: Исправлена проверка прав для админ-модуля
 *   - 06.04.2026: Добавлена поддержка GitHub Pages через определение базового пути
 *   - 08.04.2026: Добавлен модуль Финансы в категорию Личное
 *   - 08.04.2026: Исправлены пути для GitHub Pages (относительные)
 *   - 08.04.2026: Добавлена обработка кликов в свернутом меню
 * ============================================
 */

import { escapeHtml } from './js/utils/helpers.js';
import { getState, start, pause, subscribe } from './js/services/pomodoro.js';
import { hasPermission } from './js/core/permissions.js';

let sidebarCollapsed = false;
let isInitialized = false;

// ========== ОПРЕДЕЛЕНИЕ БАЗОВОГО ПУТИ ДЛЯ GITHUB PAGES ==========
function getBasePath() {
    const fullPath = window.location.pathname;
    
    const match = fullPath.match(/^(\/crm-for-team)/);
    if (match) {
        return match[1];
    }
    
    if (window.location.hostname.includes('github.io')) {
        const parts = fullPath.split('/');
        if (parts.length > 1 && parts[1] && parts[1] !== 'app') {
            return `/${parts[1]}`;
        }
    }
    
    return '';
}

const BASE_PATH = getBasePath();

function getPageUrl(page) {
    if (BASE_PATH) {
        return `${BASE_PATH}/app/${page}`;
    }
    return `app/${page}`;
}

// ========== КАТЕГОРИИ МОДУЛЕЙ ==========
const MODULE_CATEGORIES = {
    essentials: {
        id: 'essentials',
        name: 'Основные',
        icon: 'fa-star',
        order: 0,
        modules: ['navigator', 'dashboard']
    },
    business: {
        id: 'business',
        name: 'Бизнес',
        icon: 'fa-briefcase',
        order: 1,
        modules: ['deals', 'complexes', 'counterparties', 'analytics', 'reports', 'invoices']
    },
    personal: {
        id: 'personal',
        name: 'Личное',
        icon: 'fa-user',
        order: 2,
        modules: ['tasks', 'calendar', 'notes', 'habits', 'pomodoro', 'finance']
    },
    tools: {
        id: 'tools',
        name: 'Инструменты',
        icon: 'fa-tools',
        order: 3,
        modules: ['team', 'marketplace', 'my-modules', 'chat', 'documents']
    },
    admin: {
        id: 'admin',
        name: 'Управление',
        icon: 'fa-cog',
        order: 4,
        modules: ['profile', 'notifications', 'admin'],
        adminOnly: true
    }
};

// ========== ОПИСАНИЯ МОДУЛЕЙ ==========
const MODULE_INFO = {
    navigator: { name: 'Навигатор', icon: 'fa-th-large', page: 'navigator.html', description: 'Обзор всех модулей' },
    dashboard: { name: 'Дашборд', icon: 'fa-home', page: 'dashboard.html', description: 'Главная панель управления' },
    deals: { name: 'Сделки', icon: 'fa-handshake', page: 'deals.html', description: 'Управление сделками' },
    complexes: { name: 'Объекты', icon: 'fa-building', page: 'complexes.html', description: 'Управление объектами' },
    counterparties: { name: 'Контрагенты', icon: 'fa-users', page: 'counterparties.html', description: 'База контрагентов' },
    analytics: { name: 'Аналитика', icon: 'fa-chart-line', page: 'analytics.html', description: 'Расширенная аналитика' },
    reports: { name: 'Отчеты', icon: 'fa-file-alt', page: 'reports.html', description: 'Формирование отчетов' },
    invoices: { name: 'Счета', icon: 'fa-file-invoice', page: 'invoices.html', description: 'Управление счетами' },
    tasks: { name: 'Задачи', icon: 'fa-tasks', page: 'tasks.html', description: 'Управление задачами' },
    calendar: { name: 'Календарь', icon: 'fa-calendar-alt', page: 'calendar.html', description: 'Планирование событий' },
    notes: { name: 'Заметки', icon: 'fa-sticky-note', page: 'notes.html', description: 'Быстрые заметки' },
    habits: { name: 'Привычки', icon: 'fa-calendar-check', page: 'habits.html', description: 'Отслеживание привычек' },
    pomodoro: { name: 'Помодоро', icon: 'fa-clock', page: 'pomodoro.html', description: 'Таймер продуктивности' },
    finance: { name: 'Финансы', icon: 'fa-money-bill-wave', page: 'finance.html', description: 'Учет доходов и расходов' },
    team: { name: 'Команда', icon: 'fa-user-friends', page: 'team.html', description: 'Управление командой' },
    marketplace: { name: 'Маркетплейс', icon: 'fa-store', page: 'marketplace.html', description: 'Магазин модулей' },
    'my-modules': { name: 'Мои модули', icon: 'fa-puzzle-piece', page: 'my-modules.html', description: 'Установленные модули' },
    chat: { name: 'Чат', icon: 'fa-comments', page: 'chat.html', description: 'Внутренний чат' },
    documents: { name: 'Документы', icon: 'fa-file-pdf', page: 'documents.html', description: 'Электронный документооборот' },
    profile: { name: 'Профиль', icon: 'fa-user', page: 'profile.html', description: 'Настройки профиля' },
    notifications: { name: 'Уведомления', icon: 'fa-bell', page: 'notifications.html', description: 'Центр уведомлений' },
    admin: { name: 'Администрирование', icon: 'fa-shield-alt', page: 'admin.html', description: 'Управление системой' }
};

function getModuleHref(module) {
    return getPageUrl(module.page);
}

function getFullPath(page) {
    return getPageUrl(page);
}

function getCurrentUser() {
    return window.currentSupabaseUser || null;
}

function isModuleAvailable(moduleId) {
    const user = getCurrentUser();
    if (!user) return false;
    
    if (user.role === 'admin') return true;
    
    const MODULE_PERMISSIONS = {
        'dashboard': 'view_dashboard',
        'tasks': 'view_tasks',
        'calendar': 'view_calendar',
        'notes': 'view_notes',
        'profile': 'view_profile',
        'deals': 'view_own_deals',
        'complexes': 'view_complexes',
        'counterparties': 'view_counterparties',
        'team': 'view_team',
        'admin': 'manage_users',
        'analytics': 'view_statistics',
        'reports': 'view_statistics',
        'invoices': 'view_statistics'
    };
    
    const requiredPermission = MODULE_PERMISSIONS[moduleId];
    
    if (!requiredPermission) return true;
    
    return hasPermission(requiredPermission, user);
}

function renderSidebarMenu() {
    const container = document.getElementById('sidebar-nav');
    if (!container) {
        console.error('[layout] Контейнер sidebar-nav не найден');
        return;
    }
    
    const currentPath = window.location.pathname;
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';
    
    let html = '<div class="sidebar-menu">';
    
    for (const [catId, category] of Object.entries(MODULE_CATEGORIES)) {
        if (category.adminOnly && !isAdmin) continue;
        
        const availableModules = category.modules.filter(moduleId => {
            const moduleInfo = MODULE_INFO[moduleId];
            if (!moduleInfo) return false;
            return isModuleAvailable(moduleId);
        });
        
        if (availableModules.length === 0) continue;
        
        html += `
            <div class="sidebar-category" data-category="${catId}">
                <div class="sidebar-category-header">
                    <i class="fas ${category.icon}"></i>
                    <span class="category-name">${escapeHtml(category.name)}</span>
                    <i class="fas fa-chevron-down category-toggle"></i>
                </div>
                <div class="sidebar-category-items">
        `;
        
        for (const moduleId of availableModules) {
            const module = MODULE_INFO[moduleId];
            if (!module) continue;
            
            const href = getModuleHref(module);
            const isActive = currentPath.endsWith(module.page);
            
            html += `
                <a href="${href}" class="sidebar-menu-item ${isActive ? 'active' : ''}" 
                   data-module="${moduleId}" title="${escapeHtml(module.name)}">
                    <i class="fas ${module.icon}"></i>
                    <span class="menu-item-label">${escapeHtml(module.name)}</span>
                    ${isActive ? '<span class="active-indicator"></span>' : ''}
                </a>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    attachCategoryHandlers();
    
    console.log('[layout] Боковое меню отрисовано, BASE_PATH:', BASE_PATH);
}

function attachCategoryHandlers() {
    const categories = document.querySelectorAll('.sidebar-category');
    
    categories.forEach(category => {
        const header = category.querySelector('.sidebar-category-header');
        const items = category.querySelector('.sidebar-category-items');
        const toggle = category.querySelector('.category-toggle');
        
        const catId = category.dataset.category;
        const isCollapsed = localStorage.getItem(`sidebar_category_${catId}`) === 'true';
        
        if (isCollapsed && items) {
            items.classList.add('collapsed');
            if (toggle) toggle.classList.add('collapsed');
        }
    });
    
    // Отдельная настройка обработчиков через setupCollapsedIconHandlers
}

/**
 * Настройка обработчиков для свернутого меню
 */
function setupCollapsedIconHandlers() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    const categoryHeaders = sidebar.querySelectorAll('.sidebar-category-header');
    
    categoryHeaders.forEach(header => {
        // Удаляем старый обработчик
        header.removeEventListener('click', header._clickHandler);
        
        // Создаем новый обработчик
        const clickHandler = (e) => {
            e.stopPropagation();
            
            const sidebarEl = document.getElementById('sidebar');
            const isCollapsed = sidebarEl?.classList.contains('collapsed');
            const category = header.closest('.sidebar-category');
            
            if (!category) return;
            
            const items = category.querySelector('.sidebar-category-items');
            const toggle = category.querySelector('.category-toggle');
            const catId = category.dataset.category;
            
            if (isCollapsed) {
                // Меню свернуто - разворачиваем его
                toggleSidebar();
                
                // Проверяем, была ли категория свернута
                const wasCollapsed = items?.classList.contains('collapsed') || 
                                    localStorage.getItem(`sidebar_category_${catId}`) === 'true';
                
                if (wasCollapsed) {
                    setTimeout(() => {
                        if (items) {
                            items.classList.remove('collapsed');
                            if (toggle) toggle.classList.remove('collapsed');
                            localStorage.setItem(`sidebar_category_${catId}`, 'false');
                        }
                    }, 100);
                }
            } else {
                // Меню уже развернуто - просто переключаем категорию
                if (items) {
                    items.classList.toggle('collapsed');
                    if (toggle) toggle.classList.toggle('collapsed');
                    
                    const newState = items.classList.contains('collapsed');
                    localStorage.setItem(`sidebar_category_${catId}`, newState);
                }
            }
        };
        
        header._clickHandler = clickHandler;
        header.addEventListener('click', clickHandler);
    });
}

function updateFooterButtons() {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;
    
    const isCollapsed = sidebarCollapsed;
    sidebarFooter.innerHTML = '';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle-btn';
    toggleBtn.innerHTML = isCollapsed 
        ? '<i class="fas fa-chevron-right"></i><span>Развернуть</span>'
        : '<i class="fas fa-chevron-left"></i><span>Свернуть</span>';
    toggleBtn.onclick = () => toggleSidebar();
    sidebarFooter.appendChild(toggleBtn);
    
    const themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn';
    const currentTheme = localStorage.getItem('crm_theme') || 'dark';
    themeBtn.innerHTML = currentTheme === 'dark' 
        ? '<i class="fas fa-sun"></i><span>Светлая</span>' 
        : '<i class="fas fa-moon"></i><span>Тёмная</span>';
    themeBtn.onclick = () => toggleTheme();
    sidebarFooter.appendChild(themeBtn);
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Выйти</span>';
    logoutBtn.onclick = () => logout();
    sidebarFooter.appendChild(logoutBtn);
    
    if (isCollapsed) {
        [toggleBtn, themeBtn, logoutBtn].forEach(btn => btn.classList.add('collapsed-mode'));
    }
}

export async function initSidebar() {
    if (isInitialized) return;
    
    console.log('[layout] Инициализация бокового меню...');
    console.log('[layout] BASE_PATH:', BASE_PATH);
    
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
        sidebarCollapsed = true;
        document.getElementById('sidebar')?.classList.add('collapsed');
    } else {
        sidebarCollapsed = false;
        document.getElementById('sidebar')?.classList.remove('collapsed');
        localStorage.setItem('sidebar_collapsed', 'false');
    }
    
    renderSidebarMenu();
    setupCollapsedIconHandlers();
    
    window.addEventListener('userLoaded', () => {
        console.log('[layout] userLoaded событие, обновляем меню');
        renderSidebarMenu();
        setupCollapsedIconHandlers();
    });
    
    initMobileMenu();
    addNotificationButtonToTopBar();
    addPomodoroWidget();
    updateFooterButtons();
    
    isInitialized = true;
    console.log('[layout] Боковое меню инициализировано');
}

export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    sidebarCollapsed = !sidebarCollapsed;
    
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        localStorage.setItem('sidebar_collapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
        localStorage.setItem('sidebar_collapsed', 'false');
    }
    
    updateFooterButtons();
    
    setTimeout(() => setupCollapsedIconHandlers(), 100);
    
    window.dispatchEvent(new CustomEvent('sidebarToggled', { 
        detail: { collapsed: sidebarCollapsed } 
    }));
    
    console.log('[layout] Сайдбар', sidebarCollapsed ? 'свернут' : 'развернут');
}

function initMobileMenu() {
    const existingToggle = document.querySelector('.mobile-menu-toggle');
    if (existingToggle) existingToggle.remove();
    
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'mobile-menu-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.onclick = () => {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.toggle('mobile-open');
    };
    document.body.appendChild(toggleBtn);
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.querySelector('.mobile-menu-toggle');
        if (window.innerWidth <= 768 && sidebar?.classList.contains('mobile-open')) {
            if (!sidebar.contains(e.target) && !toggle?.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        }
    });
}

function addNotificationButtonToTopBar() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    if (topBar.querySelector('.notification-icon-wrapper')) return;
    
    const notificationWrapper = document.createElement('div');
    notificationWrapper.className = 'notification-icon-wrapper';
    notificationWrapper.style.position = 'relative';
    notificationWrapper.style.marginRight = '16px';
    notificationWrapper.style.cursor = 'pointer';
    notificationWrapper.onclick = () => {
        window.location.href = getFullPath('notifications.html');
    };
    
    notificationWrapper.innerHTML = `
        <i class="fas fa-bell" style="font-size: 1.2rem; color: var(--text-primary);"></i>
        <span id="notificationBadge" class="notification-badge" style="display: none;">0</span>
    `;
    
    const userProfile = topBar.querySelector('.user-profile');
    if (userProfile) {
        topBar.insertBefore(notificationWrapper, userProfile);
    } else {
        topBar.appendChild(notificationWrapper);
    }
}

async function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    try {
        if (window.supabase) {
            const { data: { user } } = await window.supabase.auth.getUser();
            if (user) {
                const { count } = await window.supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('read', false);
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'flex';
                    return;
                }
            }
        }
        badge.style.display = 'none';
    } catch (e) {
        badge.style.display = 'none';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('theme-dark');
    if (isDark) {
        document.documentElement.classList.remove('theme-dark');
        document.documentElement.classList.add('theme-light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        localStorage.setItem('crm_theme', 'light');
    } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('theme-dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        localStorage.setItem('crm_theme', 'dark');
    }
    updateFooterButtons();
}

export function goToProfile() {
    window.location.href = getFullPath('profile.html');
}

export function logout() {
    if (confirm('Вы уверены, что хотите выйти из системы?')) {
        if (window.supabaseSession?.logoutFromSupabase) {
            window.supabaseSession.logoutFromSupabase();
        } else {
            localStorage.removeItem('crm_session');
            window.location.href = BASE_PATH ? `${BASE_PATH}/auth-supabase.html` : 'auth-supabase.html';
        }
    }
}

function addPomodoroWidget() {
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        if (typeof getState === 'function' && typeof start === 'function') {
            clearInterval(checkInterval);
            createWidget();
        } else if (checkCount > 50) {
            clearInterval(checkInterval);
        }
        checkCount++;
    }, 100);
    
    function createWidget() {
        const widget = document.createElement('div');
        widget.id = 'pomodoroWidget';
        widget.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--card-bg);
            border-radius: 16px;
            padding: 12px 16px;
            border: 1px solid var(--card-border);
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: all 0.2s;
        `;
        widget.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-clock" style="color: var(--accent);"></i>
                <span id="pomodoroTime" style="font-family: monospace; font-weight: 600;">25:00</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button id="pomodoroPlayBtn" class="pomodoro-widget-btn" style="background: none; border: none; cursor: pointer; color: var(--accent); padding: 4px 8px; border-radius: 8px;">▶</button>
                <button id="pomodoroPauseBtn" class="pomodoro-widget-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 8px;">⏸</button>
            </div>
        `;
        document.body.appendChild(widget);
        
        function updateWidgetTime() {
            const state = getState();
            if (state) {
                const minutes = Math.floor(state.timeLeft / 60);
                const seconds = state.timeLeft % 60;
                const timeSpan = document.getElementById('pomodoroTime');
                if (timeSpan) {
                    timeSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                
                const playBtn = document.getElementById('pomodoroPlayBtn');
                const pauseBtn = document.getElementById('pomodoroPauseBtn');
                if (playBtn && pauseBtn) {
                    if (state.status === 'running') {
                        playBtn.style.color = 'var(--text-muted)';
                        pauseBtn.style.color = 'var(--accent)';
                    } else {
                        playBtn.style.color = 'var(--accent)';
                        pauseBtn.style.color = 'var(--text-muted)';
                    }
                }
            }
        }
        
        subscribe(updateWidgetTime);
        setInterval(updateWidgetTime, 1000);
        
        widget.addEventListener('click', (e) => {
            if (!e.target.closest('.pomodoro-widget-btn')) {
                window.location.href = getFullPath('pomodoro.html');
            }
        });
        
        const playBtn = document.getElementById('pomodoroPlayBtn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const state = getState();
                if (state.status !== 'running') {
                    start();
                }
            });
        }
        
        const pauseBtn = document.getElementById('pomodoroPauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                pause();
            });
        }
        
        updateWidgetTime();
    }
}

const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    .notification-icon-wrapper {
        position: relative;
        cursor: pointer;
        transition: transform 0.2s ease;
    }
    .notification-icon-wrapper:hover {
        transform: scale(1.1);
    }
    .notification-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ff6b6b;
        color: white;
        font-size: 0.65rem;
        font-weight: bold;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        animation: badgePulse 0.3s ease;
    }
    @keyframes badgePulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(notificationStyle);

export { updateNotificationBadge, getFullPath, BASE_PATH };

console.log('[layout] Модуль загружен, BASE_PATH:', BASE_PATH);
