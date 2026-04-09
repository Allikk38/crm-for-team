/**
 * ============================================
 * ФАЙЛ: js/pages/navigator.js
 * РОЛЬ: Логика страницы-навигатора (обзор всех модулей)
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение всех доступных модулей
 *   - Группировка по категориям
 *   - Быстрый поиск
 *   - Превью продвинутых модулей с проверкой тарифа
 *   - Исправлены пути с BASE_PATH
 * 
 * ИСТОРИЯ:
 *   - 08.04.2026: Исправлены пути для GitHub Pages
 *   - 08.04.2026: Унифицировано отображение недоступных модулей
 *   - 09.04.2026: Переход с role на permission_sets (isAdmin, hasPermission)
 * ============================================
 */

import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import { escapeHtml, showToast } from '../utils/helpers.js';
import { supabase } from '../core/supabase.js';
import planManager from '../core/planManager.js';
import { isAdmin, hasPermission, canManageTeam } from '../core/permissions.js';

// ========== ОПРЕДЕЛЕНИЕ БАЗОВОГО ПУТИ ==========
function getBasePath() {
    const fullPath = window.location.pathname;
    const match = fullPath.match(/^(\/crm-for-team)/);
    if (match) return match[1];
    
    if (window.location.hostname.includes('github.io')) {
        const parts = fullPath.split('/');
        if (parts.length > 1 && parts[1] && parts[1] !== 'app') {
            return `/${parts[1]}`;
        }
    }
    return '';
}

const NAV_BASE_PATH = getBasePath();

function getPageUrl(page) {
    if (NAV_BASE_PATH) {
        return `${NAV_BASE_PATH}/app/${page}`;
    }
    return `/app/${page}`;
}

// Конфигурация модулей
const MODULES_CONFIG = {
    quick: [
        { id: 'dashboard', name: 'Дашборд', icon: 'fa-home', page: 'dashboard.html', metric: null },
        { id: 'tasks', name: 'Задачи', icon: 'fa-tasks', page: 'tasks.html', metric: 'count', permission: 'view_tasks' },
        { id: 'deals', name: 'Сделки', icon: 'fa-handshake', page: 'deals.html', metric: 'count', permission: 'view_own_deals' }
    ],
    
    personal: [
        { id: 'notes', name: 'Заметки', icon: 'fa-sticky-note', page: 'notes.html', description: 'Быстрые заметки и идеи', metric: 'count', permission: 'view_notes' },
        { id: 'habits', name: 'Привычки', icon: 'fa-calendar-check', page: 'habits.html', description: 'Отслеживание привычек', metric: 'progress' },
        { id: 'pomodoro', name: 'Помодоро', icon: 'fa-clock', page: 'pomodoro.html', description: 'Таймер для фокусировки', metric: 'timer' },
        { id: 'calendar', name: 'Календарь', icon: 'fa-calendar-alt', page: 'calendar.html', description: 'Планирование событий', metric: 'today', permission: 'view_calendar' },
        { id: 'finance', name: 'Финансы', icon: 'fa-money-bill-wave', page: 'finance.html', description: 'Учет доходов и расходов', metric: 'count' }
    ],
    
    work: [
        { id: 'complexes', name: 'Объекты', icon: 'fa-building', page: 'complexes.html', description: 'Управление объектами', metric: 'count', permission: 'view_complexes' },
        { id: 'counterparties', name: 'Контрагенты', icon: 'fa-users', page: 'counterparties.html', description: 'База клиентов', metric: 'count', permission: 'view_counterparties' },
        { id: 'team', name: 'Команда', icon: 'fa-user-friends', page: 'team.html', description: 'Управление сотрудниками', metric: 'count', permission: 'view_team' }
    ],
    
    advanced: [
        { id: 'analytics', name: 'Аналитика', icon: 'fa-chart-line', page: null, description: 'Расширенная аналитика продаж', preview: true, price: 'PRO' },
        { id: 'chat', name: 'Чат', icon: 'fa-comments', page: null, description: 'Внутренний чат команды', preview: true, price: 'FREE' },
        { id: 'documents', name: 'Документы', icon: 'fa-file-pdf', page: null, description: 'Электронный документооборот', preview: true, price: 'BUSINESS' },
        { id: 'reports', name: 'Отчеты', icon: 'fa-file-alt', page: null, description: 'Формирование отчетов', preview: true, price: 'PRO' },
        { id: 'invoices', name: 'Счета', icon: 'fa-file-invoice', page: null, description: 'Управление счетами', preview: true, price: 'BUSINESS' }
    ],
    
    settings: [
        { id: 'profile', name: 'Профиль', icon: 'fa-user', page: 'profile.html', description: 'Настройки профиля', permission: 'view_profile' },
        { id: 'notifications', name: 'Уведомления', icon: 'fa-bell', page: 'notifications.html', description: 'Центр уведомлений' },
        { id: 'marketplace', name: 'Маркетплейс', icon: 'fa-store', page: 'marketplace.html', description: 'Установка модулей' },
        { id: 'my-modules', name: 'Мои модули', icon: 'fa-puzzle-piece', page: 'my-modules.html', description: 'Установленные модули' }
    ]
};

