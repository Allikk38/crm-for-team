/**
 * ============================================
 * ФАЙЛ: js/pages/notifications.js
 * РОЛЬ: Логика страницы центра уведомлений (вынесена из notifications-supabase.html)
 * 
 * ОСОБЕННОСТИ:
 *   - Просмотр всех уведомлений
 *   - Отметка прочитанных/непрочитанных
 *   - Удаление уведомлений
 *   - Переход к связанным объектам (задачи, сделки)
 *   - Автоматическое обновление счетчика
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/notifications-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из notifications-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { 
    getNotifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAllNotifications
} from '../services/notifications-supabase.js';

// Состояние страницы
let notifications = [];
let currentUser = null;

// Типы уведомлений
const TYPE_ICONS = {
    task_assigned: '📋',
    deadline: '⏰',
    overdue: '⚠️',
    mention: '💬',
    deal_status: '🤝'
};

const TYPE_LABELS = {
    task_assigned: 'Новая задача',
    deadline: 'Дедлайн',
    overdue: 'Просрочка',
    mention: 'Упоминание',
    deal_status: 'Статус сделки'
};

console.log('[notifications.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

/**
 * Экранирование HTML для безопасности
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирование даты для отображения
 * @param {string} dateStr - Строка даты
 * @returns {string} Отформатированная дата
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
        return 'Сегодня, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
        return 'Вчера, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

/**
 * Получить URL для перехода по уведомлению
 * @param {Object} notification - Объект уведомления
 * @returns {string|null} URL для перехода или null
 */
function getRedirectUrl(notification) {
    if (notification.task_id) {
        return `tasks-supabase.html?task=${notification.task_id}`;
    }
    if (notification.deal_id) {
        return `deals-supabase.html?deal=${notification.deal_id}`;
    }
    if (notification.complex_id) {
        return `complexes-supabase.html?complex=${notification.complex_id}`;
    }
    return null;
}

// ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

/**
 * Обработка клика по уведомлению
 * @param {Object} notification - Объект уведомления
 */
async function handleNotificationClick(notification) {
    console.log('[notifications] Клик по уведомлению:', notification.id);
    
    if (!notification.read) {
        const success = await markAsRead(notification.id);
        if (success) {
            notification.read = true;
            updateUnreadBadge();
            const element = document.querySelector(`.notification-item[data-id="${notification.id}"]`);
            if (element) {
                element.classList.remove('unread');
            }
            console.log('[notifications] Уведомление отмечено прочитанным');
        }
    }
    
    const url = getRedirectUrl(notification);
    if (url) {
        console.log('[notifications] Переход по ссылке:', url);
        window.location.href = url;
    }
}

/**
 * Отметить одно уведомление как прочитанное
 * @param {string} notificationId - ID уведомления
 * @param {Event} event - Событие
 */
async function handleMarkAsRead(notificationId, event) {
    event.stopPropagation();
    console.log('[notifications] Отметка прочитанным:', notificationId);
    
    const success = await markAsRead(notificationId);
    if (success) {
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            const element = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
            if (element) {
                element.classList.remove('unread');
            }
            updateUnreadBadge();
            if (window.showToast) {
                window.showToast('success', 'Отмечено прочитанным');
            }
        }
    }
}

/**
 * Удалить одно уведомление
 * @param {string} notificationId - ID уведомления
 * @param {Event} event - Событие
 */
async function handleDeleteNotification(notificationId, event) {
    event.stopPropagation();
    console.log('[notifications] Удаление уведомления:', notificationId);
    
    const element = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (element) {
        element.classList.add('notification-removing');
    }
    
    setTimeout(async () => {
        const success = await deleteNotification(notificationId);
        if (success) {
            notifications = notifications.filter(n => n.id !== notificationId);
            renderNotifications();
            updateUnreadBadge();
            if (window.showToast) {
                window.showToast('success', 'Уведомление удалено');
            }
            console.log('[notifications] Уведомление удалено');
        }
    }, 200);
}

