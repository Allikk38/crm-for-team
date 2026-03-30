/**
 * ============================================
 * ФАЙЛ: js/modules/admin/index.js
 * РОЛЬ: Модуль администратора - регистрация и инициализация
 * 
 * ОСОБЕННОСТИ:
 *   - Регистрация модуля в реестре
 *   - Определение страниц и виджетов
 *   - Управление пользователями, ролями, правами
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/registry.js
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 30.03.2026: Создание модуля администратора
 * ============================================
 */

console.log('[admin-module] Загрузка модуля администратора...');

// Права для модуля администратора
const ADMIN_PERMISSIONS = {
    MANAGE_USERS: 'manage_users',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_PERMISSIONS: 'manage_permissions',
    MANAGE_PLANS: 'manage_plans',
    SYSTEM_SETTINGS: 'system_settings',
    VIEW_ALL_DATA: 'view_all_data',
    DELETE_ANY_DATA: 'delete_any_data'
};

// Определение модуля
const adminModule = {
    id: 'admin',
    name: 'Администрирование',
    version: '2.0.0',
    description: 'Управление пользователями, ролями и правами доступа',
    
    dependencies: [],
    requiredPermissions: [ADMIN_PERMISSIONS.MANAGE_USERS],
    requiredPlans: ['business', 'enterprise'],
    
    pages: {
        'admin-supabase.html': {
            title: 'Управление',
            icon: 'fa-users-cog',
            permissions: [ADMIN_PERMISSIONS.MANAGE_USERS]
        }
    },
    
    widgets: {
        'users-summary': {
            title: 'Пользователи системы',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [ADMIN_PERMISSIONS.MANAGE_USERS]
        },
        'roles-distribution': {
            title: 'Распределение ролей',
            component: null,
            defaultSize: { w: 2, h: 2 },
            permissions: [ADMIN_PERMISSIONS.MANAGE_USERS]
        }
    },
    
    onLoad: async () => {
        console.log('[admin-module] Модуль администратора загружен');
        
        // Проверяем права доступа (только администратор)
        const user = window.currentSupabaseUser;
        if (user?.role !== 'admin') {
            console.warn('[admin-module] Доступ запрещен: требуется роль администратора');
            // Показываем сообщение на странице
            const main = document.querySelector('.main-content');
            if (main) {
                main.innerHTML = `
                    <div class="info-panel" style="text-align: center; padding: 60px;">
                        <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h2>Доступ ограничен</h2>
                        <p>Эта страница доступна только администраторам.</p>
                        <a href="index-supabase.html" class="nav-btn" style="margin-top: 20px; display: inline-block; padding: 10px 20px; background: var(--accent); border-radius: 40px; color: white; text-decoration: none;">Вернуться на главную</a>
                    </div>
                `;
            }
            return;
        }
        
        // Инициализируем страницу
        try {
            const { initAdminPage } = await import('../../pages/admin.js');
            if (typeof initAdminPage === 'function') {
                await initAdminPage();
                console.log('[admin-module] Страница администрирования инициализирована');
            }
        } catch (error) {
            console.error('[admin-module] Ошибка инициализации:', error);
        }
    },
    
    onUnload: async () => {
        console.log('[admin-module] Модуль администратора выгружен');
    }
};

// Делаем глобальным для доступа из других скриптов
window.adminModule = adminModule;

console.log('[admin-module] Модуль готов к регистрации');
