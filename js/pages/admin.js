/**
 * ============================================
 * ФАЙЛ: js/pages/admin.js
 * РОЛЬ: Оркестратор страницы администрирования
 * 
 * ОСОБЕННОСТИ:
 *   - Проверка прав доступа (только для админов)
 *   - Ленивая загрузка компонентов при переключении вкладок
 *   - Управление состоянием активной вкладки
 *   - Кэширование загруженных компонентов
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase-session.js
 *   - js/core/permissions.js
 *   - js/components/admin-users.js
 *   - js/components/admin-licenses.js
 *   - js/components/admin-permissions.js
 *   - js/components/admin-stats.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла
 *   - 10.04.2026: ПОЛНЫЙ РЕФАКТОРИНГ — разделение на компоненты
 * ============================================
 */

import { getCurrentSupabaseUser, requireSupabaseAuth, updateSupabaseUserInterface } from '../core/supabase-session.js';
import { isAdmin } from '../core/permissions.js';

console.log('[admin-page] Загрузка оркестратора...');

// ========== СОСТОЯНИЕ ==========

let currentUser = null;
let activeTab = 'users';
let loadedComponents = new Map();

// DOM элементы
let tabs = {};
let containers = {};

// ========== ПРОВЕРКА ДОСТУПА ==========

function checkAdminAccess() {
    if (!isAdmin()) {
        const container = document.querySelector('.admin-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 80px 20px;">
                    <i class="fas fa-lock" style="font-size: 64px; color: var(--text-muted); margin-bottom: 24px;"></i>
                    <h2 style="margin-bottom: 16px;">Доступ ограничен</h2>
                    <p style="color: var(--text-muted); margin-bottom: 24px;">
                        Эта страница доступна только администраторам системы.
                    </p>
                    <a href="dashboard.html" style="display: inline-block; padding: 12px 24px; background: var(--accent); color: white; border-radius: 40px; text-decoration: none;">
                        <i class="fas fa-arrow-left"></i> Вернуться на главную
                    </a>
                </div>
            `;
        }
        return false;
    }
    return true;
}

// ========== КЭШИРОВАНИЕ DOM ==========

function cacheDomElements() {
    tabs = {
        users: document.querySelector('[data-tab="users"]'),
        licenses: document.querySelector('[data-tab="licenses"]'),
        permissions: document.querySelector('[data-tab="permissions"]'),
        stats: document.querySelector('[data-tab="stats"]')
    };
    
    containers = {
        users: document.getElementById('tabUsers'),
        licenses: document.getElementById('tabLicenses'),
        permissions: document.getElementById('tabPermissions'),
        stats: document.getElementById('tabStats')
    };
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========

async function switchTab(tabId) {
    if (activeTab === tabId && loadedComponents.has(tabId)) {
        return; // Уже загружена и активна
    }
    
    console.log(`[admin-page] Переключение на вкладку: ${tabId}`);
    
    // Обновляем UI вкладок
    Object.entries(tabs).forEach(([id, btn]) => {
        if (btn) {
            btn.classList.toggle('active', id === tabId);
        }
    });
    
    Object.entries(containers).forEach(([id, container]) => {
        if (container) {
            container.style.display = id === tabId ? 'block' : 'none';
        }
    });
    
    activeTab = tabId;
    
    // Ленивая загрузка компонента
    if (!loadedComponents.has(tabId)) {
        await loadComponent(tabId);
    }
}

// ========== ЛЕНИВАЯ ЗАГРУЗКА КОМПОНЕНТОВ ==========

async function loadComponent(tabId) {
    const container = containers[tabId];
    if (!container) return;
    
    // Показываем загрузку
    container.innerHTML = `
        <div class="loading-container">
            <i class="fas fa-spinner fa-pulse fa-2x" style="color: var(--text-muted);"></i>
        </div>
    `;
    
    try {
        let component;
        
        switch (tabId) {
            case 'users':
                const { AdminUsers } = await import('../components/admin-users.js');
                component = new AdminUsers(container);
                break;
                
            case 'licenses':
                const { AdminLicenses } = await import('../components/admin-licenses.js');
                component = new AdminLicenses(container);
                break;
                
            case 'permissions':
                const { AdminPermissions } = await import('../components/admin-permissions.js');
                component = new AdminPermissions(container);
                break;
                
            case 'stats':
                const { AdminStats } = await import('../components/admin-stats.js');
                component = new AdminStats(container);
                break;
                
            default:
                console.error(`[admin-page] Неизвестная вкладка: ${tabId}`);
                return;
        }
        
        await component.render();
        loadedComponents.set(tabId, component);
        
        console.log(`[admin-page] Компонент ${tabId} загружен`);
        
    } catch (error) {
        console.error(`[admin-page] Ошибка загрузки компонента ${tabId}:`, error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 16px;"></i>
                <p>Ошибка загрузки компонента</p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 20px; background: var(--accent); color: white; border: none; border-radius: 40px; cursor: pointer;">
                    <i class="fas fa-sync-alt"></i> Обновить
                </button>
            </div>
        `;
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

function bindEvents() {
    // Переключение вкладок
    Object.entries(tabs).forEach(([tabId, btn]) => {
        if (btn) {
            btn.addEventListener('click', () => switchTab(tabId));
        }
    });
    
    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        
        switch (e.key) {
            case '1':
                e.preventDefault();
                switchTab('users');
                break;
            case '2':
                e.preventDefault();
                switchTab('licenses');
                break;
            case '3':
                e.preventDefault();
                switchTab('permissions');
                break;
            case '4':
                e.preventDefault();
                switchTab('stats');
                break;
        }
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initAdminPage() {
    console.log('[admin-page] Инициализация страницы...');
    
    // Проверяем авторизацию
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    console.log('[admin-page] Текущий пользователь:', currentUser?.name);
    
    // Проверяем права администратора
    if (!checkAdminAccess()) {
        console.warn('[admin-page] Доступ запрещён — не администратор');
        return;
    }
    
    // Кэшируем DOM
    cacheDomElements();
    
    // Привязываем события
    bindEvents();
    
    // Загружаем активную вкладку
    await loadComponent(activeTab);
    
    // Отмечаем загруженным
    loadedComponents.set(activeTab, true);
    
    console.log('[admin-page] Инициализация завершена');
}

// ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

/**
 * Обновить текущую вкладку
 */
export async function refreshCurrentTab() {
    const component = loadedComponents.get(activeTab);
    if (component && component.refresh) {
        await component.refresh();
    }
}

/**
 * Получить текущего пользователя
 */
export function getCurrentAdmin() {
    return currentUser;
}

// ========== ЭКСПОРТ ПО УМОЛЧАНИЮ ==========

export default {
    initAdminPage,
    refreshCurrentTab,
    getCurrentAdmin
};

console.log('[admin-page] Оркестратор загружен');
