/**
 * ============================================
 * ФАЙЛ: layout.js
 * РОЛЬ: Управление боковой навигационной панелью и шапкой
 * 
 * ОСОБЕННОСТИ:
 *   - Динамическая навигация на основе ролей и прав
 *   - Администратор видит все пункты меню
 *   - Ожидание загрузки прав перед отрисовкой с увеличенным таймаутом
 *   - Повторная отрисовка при событиях userLoaded и permissionsReady
 *   - Адаптивное мобильное меню
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Переход на модульную загрузку
 *   - 30.03.2026: Ожидание загрузки прав перед отрисовкой
 *   - 30.03.2026: Администратор видит все пункты меню
 *   - 30.03.2026: Увеличен таймаут и добавлены события для повторной отрисовки
 * ============================================
 */

import { escapeHtml } from './js/utils/helpers.js';

let sidebarCollapsed = false;
let isInitialized = false;

/**
 * Конфигурация навигации
 * - href: путь к странице
 * - icon: иконка FontAwesome
 * - label: название пункта
 * - roles: массив ролей, которым доступен пункт (null = все)
 * - permissions: массив прав, необходимых для доступа
 */
const NAVIGATION_ITEMS = [
    { href: "index-supabase.html", icon: "fa-home", label: "Дашборд", roles: null, permissions: null },
    { href: "tasks-supabase.html", icon: "fa-tasks", label: "Доска задач", roles: null, permissions: ['view_tasks'] },
    { href: "complexes-supabase.html", icon: "fa-building", label: "Объекты", roles: null, permissions: ['view_complexes'] },
    { href: "deals-supabase.html", icon: "fa-handshake", label: "Заявки", roles: null, permissions: ['view_own_deals'] },
    { href: "counterparties-supabase.html", icon: "fa-users", label: "Контрагенты", roles: null, permissions: ['view_counterparties'] },
    { href: "calendar-supabase.html", icon: "fa-calendar-alt", label: "Календарь", roles: null, permissions: ['view_calendar'] },
    { href: "marketplace-supabase.html", icon: "fa-store", label: "Маркетплейс", roles: null, permissions: null },
    { href: "my-modules-supabase.html", icon: "fa-puzzle-piece", label: "Мои модули", roles: null, permissions: null },
    { href: "team-supabase.html", icon: "fa-users", label: "Команда", roles: ["admin", "manager"], permissions: null },
    { href: "admin-supabase.html", icon: "fa-users-cog", label: "Управление", roles: ["admin"], permissions: null },
    { href: "notifications-supabase.html", icon: "fa-bell", label: "Уведомления", roles: null, permissions: null }
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
 * Рендер навигации с учетом ролей и прав
 * Администратор видит все пункты меню
 */
export function renderNavigation() {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;
    
    const userRole = getCurrentUserRole();
    const userPermissions = getUserPermissions();
    const isAdmin = userRole === 'admin';
    
    const visibleItems = NAVIGATION_ITEMS.filter(item => {
        // Администратор видит всё
        if (isAdmin) return true;
        
        // Проверка по роли для не-админов
        if (item.roles && (!userRole || !item.roles.includes(userRole))) {
            return false;
        }
        
        // Проверка по правам
        if (item.permissions && item.permissions.length > 0) {
            const hasPermission = item.permissions.some(p => userPermissions.includes(p));
            if (!hasPermission) return false;
        }
        
        return true;
    });
    
    const currentPath = window.location.pathname.split('/').pop() || 'index-supabase.html';
    
    let html = '';
    for (const item of visibleItems) {
        const isActive = item.href === currentPath;
        html += `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
            <i class="fas ${item.icon}"></i>
            <span>${escapeHtml(item.label)}</span>
        </a>`;
    }
    
    container.innerHTML = html;
    console.log('[layout] Навигация отрисована, пунктов:', visibleItems.length, isAdmin ? '(админ - все пункты)' : '');
}

/**
 * Ожидание загрузки прав пользователя (увеличенный таймаут)
 */
async function waitForPermissions(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        // Проверяем, загружен ли пользователь
        if (window.currentSupabaseUser) {
            const permissions = getUserPermissions();
            // Если пользователь админ или есть права
            if (window.currentSupabaseUser.role === 'admin' || permissions.length > 0) {
                console.log('[layout] Права загружены:', permissions);
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.warn('[layout] Таймаут ожидания прав');
    return false;
}

/**
 * Инициализация бокового меню
 */
export async function initSidebar() {
    if (isInitialized) return;
    
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
        sidebarCollapsed = true;
        document.getElementById('sidebar')?.classList.add('collapsed');
    }
    
    // Ждем загрузки прав
    const hasPermissions = await waitForPermissions();
    
    // Отрисовываем навигацию
    renderNavigation();
    
    // Если права не загрузились, подписываемся на события для повторной отрисовки
    if (!hasPermissions) {
        window.addEventListener('userLoaded', () => {
            console.log('[layout] userLoaded событие, повторная отрисовка');
            renderNavigation();
        });
        
        window.addEventListener('permissionsReady', () => {
            console.log('[layout] permissionsReady событие, повторная отрисовка');
            renderNavigation();
        });
        
        // Также проверяем через интервал, если события не сработали
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.currentSupabaseUser?.role === 'admin' || getUserPermissions().length > 0) {
                console.log('[layout] Интервал: права загружены, повторная отрисовка');
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
    
    isInitialized = true;
    console.log('[layout] Сайдбар инициализирован');
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
        localStorage.setItem('sidebar_collapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
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
 * Добавление кнопок в футер сайдбара
 */
function addSidebarButtons() {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;
    
    const existingBtns = sidebarFooter.querySelectorAll('button:not(.collapse-btn)');
    existingBtns.forEach(btn => btn.remove());
    
    const themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn';
    const currentTheme = localStorage.getItem('crm_theme') || 'dark';
    themeBtn.innerHTML = currentTheme === 'dark' 
        ? '<i class="fas fa-sun"></i> <span>Светлая тема</span>' 
        : '<i class="fas fa-moon"></i> <span>Тёмная тема</span>';
    themeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleTheme();
    };
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Выйти</span>';
    logoutBtn.onclick = (e) => {
        e.stopPropagation();
        logout();
    };
    
    sidebarFooter.appendChild(themeBtn);
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
        window.location.href = 'notifications-supabase.html';
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
            ? '<i class="fas fa-sun"></i> <span>Светлая тема</span>' 
            : '<i class="fas fa-moon"></i> <span>Тёмная тема</span>';
    }
}

/**
 * Переход на страницу профиля
 */
export function goToProfile() {
    window.location.href = 'profile-supabase.html';
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

// Добавляем CSS для бейджа уведомлений
const style = document.createElement('style');
style.textContent = `
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
document.head.appendChild(style);

// Глобальный объект для доступа из HTML (onclick)
window.sidebar = {
    initSidebar,
    toggleSidebar,
    goToProfile,
    logout,
    renderNavigation,
    updateNotificationBadge
};