const CATEGORIES = {
    quick: { name: 'Быстрый доступ', icon: 'fa-bolt', color: '#ff9800' },
    personal: { name: 'Личное', icon: 'fa-user', color: '#4caf50' },
    work: { name: 'Рабочее', icon: 'fa-briefcase', color: '#2196f3' },
    advanced: { name: 'Продвинутые модули', icon: 'fa-rocket', color: '#9c27b0' },
    settings: { name: 'Настройки', icon: 'fa-cog', color: '#607d8b' }
};

let currentUser = null;
let searchQuery = '';

// ========== ПРОВЕРКА ДОСТУПНОСТИ ТАРИФА ==========

function checkPlanAvailability(requiredTier) {
    if (!requiredTier || requiredTier === 'FREE' || requiredTier === 'Бесплатно') return true;
    
    const currentPlan = planManager?.getUserPlan();
    if (!currentPlan) return false;
    
    const tierMap = {
        'FREE': 0,
        'PRO': 1,
        'BUSINESS': 2,
        'ENTERPRISE': 3
    };
    
    const planMap = {
        'free': 0,
        'pro': 1,
        'business': 2,
        'enterprise': 3
    };
    
    const required = tierMap[requiredTier] || 0;
    const current = planMap[currentPlan.id] || 0;
    
    return current >= required;
}

// ========== ПРОВЕРКА ДОСТУПНОСТИ МОДУЛЯ ==========

function isModuleAvailable(module) {
    if (!currentUser) return false;
    
    // Администратор имеет доступ ко всему
    if (isAdmin()) return true;
    
    // Проверка по правам (permission_sets)
    if (module.permission) {
        // Маппинг старых permission на новые
        const permissionMap = {
            'view_tasks': 'view_tasks',
            'view_own_deals': 'view_own_deals',
            'view_complexes': 'view_complexes',
            'view_counterparties': 'view_counterparties',
            'view_notes': 'view_notes',
            'view_calendar': 'view_calendar',
            'view_profile': 'view_profile',
            'view_team': 'view_team'
        };
        
        const requiredPermission = permissionMap[module.permission];
        if (requiredPermission && !hasPermission(requiredPermission)) {
            return false;
        }
    }
    
    // Проверка для team (только менеджеры и админы)
    if (module.id === 'team' && !canManageTeam() && !isAdmin()) {
        return false;
    }
    
    return true;
}

// ========== ПОЛУЧЕНИЕ МЕТРИК ==========

async function getModuleMetric(moduleId, metricType) {
    try {
        const user = currentUser;
        if (!user) return null;
        
        switch (metricType) {
            case 'count':
                if (moduleId === 'tasks') {
                    const { count } = await supabase
                        .from('tasks')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .neq('status', 'completed');
                    return { value: count || 0, label: 'активных' };
                }
                if (moduleId === 'notes') {
                    const { count } = await supabase
                        .from('notes')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id);
                    return { value: count || 0, label: 'заметок' };
                }
                if (moduleId === 'finance') {
                    const { data } = await supabase
                        .from('finance_transactions')
                        .select('amount')
                        .eq('user_id', user.id)
                        .eq('type', 'expense')
                        .gte('date', new Date().toISOString().slice(0, 7) + '-01');
                    const total = data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
                    return { value: total.toLocaleString() + ' ₽', label: 'расходы' };
                }
                if (moduleId === 'deals') {
                    const { count } = await supabase
                        .from('deals')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .not('stage', 'in', ['closed', 'cancelled']);
                    return { value: count || 0, label: 'активных' };
                }
                if (moduleId === 'complexes') {
                    const { count } = await supabase
                        .from('complexes')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id);
                    return { value: count || 0, label: 'объектов' };
                }
                if (moduleId === 'counterparties') {
                    const { count } = await supabase
                        .from('counterparties')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id);
                    return { value: count || 0, label: 'контрагентов' };
                }
                return { value: 0, label: 'активных' };
                
            case 'progress':
                if (moduleId === 'habits') {
                    const { data } = await supabase
                        .from('habits')
                        .select('streak')
                        .eq('user_id', user.id);
                    const maxStreak = data?.reduce((max, h) => Math.max(max, h.streak || 0), 0) || 0;
                    return { value: maxStreak, label: 'дней', isStreak: true };
                }
                return { value: 0, label: '%', isPercent: true };
                
            case 'timer':
                return { value: '25:00', label: '' };
                
            case 'today':
                if (moduleId === 'calendar') {
                    const today = new Date().toISOString().split('T')[0];
                    const { count } = await supabase
                        .from('tasks')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .eq('due_date', today);
                    return { value: count || 0, label: 'сегодня' };
                }
                return { value: 0, label: 'сегодня' };
                
            default:
                return null;
        }
    } catch (e) {
        console.error(`[navigator] Ошибка загрузки метрики ${moduleId}:`, e);
        return null;
    }
}

