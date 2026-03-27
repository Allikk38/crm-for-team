/**
 * ============================================
 * ФАЙЛ: js/pages/profile.js
 * РОЛЬ: Логика страницы личного кабинета (вынесена из profile-supabase.html)
 * 
 * ОСОБЕННОСТИ:
 *   - Просмотр и редактирование профиля
 *   - Личная статистика (завершённые, активные, просроченные задачи)
 *   - График активности за неделю
 *   - Список последних завершённых задач
 *   - Настройки интерфейса (сохраняются в localStorage)
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из profile-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface
} from '../core/supabase-session.js';
import { getTasks } from '../services/tasks-supabase.js';

// Состояние страницы
let currentUser = null;
let tasks = [];

console.log('[profile.js] Модуль загружен');

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
 * Показать всплывающее уведомление
 * @param {string} type - Тип уведомления (success, error, info)
 * @param {string} message - Текст уведомления
 */
function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

/**
 * Загрузить профиль пользователя из таблицы profiles
 */
async function loadUserProfile() {
    console.log('[profile] Загрузка профиля пользователя...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (data) {
        currentUser.name = data.name || currentUser.name;
        currentUser.role = data.role || currentUser.role;
        currentUser.github_username = data.github_username || currentUser.github_username;
        console.log('[profile] Профиль загружен:', { name: currentUser.name, role: currentUser.role });
    } else if (error) {
        console.error('[profile] Ошибка загрузки профиля:', error);
    }
}

/**
 * Загрузить задачи пользователя и обновить UI
 */
async function loadUserTasks() {
    console.log('[profile] Загрузка задач пользователя...');
    tasks = await getTasks();
    console.log(`[profile] Загружено ${tasks.length} задач`);
    updateStats();
    updateRecentTasks();
    updateActivityChart();
}

/**
 * Обновить статистику на странице
 */
function updateStats() {
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const activeTasks = tasks.filter(t => t.status !== 'completed').length;
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter(t => {
        if (t.status === 'completed') return false;
        if (!t.due_date) return false;
        return t.due_date < today;
    }).length;
    
    const avgTime = tasks.filter(t => t.status === 'completed' && t.completed_at && t.created_at)
        .reduce((sum, t) => {
            const created = new Date(t.created_at);
            const completed = new Date(t.completed_at);
            const days = (completed - created) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0) / (completedTasks || 1);
    
    document.getElementById('statCompleted').textContent = completedTasks;
    document.getElementById('statActive').textContent = activeTasks;
    document.getElementById('statOverdue').textContent = overdueTasks;
    document.getElementById('statAvgTime').textContent = Math.round(avgTime);
    
    console.log('[profile] Статистика обновлена:', { completedTasks, activeTasks, overdueTasks });
}

/**
 * Обновить список последних завершённых задач
 */
function updateRecentTasks() {
    const container = document.getElementById('recentTasks');
    const recentCompleted = tasks
        .filter(t => t.status === 'completed' && t.completed_at)
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        .slice(0, 5);
    
    if (recentCompleted.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Нет завершённых задач</div>';
        return;
    }
    
    container.innerHTML = recentCompleted.map(task => `
        <div class="recent-task-item">
            <div class="recent-task-title">${escapeHtml(task.title)}</div>
            <div class="recent-task-date">${task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}</div>
        </div>
    `).join('');
    
    console.log(`[profile] Показано ${recentCompleted.length} последних задач`);
}

/**
 * Обновить график активности за неделю
 */
function updateActivityChart() {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    
    const weeklyData = days.map((_, index) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];
        
        return tasks.filter(t => {
            if (t.status !== 'completed') return false;
            if (!t.completed_at) return false;
            return t.completed_at.split('T')[0] === dateStr;
        }).length;
    });
    
    const maxValue = Math.max(...weeklyData, 1);
    const container = document.getElementById('personalChart');
    
    container.innerHTML = weeklyData.map(value => {
        const height = (value / maxValue) * 80 + 20;
        return `<div class="chart-bar-profile" style="height: ${height}px;" title="${value} задач"></div>`;
    }).join('');
    
    console.log('[profile] График активности обновлен:', weeklyData);
}

/**
 * Обновить UI профиля (имя, email, роль, аватар)
 */
