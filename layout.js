/**
 * ============================================
 * ФАЙЛ: layout.js
 * РОЛЬ: Управление боковой навигационной панелью
 * СВЯЗИ:
 *   - auth.js: auth.getCurrentUser(), auth.logout()
 *   - theme.js: window.theme
 *   - localStorage: сохранение состояния панели
 * МЕХАНИКА:
 *   1. Управление состоянием боковой панели (развёрнута/свёрнута)
 *   2. Сохранение состояния в localStorage
 *   3. Адаптация для мобильных устройств
 *   4. Обработка клика по профилю (переход в профиль)
 *   5. Подсветка активного пункта меню
 * ============================================
 */

// Состояние боковой панели
let sidebarCollapsed = false;

// Инициализация боковой панели
function initSidebar() {
    // Загружаем сохранённое состояние
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
        sidebarCollapsed = true;
        document.getElementById('sidebar')?.classList.add('collapsed');
    }
    
    // Подсвечиваем активный пункт меню
    highlightActiveNavItem();
    
    // Добавляем обработчики для мобильного меню
    initMobileMenu();
}

// Сворачивание/разворачивание панели
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

// Подсветка активного пункта меню
function highlightActiveNavItem() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPath || (currentPath === 'index.html' && href === 'index.html')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Инициализация мобильного меню
function initMobileMenu() {
    // Создаём кнопку для мобильного меню
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'mobile-menu-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.onclick = () => {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.toggle('mobile-open');
    };
    document.body.appendChild(toggleBtn);
    
    // Закрываем меню при клике вне его
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

// Переход в профиль
function goToProfile() {
    window.location.href = 'profile.html';
}

// Выход из системы
function logout() {
    if (window.auth) {
        window.auth.logout();
    } else {
        localStorage.removeItem('crm_session');
        window.location.href = 'auth.html';
    }
}

// Экспорт
window.sidebar = {
    initSidebar,
    toggleSidebar,
    goToProfile,
    logout
};

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
});