// ========== РЕНДЕР КАРТОЧКИ ==========

async function renderModuleCard(module, categoryId) {
    const isPreview = module.preview === true;
    const isAvailable = isModuleAvailable(module);
    const href = module.page ? getPageUrl(module.page) : null;
    
    let metricsHtml = '';
    let actionsHtml = '';
    let statusBadge = '';
    
    // Загружаем метрику для доступных модулей
    let metricData = null;
    if (!isPreview && isAvailable && module.metric) {
        metricData = await getModuleMetric(module.id, module.metric);
    }
    
    if (metricData) {
        metricsHtml = `
            <div class="card-metrics" style="margin: 12px 0; padding: 8px; background: var(--input-bg); border-radius: 12px; text-align: center;">
                <span style="font-size: 1.5rem; font-weight: 700; color: var(--accent);">${metricData.value}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 4px;">${metricData.label}</span>
            </div>
        `;
    }
    
    if (!isPreview && isAvailable && href) {
        actionsHtml = `
            <div class="card-actions">
                <button class="card-btn card-btn-primary" data-action="open" data-href="${href}">
                    <i class="fas fa-arrow-right"></i> Открыть
                </button>
            </div>
        `;
    } else if (!isAvailable && !isPreview) {
        statusBadge = '<div class="card-badge" style="background: #ff6b6b;">Нет доступа</div>';
        actionsHtml = `
            <div class="card-actions">
                <button class="card-btn card-btn-preview" data-action="upgrade" data-module="${module.id}">
                    <i class="fas fa-lock"></i> Нет доступа
                </button>
            </div>
        `;
    } else if (isPreview) {
        const requiredTier = module.price || 'FREE';
        const isPlanAvailable = checkPlanAvailability(requiredTier);
        
        if (!isPlanAvailable) {
            statusBadge = `<div class="card-badge" style="background: #ff6b6b;">${escapeHtml(requiredTier)}</div>`;
        } else {
            statusBadge = `<div class="card-badge" style="background: #4caf50;">${escapeHtml(requiredTier)}</div>`;
        }
        
        const buttonText = isPlanAvailable ? 'Установить' : 'Повысить тариф';
        const buttonIcon = isPlanAvailable ? 'fa-download' : 'fa-crown';
        const buttonAction = isPlanAvailable ? 'install' : 'upgrade';
        const buttonClass = isPlanAvailable ? 'card-btn-primary' : 'card-btn-preview';
        
        actionsHtml = `
            <div class="card-actions">
                <button class="card-btn ${buttonClass}" data-action="${buttonAction}" data-module="${module.id}" data-tier="${requiredTier}">
                    <i class="fas ${buttonIcon}"></i> ${buttonText}
                </button>
            </div>
        `;
    }
    
    const opacity = (!isAvailable && !isPreview) || (isPreview && !checkPlanAvailability(module.price)) ? 'opacity: 0.7;' : '';
    
    return `
        <div class="module-card ${isPreview ? 'preview' : ''}" 
             data-module-id="${module.id}" data-category="${categoryId}"
             style="${opacity}">
            ${statusBadge}
            <div class="card-icon">
                <i class="fas ${module.icon}"></i>
            </div>
            <div class="card-title">${escapeHtml(module.name)}</div>
            <div class="card-description">${escapeHtml(module.description || '')}</div>
            ${metricsHtml}
            ${actionsHtml}
        </div>
    `;
}

// ========== РЕНДЕР БЫСТРОГО ДОСТУПА ==========