function updateProfileUI() {
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const githubEl = document.getElementById('profileGithub');
    const roleEl = document.getElementById('profileRole');
    const avatarEl = document.getElementById('profileAvatar');
    
    if (!nameEl) {
        console.warn('[profile] Элементы DOM не найдены');
        return;
    }
    
    nameEl.textContent = currentUser.name;
    emailEl.textContent = currentUser.email;
    if (githubEl) githubEl.textContent = currentUser.github_username || '—';
    
    let roleLabel = '';
    if (currentUser.role === 'admin') roleLabel = 'Администратор';
    else if (currentUser.role === 'manager') roleLabel = 'Менеджер';
    else if (currentUser.role === 'agent') roleLabel = 'Агент';
    else roleLabel = 'Сотрудник';
    if (roleEl) roleEl.textContent = roleLabel;
    
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    if (avatarEl) avatarEl.innerHTML = initials || '<i class="fas fa-user"></i>';
    
    console.log('[profile] UI обновлен, имя:', currentUser.name);
}

// ========== МОДАЛЬНОЕ ОКНО ==========

/**
 * Закрыть модальное окно редактирования профиля
 */
function closeEditModal() {
    document.getElementById('editProfileModal').classList.remove('active');
    console.log('[profile] Модальное окно закрыто');
}

/**
 * Сохранить изменения профиля
 */
async function saveProfileChanges() {
    const newName = document.getElementById('editName').value.trim();
    if (!newName) {
        alert('Введите имя');
        return;
    }
    
    console.log('[profile] Сохранение изменений профиля:', { newName });
    
    const { error } = await supabase
        .from('profiles')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);
    
    if (!error) {
        currentUser.name = newName;
        updateProfileUI();
        updateSupabaseUserInterface();
        closeEditModal();
        showToast('success', 'Профиль обновлен');
        console.log('[profile] Профиль успешно обновлен');
    } else {
        console.error('[profile] Ошибка сохранения:', error);
        alert('Ошибка сохранения');
    }
}

/**
 * Открыть модальное окно редактирования профиля
 */
function openEditModal() {
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editProfileModal').classList.add('active');
    console.log('[profile] Модальное окно открыто');
}

// ========== НАСТРОЙКИ ==========

/**
 * Загрузить настройки интерфейса из localStorage
 */
function loadSettings() {
    const notificationsToggle = document.getElementById('notificationsToggle');
    const confirmActionsToggle = document.getElementById('confirmActionsToggle');
    const compactModeToggle = document.getElementById('compactModeToggle');
    
    if (!notificationsToggle) {
        console.warn('[profile] Элементы настроек не найдены');
        return;
    }
    
    notificationsToggle.checked = localStorage.getItem('crm_notifications') === 'true';
    confirmActionsToggle.checked = localStorage.getItem('crm_confirm_actions') !== 'false';
    compactModeToggle.checked = localStorage.getItem('crm_compact_mode') === 'true';
    
    if (compactModeToggle.checked) {
        document.body.classList.add('compact-mode');
    }
    
    notificationsToggle.addEventListener('change', () => {
        localStorage.setItem('crm_notifications', notificationsToggle.checked);
        console.log('[profile] Настройка уведомлений:', notificationsToggle.checked);
    });
    
    confirmActionsToggle.addEventListener('change', () => {
        localStorage.setItem('crm_confirm_actions', confirmActionsToggle.checked);
        console.log('[profile] Настройка подтверждения действий:', confirmActionsToggle.checked);
    });
    
    compactModeToggle.addEventListener('change', () => {
        localStorage.setItem('crm_compact_mode', compactModeToggle.checked);
        if (compactModeToggle.checked) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
        console.log('[profile] Компактный режим:', compactModeToggle.checked);
    });
    
    console.log('[profile] Настройки загружены');
}

// ========== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ДЛЯ HTML ==========

// Экспортируем функции в window для доступа из onclick в HTML
window.closeEditModal = closeEditModal;
window.saveProfileChanges = saveProfileChanges;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

/**
 * Главная функция инициализации страницы
 */
export async function initProfilePage() {
    console.log('[profile] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[profile] Текущий пользователь:', currentUser?.name, 'роль:', currentUser?.role);
    
    await loadUserProfile();
    await loadUserTasks();
    updateProfileUI();
    loadSettings();
    
    document.getElementById('editProfileBtn').addEventListener('click', openEditModal);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[profile] Анимации инициализированы');
    }
    
    console.log('[profile] Инициализация завершена');
}