/**
 * ============================================
 * ФАЙЛ: layout.js
 * РОЛЬ: Управление боковой навигационной панелью и шапкой
 * 
 * ОСОБЕННОСТИ:
 *   - Мини-сайдбар с иконками (единый для всего приложения)
 *   - Кнопки темы и выхода всегда внизу сайдбара
 *   - Виджет помодоро в правом нижнем углу
 *   - Адаптивное мобильное меню
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Исправлен мини-сайдбар, добавлены кнопки темы и выхода
 *   - 31.03.2026: Убраны дублирующиеся стили
 * ============================================
 */

import { escapeHtml } from './js/utils/helpers.js';
import { getState, start, pause, subscribe } from './js/services/pomodoro.js';

let sidebarCollapsed = false;
let isInitialized = false;

// Конфигурация модулей для мини-сайдбара
const SIDEBAR_MODULES = [
    { id: 'navigator', name: 'Навигатор', icon: 'fa-th-large', href: '/app/navigator.html' },
    { id: 'dashboard', name: 'Дашборд', icon: 'fa-home', href: '/app/dashboard.html' },
    { id: 'tasks', name: 'Задачи', icon: 'fa-tasks', href: '/app/tasks.html' },
    { id: 'deals', name: 'Сделки', icon: 'fa-handshake', href: '/app/deals.html' },
    { id: 'calendar', name: 'Календарь', icon: 'fa-calendar-alt', href: '/app/calendar.html' },
    { id: 'notes', name: 'Заметки', icon: 'fa-sticky-note', href: '/app/notes.html' },
    { id: 'profile', name: 'Профиль', icon: 'fa-user', href: '/app/profile.html' }
];

/**
 * Получить роль текущего пользователя
 */
function getCurrentUserRole() {
    return window.currentSupabaseUser?.role || null;
}

/**
 * Получить права текущего пользователя
 */
function getUserPermissions() {
    if (window.CRM?.Permissions) {
        return window.CRM.Permissions.getUserPermissions();
    }
    return [];
}

/**
 * Проверить, доступен ли модуль для пользователя
 */
function isModuleAvailable(module) {
    const userRole = getCurrentUserRole();
    const userPermissions = getUserPermissions();
    const isAdmin = userRole === 'admin';
    
    if (isAdmin) return true;
    
    // Проверка по ролям
    if (module.roles && module.roles.length > 0) {
        if (!module.roles.includes(userRole)) return false;
    }
    
    // Проверка по правам
    if (module.permissions && module.permissions.length > 0) {
        const hasPermission = module.permissions.some(p => userPermissions.includes(p));
        if (!hasPermission) return false;
    }
    
    return true;
}

/**
 * Рендер мини-сайдбара (только иконки)
 */