function renderQuickAccess() {
    const quickModules = MODULES_CONFIG.quick.filter(m => isModuleAvailable(m));
    
    if (quickModules.length === 0) return '';
    
    let html = `
        <div class="quick-access">
            <div class="category-header">
                <i class="fas fa-bolt" style="color: #ff9800;"></i>
                <h2>Быстрый доступ</h2>
                <span>${quickModules.length} модуля</span>
            </div>
            <div class="quick-grid">
    `;
    
    for (const module of quickModules) {
        const href = getPageUrl(module.page);
        html += `
            <div class="quick-item" data-href="${href}">
                <div class="quick-icon">
                    <i class="fas ${module.icon}"></i>
                </div>
                <div class="quick-info">
                    <div class="quick-name">${escapeHtml(module.name)}</div>
                    <div class="quick-metric">${module.metric === 'count' ? 'Есть активные' : 'Перейти'}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.7rem;"></i>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// ========== РЕНДЕР КАТЕГОРИИ ==========

async function renderCategory(categoryId, modules, searchQuery) {
    const category = CATEGORIES[categoryId];
    if (!category) return '';
    
    let filteredModules = modules;
    if (searchQuery) {
        filteredModules = modules.filter(m => 
            m.name.toLowerCase().includes(searchQuery) || 
            (m.description && m.description.toLowerCase().includes(searchQuery))
        );
    }
    
    if (filteredModules.length === 0) return '';
    
    const cardsHtml = await Promise.all(
        filteredModules.map(module => renderModuleCard(module, categoryId))
    );
    
    return `
        <div class="category-section">
            <div class="category-header">
                <i class="fas ${category.icon}" style="color: ${category.color};"></i>
                <h2>${escapeHtml(category.name)}</h2>
                <span>${filteredModules.length} модуля</span>
            </div>
            <div class="modules-grid">
                ${cardsHtml.join('')}
            </div>
        </div>
    `;
}

// ========== РЕНДЕР ВСЕЙ СТРАНИЦЫ ==========

async function renderNavigator() {
    const container = document.getElementById('navigatorContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="navigator-header">
            <div class="navigator-title">
                <h1>Навигатор</h1>
                <p>Быстрый доступ ко всем модулям системы</p>
            </div>
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" placeholder="Поиск модулей..." value="${escapeHtml(searchQuery)}">
            </div>
        </div>
        <div id="navigatorContent">
            <div class="loading-state">
                <i class="fas fa-spinner fa-pulse fa-2x"></i>
                <p>Загрузка модулей...</p>
            </div>
        </div>
    `;
    
    const contentContainer = document.getElementById('navigatorContent');
    
    let html = renderQuickAccess();
    html += await renderCategory('personal', MODULES_CONFIG.personal, searchQuery);
    html += await renderCategory('work', MODULES_CONFIG.work, searchQuery);
    html += await renderCategory('advanced', MODULES_CONFIG.advanced, searchQuery);
    html += await renderCategory('settings', MODULES_CONFIG.settings, searchQuery);
    
    contentContainer.innerHTML = html;
    
    attachEventHandlers();
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

function attachEventHandlers() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderNavigator();
        });
    }
    
    document.querySelectorAll('.module-card').forEach(card => {
        const openBtn = card.querySelector('[data-action="open"]');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const href = openBtn.dataset.href;
                if (href) {
                    window.location.href = href;
                }
            });
        }
        
        const previewBtn = card.querySelector('[data-action="upgrade"], [data-action="install"]');
        if (previewBtn) {
            previewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = previewBtn.dataset.action;
                const tier = previewBtn.dataset.tier;
                
                if (action === 'upgrade') {
                    showToast('info', `Модуль доступен в тарифе ${tier || 'PRO'}`);
                    setTimeout(() => {
                        window.location.href = getPageUrl('marketplace.html');
                    }, 1500);
                } else if (action === 'install') {
                    showToast('success', 'Модуль будет установлен');
                    setTimeout(() => {
                        window.location.href = getPageUrl('marketplace.html');
                    }, 1000);
                }
            });
        }
        
        if (!previewBtn && openBtn) {
            card.addEventListener('click', () => {
                const href = openBtn.dataset.href;
                if (href) {
                    window.location.href = href;
                }
            });
        }
    });
    
    document.querySelectorAll('.quick-item').forEach(item => {
        const href = item.dataset.href;
        if (href) {
            item.addEventListener('click', () => {
                window.location.href = href;
            });
        }
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initNavigatorPage() {
    console.log('[navigator] Инициализация страницы-навигатора...');
    
    currentUser = getCurrentSupabaseUser();
    
    await renderNavigator();
    
    console.log('[navigator] Инициализация завершена');
}

export { getPageUrl };
