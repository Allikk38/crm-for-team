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
 *   - js/core/permissions.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из profile-supabase.html
 *   - 09.04.2026: Переход с role на permission_sets для отображения
 *   - 09.04.2026: Убраны глобальные функции
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface
} from '../core/supabase-session.js';
import { getTasks } from '../services/tasks-supabase.js';
import { isAdmin, getUserPermissions } from '../core/permissions.js';

// Состояние страницы
let currentUser = null;
let tasks = [];

console.log('[profile.js] Модуль загружен');

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ПОЛУЧЕНИЕ МЕТКИ РОЛИ ПО ПРАВАМ ==========

function getUserRoleLabel() {
    if (!currentUser) return 'Сотрудник';
    
    // Определяем по permission_sets
    const permissionSets = currentUser.permission_sets || [];
    
    if (permissionSets.includes('ADMIN') || isAdmin()) {
        return 'Администратор';
    }
    if (permissionSets.includes('MANAGER')) {
        return 'Менеджер';
    }
    if (permissionSets.includes('AGENT')) {
        return 'Агент';
    }
    
    // Fallback на старую роль
    const roleLabels = {
        'admin': 'Администратор',
        'manager': 'Менеджер',
        'agent': 'Агент',
        'viewer': 'Наблюдатель'
    };
    return roleLabels[currentUser.role] || 'Сотрудник';
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

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
        currentUser.permission_sets = data.permission_sets || currentUser.permission_sets;
        console.log('[profile] Профиль загружен:', { name: currentUser.name });
    } else if (error) {
        console.error('[profile] Ошибка загрузки профиля:', error);
    }
}

async function loadUserTasks() {
    console.log('[profile] Загрузка задач пользователя...');
    tasks = await getTasks();
    console.log(`[profile] Загружено ${tasks.length} задач`);
    updateStats();
    updateRecentTasks();
    updateActivityChart();
}

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
}

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
}

function updateProfileUI() {
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const githubEl = document.getElementById('profileGithub');
    const roleEl = document.getElementById('profileRole');
    const avatarEl = document.getElementById('profileAvatar');
    
    if (!nameEl) return;
    
    nameEl.textContent = currentUser.name;
    emailEl.textContent = currentUser.email;
    if (githubEl) githubEl.textContent = currentUser.github_username || '—';
    
    // Используем новую функцию для получения метки роли
    if (roleEl) roleEl.textContent = getUserRoleLabel();
    
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    if (avatarEl) avatarEl.innerHTML = initials || '<i class="fas fa-user"></i>';
    
    // Отображаем permission_sets
    renderPermissionSets();
    
    console.log('[profile] UI обновлен, имя:', currentUser.name);
}

function renderPermissionSets() {
    const container = document.getElementById('permissionSetsContainer');
    if (!container) return;
    
    const permissionSets = currentUser.permission_sets || [];
    
    if (permissionSets.length === 0) {
        container.innerHTML = '<span class="profile-info-item"><i class="fas fa-shield"></i>Базовые права</span>';
        return;
    }
    
    const setLabels = {
        'BASE': '🔹 Базовый',
        'AGENT': '🤵 Агент',
        'MANAGER': '📊 Менеджер',
        'ADMIN': '👑 Администратор'
    };
    
    container.innerHTML = permissionSets.map(set => {
        const label = setLabels[set] || set;
        return `<span class="profile-info-item"><i class="fas fa-check-circle" style="color: #4caf50;"></i>${escapeHtml(label)}</span>`;
    }).join('');
}

// ========== МОДАЛЬНОЕ ОКНО ==========

let modal = null;
let modalCloseHandler = null;

function createModal() {
    if (modal) return;
    
    modal = document.createElement('div');
    modal.id = 'editProfileModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <h3><i class="fas fa-edit"></i> Редактировать профиль</h3>
            <input type="text" id="editName" placeholder="Имя">
            <div class="modal-buttons">
                <button class="secondary modal-cancel">Отмена</button>
                <button class="primary modal-save">Сохранить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики
    modal.querySelector('.modal-cancel').addEventListener('click', closeEditModal);
    modal.querySelector('.modal-save').addEventListener('click', saveProfileChanges);
    
    modalCloseHandler = (e) => {
        if (e.target === modal) closeEditModal();
    };
    modal.addEventListener('click', modalCloseHandler);
}

function openEditModal() {
    if (!modal) createModal();
    
    document.getElementById('editName').value = currentUser.name;
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeEditModal() {
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

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
    } else {
        console.error('[profile] Ошибка сохранения:', error);
        alert('Ошибка сохранения');
    }
}

// ========== НАСТРОЙКИ ==========

function loadSettings() {
    const notificationsToggle = document.getElementById('notificationsToggle');
    const confirmActionsToggle = document.getElementById('confirmActionsToggle');
    const compactModeToggle = document.getElementById('compactModeToggle');
    
    if (!notificationsToggle) return;
    
    notificationsToggle.checked = localStorage.getItem('crm_notifications') === 'true';
    confirmActionsToggle.checked = localStorage.getItem('crm_confirm_actions') !== 'false';
    compactModeToggle.checked = localStorage.getItem('crm_compact_mode') === 'true';
    
    if (compactModeToggle.checked) {
        document.body.classList.add('compact-mode');
    }
    
    notificationsToggle.addEventListener('change', () => {
        localStorage.setItem('crm_notifications', notificationsToggle.checked);
    });
    
    confirmActionsToggle.addEventListener('change', () => {
        localStorage.setItem('crm_confirm_actions', confirmActionsToggle.checked);
    });
    
    compactModeToggle.addEventListener('change', () => {
        localStorage.setItem('crm_compact_mode', compactModeToggle.checked);
        if (compactModeToggle.checked) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initProfilePage() {
    console.log('[profile] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[profile] Текущий пользователь:', currentUser?.name);
    
    await loadUserProfile();
    await loadUserTasks();
    updateProfileUI();
    loadSettings();
    
    // Навешиваем обработчик на кнопку редактирования
    document.getElementById('editProfileBtn')?.addEventListener('click', openEditModal);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[profile] Инициализация завершена');
}