function renderMiniSidebar() {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;
    
    const currentPath = window.location.pathname;
    
    let html = '<div class="mini-sidebar-nav">';
    
    for (const module of SIDEBAR_MODULES) {
        const isActive = module.href === currentPath;
        html += `
            <a href="${module.href}" class="mini-nav-item ${isActive ? 'active' : ''}" title="${escapeHtml(module.name)}">
                <i class="fas ${module.icon}"></i>
                <span class="mini-nav-label">${escapeHtml(module.name)}</span>
            </a>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
// console.log('[layout] Мини-сайдбар отрисован, иконок:', SIDEBAR_MODULES.length); // DEBUG removed
}

/**
 * Рендер навигации
 */
function renderNavigation() {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;
    
    renderMiniSidebar();
}

/**
 * Ожидание загрузки прав пользователя
 */
async function waitForPermissions(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (window.currentSupabaseUser) {
            const permissions = getUserPermissions();
            if (window.currentSupabaseUser.role === 'admin' || permissions.length > 0) {
// console.log('[layout] Права загружены:', permissions); // DEBUG removed
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 200));
    }
// console.warn('[layout] Таймаут ожидания прав'); // DEBUG removed
    return false;
}

/**
 * Инициализация бокового меню
 */
export async function initSidebar() {
    if (isInitialized) return;
    
    const saved = localStorage.getItem('sidebar_collapsed');
    // По умолчанию сайдбар развёрнут, если в localStorage нет значения или оно не 'true'
    if (saved === 'true') {
        sidebarCollapsed = true;
        document.getElementById('sidebar')?.classList.add('collapsed');
    } else {
        // Явно убираем класс collapsed при загрузке
        sidebarCollapsed = false;
        document.getElementById('sidebar')?.classList.remove('collapsed');
        localStorage.setItem('sidebar_collapsed', 'false');
    }
    
    const hasPermissions = await waitForPermissions();
    
    renderNavigation();
    
    // Auto-update top-bar on userLoaded event
    window.addEventListener('userLoaded', () => {
// console.log('[layout] userLoaded → updating UI'); // DEBUG removed
        if (typeof updateSupabaseUserInterface === 'function') {
            updateSupabaseUserInterface();
        }
        renderNavigation();
    });
    
    if (!hasPermissions) {
        window.addEventListener('permissionsReady', () => {
// console.log('[layout] permissionsReady событие, повторная отрисовка'); // DEBUG removed
            renderNavigation();
        });
        
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.currentSupabaseUser?.role === 'admin' || getUserPermissions().length > 0) {
// console.log('[layout] Интервал: права загружены, повторная отрисовка'); // DEBUG removed
                renderNavigation();
                clearInterval(checkInterval);
            } else if (attempts > 30) {
                clearInterval(checkInterval);
            }
        }, 500);
    }
    
    initMobileMenu();
    addSidebarButtons();
    addNotificationButtonToTopBar();
    addPomodoroWidget();
    
    // Add desktop expand button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'sidebar-expand-btn';
    expandBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    expandBtn.onclick = () => toggleSidebar();
    expandBtn.style.cssText = `
      position: fixed; left: 72px; top: 50%; transform: translateY(-50%);
      width: 32px; height: 32px; background: var(--accent); color: white;
      border: none; border-radius: 0 16px 16px 0; cursor: pointer; z-index: 1001;
      display: none; align-items: center; justify-content: center;
      box-shadow: 2px 0 8px rgba(0,0,0,0.2); transition: all 0.2s;
    `;
    document.body.appendChild(expandBtn);
    
    isInitialized = true;
// console.log('[layout] Мини-сайдбар инициализирован'); // DEBUG removed
}

/**
 * Свернуть/развернуть боковое меню
 */
export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    sidebarCollapsed = !sidebarCollapsed;
    
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        localStorage.setItem('sidebar_collapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        localStorage.setItem('sidebar_collapsed', 'false');
    }
}

/**
 * Инициализация мобильного меню
 */
function initMobileMenu() {
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'mobile-menu-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.onclick = () => {
        document.getElementById('sidebar')?.classList.toggle('mobile-open');
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

/**
 * Добавление кнопок в футер сайдбара (тема, выход)
 */
function addSidebarButtons() {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;
    
    // Очищаем футер, оставляя только collapse-btn
    const existingBtns = sidebarFooter.querySelectorAll('button');
    existingBtns.forEach(btn => btn.remove());
    
    // Кнопка сворачивания
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.innerHTML = '<i class="fas fa-chevron-left"></i><span>Свернуть</span>';
    collapseBtn.style.cssText = 'width: 100%; padding: 10px; margin-bottom: 8px; background: var(--hover-bg); border: none; border-radius: 12px; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
    collapseBtn.onclick = (e) => {
        e.stopPropagation();
        toggleSidebar();
    };
    sidebarFooter.appendChild(collapseBtn);
    
    // Кнопка темы
    const themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn';
    const currentTheme = localStorage.getItem('crm_theme') || 'dark';
    themeBtn.innerHTML = currentTheme === 'dark' 
        ? '<i class="fas fa-sun"></i><span>Светлая</span>' 
        : '<i class="fas fa-moon"></i><span>Тёмная</span>';
    themeBtn.style.cssText = 'width: 100%; padding: 10px; margin-bottom: 8px; background: var(--hover-bg); border: none; border-radius: 12px; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
    themeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleTheme();
    };
    sidebarFooter.appendChild(themeBtn);
    
    // Кнопка выхода
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Выйти</span>';
    logoutBtn.style.cssText = 'width: 100%; padding: 10px; background: rgba(255, 107, 107, 0.2); border: none; border-radius: 12px; color: #ff6b6b; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
    logoutBtn.onclick = (e) => {
        e.stopPropagation();
        logout();
    };
    sidebarFooter.appendChild(logoutBtn);
}

/**
 * Добавление кнопки уведомлений в топ-бар
 */
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
        window.location.href = '/app/notifications.html';
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

/**
 * Обновление счетчика непрочитанных уведомлений
 */
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

/**
 * Переключение темы (светлая/темная)
 */
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
    
    const themeBtn = document.querySelector('.theme-btn');
    if (themeBtn) {
        const isDarkNow = document.documentElement.classList.contains('theme-dark');
        themeBtn.innerHTML = isDarkNow 
            ? '<i class="fas fa-sun"></i><span>Светлая</span>' 
            : '<i class="fas fa-moon"></i><span>Тёмная</span>';
    }
}

/**
 * Переход на страницу профиля
 */
export function goToProfile() {
    window.location.href = '/app/profile.html';
}

/**
 * Выход из системы
 */
export function logout() {
    if (confirm('Вы уверены, что хотите выйти из системы?')) {
        if (window.supabaseSession?.logoutFromSupabase) {
            window.supabaseSession.logoutFromSupabase();
        } else {
            localStorage.removeItem('crm_session');
            window.location.href = 'auth-supabase.html';
        }
    }
}

/**
 * Виджет помодоро
 */
function addPomodoroWidget() {
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        if (typeof getState === 'function' && typeof start === 'function') {
            clearInterval(checkInterval);
            createWidget();
        } else if (checkCount > 50) {
            clearInterval(checkInterval);
// console.warn('[layout] Pomodoro сервис не загружен'); // DEBUG removed
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
                window.location.href = '/app/pomodoro.html';
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
// console.log('[layout] Виджет помодоро добавлен'); // DEBUG removed
    }
}

// Inline sidebar styles moved to components.css

// Стили для уведомлений
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

// Глобальный объект для доступа из HTML
window.sidebar = {
    initSidebar,
    toggleSidebar,
    goToProfile,
    logout,
    renderNavigation,
    updateNotificationBadge
};

console.log('[layout] Модуль загружен (мини-сайдбар)');