/**
 * Отметить все уведомления как прочитанные
 */
async function handleMarkAllRead() {
    console.log('[notifications] Отметка всех уведомлений прочитанными');
    
    const success = await markAllAsRead();
    if (success) {
        notifications.forEach(n => { n.read = true; });
        renderNotifications();
        updateUnreadBadge();
        if (window.showToast) {
            window.showToast('success', 'Все уведомления отмечены прочитанными');
        }
        console.log('[notifications] Все уведомления отмечены прочитанными');
    }
}

/**
 * Удалить все уведомления
 */
async function handleClearAll() {
    if (!confirm('Удалить все уведомления? Это действие нельзя отменить.')) return;
    
    console.log('[notifications] Удаление всех уведомлений');
    
    const success = await deleteAllNotifications();
    if (success) {
        notifications = [];
        renderNotifications();
        updateUnreadBadge();
        if (window.showToast) {
            window.showToast('success', 'Все уведомления удалены');
        }
        console.log('[notifications] Все уведомления удалены');
    }
}

// ========== ОБНОВЛЕНИЕ UI ==========

/**
 * Обновить счетчик непрочитанных уведомлений в шапке
 */
function updateUnreadBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-block';
            console.log('[notifications] Непрочитанных уведомлений:', unreadCount);
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Отрисовать список уведомлений
 */
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>Нет уведомлений</p>
                <p style="font-size: 0.8rem; margin-top: 8px;">Когда появятся новые уведомления, они будут отображаться здесь</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const n of notifications) {
        const unreadClass = n.read ? '' : 'unread';
        const typeClass = `notification-type ${n.type}`;
        const typeIcon = TYPE_ICONS[n.type] || '🔔';
        const typeLabel = TYPE_LABELS[n.type] || n.type;
        
        html += `
            <div class="notification-item ${unreadClass}" data-id="${n.id}" onclick="window.handleNotificationClick('${n.id}')">
                <div class="notification-header">
                    <span class="${typeClass}">
                        ${typeIcon} ${typeLabel}
                    </span>
                    <span class="notification-date">
                        <i class="far fa-clock"></i> ${formatDate(n.created_at)}
                    </span>
                </div>
                <div class="notification-title">${escapeHtml(n.title)}</div>
                <div class="notification-message">${escapeHtml(n.message)}</div>
                <div class="notification-actions">
                    ${!n.read ? `<button onclick="window.handleMarkAsRead('${n.id}', event)"><i class="fas fa-check"></i> Прочитано</button>` : ''}
                    <button class="delete-btn" onclick="window.handleDeleteNotification('${n.id}', event)"><i class="fas fa-trash"></i> Удалить</button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    console.log('[notifications] Отображено уведомлений:', notifications.length);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

/**
 * Загрузить уведомления из Supabase
 */
async function loadNotifications() {
    console.log('[notifications] Загрузка уведомлений...');
    notifications = await getNotifications();
    console.log(`[notifications] Загружено ${notifications.length} уведомлений`);
    renderNotifications();
    updateUnreadBadge();
}

// ========== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ДЛЯ HTML ==========

// Экспортируем функции в window для доступа из onclick в HTML
window.handleNotificationClick = async (id) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        await handleNotificationClick(notification);
    } else {
        console.warn('[notifications] Уведомление не найдено:', id);
    }
};

window.handleMarkAsRead = async (id, event) => {
    await handleMarkAsRead(id, event);
};

window.handleDeleteNotification = async (id, event) => {
    await handleDeleteNotification(id, event);
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

/**
 * Главная функция инициализации страницы
 */
export async function initNotificationsPage() {
    console.log('[notifications] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[notifications] Текущий пользователь:', currentUser?.name);
    
    await loadNotifications();
    
    document.getElementById('markAllReadBtn')?.addEventListener('click', handleMarkAllRead);
    document.getElementById('clearAllBtn')?.addEventListener('click', handleClearAll);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[notifications] Анимации инициализированы');
    }
    
    console.log('[notifications] Инициализация завершена');
}