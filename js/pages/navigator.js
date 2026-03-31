/**
 * ============================================
 * ФАЙЛ: js/pages/navigator.js
 * РОЛЬ: Логика страницы-навигатора (обзор всех модулей)
 * 
 * ОСОБЕННОСТИ:
 *   - Отображение всех доступных модулей
 *   - Группировка по категориям
 *   - Быстрый поиск
 *   - Превью продвинутых модулей
 *   - Использует единый сайдбар из layout.js (без дублирования)
 * ============================================
 */

import { getCurrentSupabaseUser } from '../core/supabase-session.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

// Конфигурация модулей
const MODULES_CONFIG = {
    // Быстрый доступ
    quick: [
        { id: 'dashboard', name: 'Дашборд', icon: 'fa-home', href: '/app/dashboard.html', metric: null },
        { id: 'tasks', name: 'Задачи', icon: 'fa-tasks', href: '/app/tasks.html', metric: 'count' },
        { id: 'deals', name: 'Сделки', icon: 'fa-handshake', href: '/app/deals.html', metric: 'count' }
    ],
    
    // Личные модули
    personal: [
        { id: 'notes', name: 'Заметки', icon: 'fa-sticky-note', href: '/app/notes.html', description: 'Быстрые заметки и идеи', metric: 'count' },
        { id: 'habits', name: 'Привычки', icon: 'fa-calendar-check', href: '/app/habits.html', description: 'Отслеживание привычек', metric: 'progress' },
        { id: 'pomodoro', name: 'Помодоро', icon: 'fa-clock', href: '/app/pomodoro.html', description: 'Таймер для фокусировки', metric: 'timer' },
        { id: 'calendar', name: 'Календарь', icon: 'fa-calendar-alt', href: '/app/calendar.html', description: 'Планирование событий', metric: 'today' }
    ],
    
    // Рабочие модули
    work: [
        { id: 'complexes', name: 'Объекты', icon: 'fa-building', href: '/app/complexes.html', description: 'Управление объектами', metric: 'count' },
        { id: 'counterparties', name: 'Контрагенты', icon: 'fa-users', href: '/app/counterparties.html', description: 'База клиентов', metric: 'count' },
        { id: 'team', name: 'Команда', icon: 'fa-user-friends', href: '/app/team.html', description: 'Управление сотрудниками', metric: 'count', roles: ['admin', 'manager'] }
    ],
    
    // Продвинутые модули (превью)
    advanced: [
        { id: 'analytics', name: 'Аналитика', icon: 'fa-chart-line', href: null, description: 'Расширенная аналитика продаж', preview: true, price: 'PRO', action: 'upgrade' },
        { id: 'chat', name: 'Чат', icon: 'fa-comments', href: null, description: 'Внутренний чат команды', preview: true, price: 'Бесплатно', action: 'install' },
        { id: 'documents', name: 'Документы', icon: 'fa-file-pdf', href: null, description: 'Электронный документооборот', preview: true, price: 'BUSINESS', action: 'upgrade' },
        { id: 'crm', name: 'CRM PRO', icon: 'fa-star', href: null, description: 'Расширенная CRM с AI', preview: true, price: 'PRO', action: 'upgrade' }
    ],
    
    // Настройки
    settings: [
        { id: 'profile', name: 'Профиль', icon: 'fa-user', href: '/app/profile.html', description: 'Настройки профиля' },
        { id: 'notifications', name: 'Уведомления', icon: 'fa-bell', href: '/app/notifications.html', description: 'Настройки уведомлений' },
        { id: 'marketplace', name: 'Маркетплейс', icon: 'fa-store', href: '/app/marketplace.html', description: 'Установка модулей' }
    ]
};

// Категории с метаданными
const CATEGORIES = {
    quick: { name: 'Быстрый доступ', icon: 'fa-bolt', color: '#ff9800' },
    personal: { name: 'Личное', icon: 'fa-user', color: '#4caf50' },
    work: { name: 'Рабочее', icon: 'fa-briefcase', color: '#2196f3' },
    advanced: { name: 'Продвинутые модули', icon: 'fa-rocket', color: '#9c27b0' },
    settings: { name: 'Настройки', icon: 'fa-cog', color: '#607d8b' }
};

let currentUser = null;
let searchQuery = '';

// ========== ПОЛУЧЕНИЕ МЕТРИК ==========

