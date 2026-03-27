/**
 * ============================================
 * ФАЙЛ: layout.js
 * РОЛЬ: Управление боковой навигационной панелью и шапкой
 * ОБНОВЛЕНИЕ: Поддержка Supabase, добавлена кнопка уведомлений
 * ============================================
 */

// Состояние боковой панели
let sidebarCollapsed = false;

// ========== ЦЕНТРАЛИЗОВАННАЯ НАВИГАЦИЯ ==========

const NAVIGATION_ITEMS = [
    { href: "index-supabase.html", icon: "fa-home", label: "Дашборд", roles: null },
    { href: "tasks-supabase.html", icon: "fa-tasks", label: "Доска задач", roles: null },
    { href: "complexes-supabase.html", icon: "fa-building", label: "Объекты", roles: null },
    { href: "deals-supabase.html", icon: "fa-handshake", label: "Заявки", roles: null },
    { href: "counterparties-supabase.html", icon: "fa-users", label: "Контрагенты", roles: null },
    { href: "calendar-supabase.html", icon: "fa-calendar-alt", label: "Календарь", roles: null },
    { href: "manager-supabase.html", icon: "fa-chart-simple", label: "Панель менеджера", roles: ["admin", "manager"] },
    { href: "admin-supabase.html", icon: "fa-users-cog", label: "Управление", roles: ["admin"] },
    { href: "notifications-supabase.html", icon: "fa-bell", label: "Уведомления", roles: null }
];

function getCurrentUserRole() {
    // Пробуем получить пользователя из Supabase (если есть)
    if (window.supabaseSession && window.supabaseSession.getCurrentSupabaseUser) {
        const user = window.supabaseSession.getCurrentSupabaseUser();
        if (user) return user.role;
    }
    
    // Пробуем получить из старой системы auth
    if (window.auth && window.auth.getCurrentUser) {
        const user = window.auth.getCurrentUser();
        if (user) return user.role;
    }
    
    return null;
}

function renderNavigation() {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;
    
    const userRole = getCurrentUserRole();
    
    const visibleItems = NAVIGATION_ITEMS.filter(item => {
        if (!item.roles) return true;
        if (!userRole) return false;
        return item.roles.includes(userRole);
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
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initSidebar() {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
        sidebarCollapsed = true;
        document.getElementById('sidebar')?.classList.add('collapsed');
    }
    
    renderNavigation();
    initMobileMenu();
    addSidebarButtons();
    addNotificationButtonToTopBar();
}

function toggleSidebar() {
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

function initMobileMenu() {
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
 * Добавляет кнопку уведомлений в верхнюю панель (top-bar)
 */
function addNotificationButtonToTopBar() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    
    // Проверяем, есть ли уже кнопка
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
        <span id="notificationBadge" class="notification-badge" style="display: none; position: absolute; top: -8px; right: -8px; background: #ff6b6b; color: white; font-size: 0.65rem; font-weight: bold; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 4px;">0</span>
    `;
    
    // Вставляем перед user-profile
    const userProfile = topBar.querySelector('.user-profile');
    if (userProfile) {
        topBar.insertBefore(notificationWrapper, userProfile);
    } else {
        topBar.appendChild(notificationWrapper);
    }
}

/**
 * Обновляет счетчик непрочитанных уведомлений
 */
async function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    try {
        // Проверяем, есть ли supabase
        if (window.supabase) {
            const { data: { user } } = await window.supabase.auth.getUser();
            if (user) {
                const { count, error } = await window.supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('read', false);
                
                if (!error && count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'flex';
                    return;
                }
            }
        }
        badge.style.display = 'none';
    } catch (e) {
        console.warn('Failed to update notification badge:', e);
        badge.style.display = 'none';
    }
}

// Экспортируем функцию для вызова из других модулей
window.updateNotificationBadge = updateNotificationBadge;

function toggleTheme() {
    if (window.theme && window.theme.toggleTheme) {
        window.theme.toggleTheme();
    } else {
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
    }
    
    const themeBtn = document.querySelector('.theme-btn');
    if (themeBtn) {
        const isDarkNow = document.documentElement.classList.contains('theme-dark');
        themeBtn.innerHTML = isDarkNow 
            ? '<i class="fas fa-sun"></i> <span>Светлая тема</span>' 
            : '<i class="fas fa-moon"></i> <span>Тёмная тема</span>';
    }
}

function goToProfile() {
    window.location.href = 'profile-supabase.html';
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти из системы?')) {
        // Пробуем выйти из Supabase
        if (window.supabaseSession && window.supabaseSession.logoutFromSupabase) {
            window.supabaseSession.logoutFromSupabase();
        } else if (window.auth && window.auth.logout) {
            window.auth.logout();
        } else {
            localStorage.removeItem('crm_session');
            localStorage.removeItem('crm_remember_me');
            window.location.href = 'auth-supabase.html';
        }
    }
}

// Добавляем CSS для бейджа
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

window.sidebar = {
    initSidebar,
    toggleSidebar,
    goToProfile,
    logout,
    renderNavigation,
    updateNotificationBadge
};

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    // Обновляем счетчик через 1 секунду (после загрузки supabase)
    setTimeout(() => {
        updateNotificationBadge();
    }, 1000);
});