async function getModuleMetric(moduleId, metricType) {
    try {
        switch (metricType) {
            case 'count':
                return { value: Math.floor(Math.random() * 10) + 1, label: 'активных' };
            case 'progress':
                return { value: Math.floor(Math.random() * 100), label: '%', isPercent: true };
            case 'timer':
                return { value: '25:00', label: '' };
            case 'today':
                return { value: Math.floor(Math.random() * 5), label: 'сегодня' };
            default:
                return null;
        }
    } catch (e) {
        return null;
    }
}

// ========== РЕНДЕР КАРТОЧКИ ==========

function renderModuleCard(module, categoryId) {
    const isPreview = module.preview === true;
    const isAvailable = module.href !== null;
    
    let metricsHtml = '';
    let actionsHtml = '';
    
    if (!isPreview && isAvailable) {
        metricsHtml = `
            <div class="card-metrics">
                <div class="metric">
                    <i class="fas fa-chart-line"></i>
                    <span class="metric-value">—</span>
                </div>
            </div>
        `;
        
        actionsHtml = `
            <div class="card-actions">
                <button class="card-btn card-btn-primary" data-action="open" data-href="${module.href}">
                    <i class="fas fa-arrow-right"></i> Открыть
                </button>
            </div>
        `;
    } else if (isPreview) {
        actionsHtml = `
            <div class="card-actions">
                <button class="card-btn card-btn-preview" data-action="${module.action}" data-module="${module.id}">
                    <i class="fas ${module.action === 'upgrade' ? 'fa-crown' : 'fa-download'}"></i> 
                    ${module.action === 'upgrade' ? 'Активировать' : 'Установить'}
                </button>
            </div>
        `;
    }
    
    return `
        <div class="module-card ${isPreview ? 'preview' : ''}" data-module-id="${module.id}" data-category="${categoryId}">
            ${module.price ? `<div class="card-badge">${escapeHtml(module.price)}</div>` : ''}
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
    const quickModules = MODULES_CONFIG.quick;
    
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
        html += `
            <div class="quick-item" data-href="${module.href}">
                <div class="quick-icon">
                    <i class="fas ${module.icon}"></i>
                </div>
                <div class="quick-info">
                    <div class="quick-name">${escapeHtml(module.name)}</div>
                    <div class="quick-metric">${module.metric === 'count' ? 'Есть активные' : 'Главная'}</div>
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

function renderCategory(categoryId, modules, searchQuery) {
    const category = CATEGORIES[categoryId];
    if (!category) return '';
    
    let filteredModules = modules;
    if (searchQuery) {
        filteredModules = modules.filter(m => 
            m.name.toLowerCase().includes(searchQuery) || 
            (m.description && m.description.toLowerCase().includes(searchQuery))
        );
    }
    
    filteredModules = filteredModules.filter(module => {
        if (module.roles && module.roles.length > 0) {
            const userRole = currentUser?.role;
            if (!module.roles.includes(userRole)) return false;
        }
        return true;
    });
    
    if (filteredModules.length === 0) return '';
    
    return `
        <div class="category-section">
            <div class="category-header">
                <i class="fas ${category.icon}" style="color: ${category.color};"></i>
                <h2>${escapeHtml(category.name)}</h2>
                <span>${filteredModules.length} модуля</span>
            </div>
            <div class="modules-grid">
                ${filteredModules.map(module => renderModuleCard(module, categoryId)).join('')}
            </div>
        </div>
    `;
}

// ========== РЕНДЕР ВСЕЙ СТРАНИЦЫ ==========

async function renderNavigator() {
    const container = document.getElementById('navigatorContainer');
    if (!container) return;
    
    let html = `
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
    `;
    
    html += renderQuickAccess();
    html += renderCategory('personal', MODULES_CONFIG.personal, searchQuery);
    html += renderCategory('work', MODULES_CONFIG.work, searchQuery);
    html += renderCategory('advanced', MODULES_CONFIG.advanced, searchQuery);
    html += renderCategory('settings', MODULES_CONFIG.settings, searchQuery);
    
    container.innerHTML = html;
    
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
                
                if (action === 'upgrade') {
                    showToast('info', `Модуль доступен в тарифном плане ${card.querySelector('.card-badge')?.innerText || 'PRO'}`);
                    setTimeout(() => {
                        window.location.href = '/app/marketplace.html';
                    }, 1500);
                } else if (action === 'install') {
                    showToast('success', 'Модуль будет установлен');
                    setTimeout(() => {
                        window.location.href = '/app/marketplace.html';
                    }, 1000);
                }
            });
        }
        
        if (!previewBtn) {
            const href = card.querySelector('[data-action="open"]')?.dataset.href;
            if (href) {
                card.addEventListener('click', () => {
                    window.location.href = href;
                });
            }
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