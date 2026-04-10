/**
 * ============================================
 * ФАЙЛ: js/pages/profile.js
 * РОЛЬ: Логика страницы профиля (НОВАЯ ВЕРСИЯ)
 * 
 * ФУНКЦИОНАЛ:
 *   - Загрузка и отображение профиля
 *   - Загрузка аватара
 *   - Смена пароля
 *   - Статистика продуктивности (помидоры, задачи, streak)
 *   - Мои модули (личные и командные)
 *   - Лог активности
 *   - Настройки интерфейса
 *   - Удаление аккаунта
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/marketplace-service.js
 *   - js/services/pomodoro.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла
 *   - 10.04.2026: ПОЛНАЯ ПЕРЕРАБОТКА — новый функционал
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser, requireSupabaseAuth, updateSupabaseUserInterface, refreshUserProfile } from '../core/supabase-session.js';
import * as marketplace from '../services/marketplace-service.js';
import { getStats } from '../services/pomodoro.js';

console.log('[profile-page] Загрузка...');

// ========== СОСТОЯНИЕ ==========

let currentUser = null;
let userProfile = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initProfilePage() {
    console.log('[profile-page] Инициализация...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    await loadUserProfile();
    
    // Рендеринг всех секций
    renderProfileInfo();
    renderProductivityStats();
    renderMyModules();
    renderRecentActivity();
    renderInterfaceSettings();
    
    // Привязка событий
    bindEvents();
    
    console.log('[profile-page] Инициализация завершена');
}

// ========== ЗАГРУЗКА ПРОФИЛЯ ==========

async function loadUserProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (!error && data) {
        userProfile = data;
        currentUser = { ...currentUser, ...data };
    }
}

// ========== РЕНДЕРИНГ ИНФОРМАЦИИ ==========

function renderProfileInfo() {
    const container = document.getElementById('profileInfo');
    if (!container) return;
    
    const roleLabels = {
        admin: 'Администратор',
        manager: 'Менеджер',
        agent: 'Агент',
        viewer: 'Наблюдатель'
    };
    
    container.innerHTML = `
        <div class="info-item">
            <div class="info-icon"><i class="fas fa-user"></i></div>
            <div class="info-content">
                <div class="info-label">Имя</div>
                <div class="info-value">
                    <span id="displayName">${escapeHtml(currentUser.name || '—')}</span>
                    <button class="edit-btn" id="editNameBtn">
                        <i class="fas fa-pen"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="info-item">
            <div class="info-icon"><i class="fas fa-envelope"></i></div>
            <div class="info-content">
                <div class="info-label">Email</div>
                <div class="info-value">${escapeHtml(currentUser.email || '—')}</div>
            </div>
        </div>
        
        <div class="info-item">
            <div class="info-icon"><i class="fas fa-badge"></i></div>
            <div class="info-content">
                <div class="info-label">Роль</div>
                <div class="info-value">${roleLabels[currentUser.role] || currentUser.role}</div>
            </div>
        </div>
        
        <div class="info-item">
            <div class="info-icon"><i class="fab fa-github"></i></div>
            <div class="info-content">
                <div class="info-label">GitHub</div>
                <div class="info-value">${escapeHtml(currentUser.github_username || '—')}</div>
            </div>
        </div>
        
        <div class="info-item">
            <div class="info-icon"><i class="fas fa-calendar"></i></div>
            <div class="info-content">
                <div class="info-label">Дата регистрации</div>
                <div class="info-value">${formatDate(currentUser.created_at)}</div>
            </div>
        </div>
    `;
    
    // Аватар
    updateAvatar();
}

function updateAvatar() {
    const initials = getInitials(currentUser.name);
    const avatarInitials = document.getElementById('avatarInitials');
    const profileAvatar = document.getElementById('profileAvatar');
    
    if (avatarInitials) {
        avatarInitials.textContent = initials;
    }
    
    // Если есть аватар в профиле
    if (userProfile?.avatar_url) {
        if (profileAvatar && profileAvatar.tagName === 'IMG') {
            profileAvatar.src = userProfile.avatar_url;
        } else if (profileAvatar) {
            const img = document.createElement('img');
            img.id = 'profileAvatar';
            img.className = 'profile-avatar';
            img.src = userProfile.avatar_url;
            img.alt = currentUser.name;
            profileAvatar.replaceWith(img);
        }
    }
}

// ========== СТАТИСТИКА ПРОДУКТИВНОСТИ ==========

async function renderProductivityStats() {
    // Помидоры сегодня
    const pomodoroStats = getStats(1);
    const todayPomodoros = pomodoroStats[0]?.sessions || 0;
    document.getElementById('pomodoroCount').textContent = todayPomodoros;
    
    // Завершённые задачи
    const { count: tasksCompleted } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('status', 'completed');
    
    document.getElementById('tasksCompleted').textContent = tasksCompleted || 0;
    
    // Streak дней (из помидоро-статистики)
    const streak = calculateStreak(pomodoroStats);
    document.getElementById('activeStreak').textContent = streak;
    
    if (streak >= 3) {
        const badge = document.getElementById('streakBadge');
        const text = document.getElementById('streakText');
        if (badge && text) {
            badge.style.display = 'inline-flex';
            text.textContent = `🔥 ${streak} дней продуктивности!`;
        }
    }
}

function calculateStreak(stats) {
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    // Проверяем активность за последние 30 дней
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayStats = stats.find(s => s.date === dateStr);
        if (dayStats && dayStats.sessions > 0) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    
    return streak;
}

// ========== МОИ МОДУЛИ ==========

async function renderMyModules() {
    const container = document.getElementById('myModules');
    if (!container) return;
    
    try {
        const licenses = await marketplace.getUserLicenses();
        
        const allModules = [
            ...licenses.personal.map(l => ({ ...l, source: 'personal' })),
            ...licenses.team.map(l => ({ ...l, source: 'team' }))
        ];
        
        // Убираем дубликаты (если модуль есть и личный, и командный)
        const uniqueModules = [];
        const seen = new Set();
        for (const m of allModules) {
            const key = m.item?.identifier;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueModules.push(m);
            }
        }
        
        if (uniqueModules.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-puzzle-piece"></i>
                    <p>Нет активных модулей</p>
                    <a href="marketplace.html" style="margin-top: 12px; display: inline-block; color: var(--accent);">
                        Перейти в маркетплейс →
                    </a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = uniqueModules.slice(0, 5).map(m => {
            const item = m.item || {};
            const isPersonal = m.source === 'personal';
            
            return `
                <div class="module-item">
                    <div class="module-icon">
                        <i class="fas ${item.icon || 'fa-puzzle-piece'}"></i>
                    </div>
                    <div class="module-info">
                        <div class="module-name">${escapeHtml(item.name || 'Модуль')}</div>
                        <div class="module-source">
                            ${isPersonal ? '👤 Личная' : '👥 Командная'}
                        </div>
                    </div>
                    <span class="module-badge ${isPersonal ? '' : 'team'}">
                        ${isPersonal ? 'Активна' : 'Активна'}
                    </span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('[profile] Ошибка загрузки модулей:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки</p>
            </div>
        `;
    }
}

// ========== ЛОГ АКТИВНОСТИ ==========

async function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    try {
        const activities = await getRecentActivity(currentUser.id);
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Нет недавней активности</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="activity-list">
                ${activities.map(a => `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas ${a.icon}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">${escapeHtml(a.text)}</div>
                            <div class="activity-time">${formatTimeAgo(a.time)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('[profile] Ошибка загрузки активности:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки</p>
            </div>
        `;
    }
}

async function getRecentActivity(userId, limit = 10) {
    const activities = [];
    
    // Задачи (созданные)
    const { data: tasks } = await supabase
        .from('tasks')
        .select('title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    tasks?.forEach(t => {
        activities.push({
            icon: 'fa-plus-circle',
            text: `Создал задачу «${t.title}»`,
            time: t.created_at
        });
    });
    
    // Задачи (завершённые)
    const { data: completedTasks } = await supabase
        .from('tasks')
        .select('title, completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(limit);
    
    completedTasks?.forEach(t => {
        activities.push({
            icon: 'fa-check-circle',
            text: `Завершил задачу «${t.title}»`,
            time: t.completed_at
        });
    });
    
    // Лицензии
    const { data: licenses } = await supabase
        .from('licenses')
        .select('purchased_at, item:item_id(name)')
        .eq('buyer_user_id', userId)
        .order('purchased_at', { ascending: false })
        .limit(limit);
    
    licenses?.forEach(l => {
        activities.push({
            icon: 'fa-shopping-cart',
            text: `Купил модуль «${l.item?.name || 'Модуль'}»`,
            time: l.purchased_at
        });
    });
    
    // Сортируем по времени
    return activities
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, limit);
}

// ========== НАСТРОЙКИ ИНТЕРФЕЙСА ==========

function renderInterfaceSettings() {
    const themeToggle = document.getElementById('themeToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    const compactModeToggle = document.getElementById('compactModeToggle');
    
    // Тема
    const savedTheme = localStorage.getItem('crm_theme') || 'dark';
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            localStorage.setItem('crm_theme', newTheme);
            applyTheme(newTheme);
        });
    }
    
    // Уведомления
    if (notificationsToggle) {
        notificationsToggle.checked = localStorage.getItem('crm_notifications') !== 'false';
        notificationsToggle.addEventListener('change', () => {
            localStorage.setItem('crm_notifications', notificationsToggle.checked);
        });
    }
    
    // Компактный режим
    if (compactModeToggle) {
        compactModeToggle.checked = localStorage.getItem('crm_compact_mode') === 'true';
        compactModeToggle.addEventListener('change', () => {
            localStorage.setItem('crm_compact_mode', compactModeToggle.checked);
            document.body.classList.toggle('compact-mode', compactModeToggle.checked);
        });
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

function bindEvents() {
    // Аватар
    document.getElementById('avatarWrapper')?.addEventListener('click', () => {
        document.getElementById('avatarInput')?.click();
    });
    
    document.getElementById('avatarInput')?.addEventListener('change', handleAvatarUpload);
    
    // Редактирование имени
    document.getElementById('editNameBtn')?.addEventListener('click', openEditNameModal);
    document.getElementById('confirmEditBtn')?.addEventListener('click', saveName);
    
    // Смена пароля
    document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
        openModal('changePasswordModal');
    });
    
    document.getElementById('confirmPasswordBtn')?.addEventListener('click', changePassword);
    
    // 2FA
    document.getElementById('setup2FABtn')?.addEventListener('click', () => {
        showToast('🔐 Двухфакторная аутентификация будет доступна в следующем обновлении', 'info');
    });
    
    // Сессии
    document.getElementById('manageSessionsBtn')?.addEventListener('click', () => {
        showToast('📱 Управление сессиями будет доступно в следующем обновлении', 'info');
    });
    
    // Выход на всех устройствах
    document.getElementById('logoutAllBtn')?.addEventListener('click', logoutAll);
    
    // Удаление аккаунта
    document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteAccount);
    
    // Загрузка количества сессий
    loadSessionCount();
}

// ========== ЗАГРУЗКА АВАТАРА ==========

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Проверка размера (макс 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('❌ Файл слишком большой (макс 2MB)', 'error');
        return;
    }
    
    // Проверка типа
    if (!file.type.startsWith('image/')) {
        showToast('❌ Только изображения', 'error');
        return;
    }
    
    try {
        showToast('⏳ Загрузка аватара...', 'info');
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/avatar.${fileExt}`;
        
        // Загружаем в Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        // Получаем публичный URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
        
        // Обновляем профиль
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);
        
        if (updateError) throw updateError;
        
        userProfile.avatar_url = publicUrl;
        updateAvatar();
        showToast('✅ Аватар обновлён', 'success');
        
    } catch (error) {
        console.error('[profile] Ошибка загрузки аватара:', error);
        showToast('❌ Ошибка загрузки аватара', 'error');
    }
    
    // Очищаем input
    event.target.value = '';
}

// ========== РЕДАКТИРОВАНИЕ ИМЕНИ ==========

function openEditNameModal() {
    document.getElementById('editName').value = currentUser.name || '';
    openModal('editProfileModal');
}

async function saveName() {
    const newName = document.getElementById('editName').value.trim();
    
    if (!newName) {
        showToast('❌ Имя не может быть пустым', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ name: newName })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        currentUser.name = newName;
        document.getElementById('displayName').textContent = newName;
        updateAvatar();
        updateSupabaseUserInterface();
        
        closeModal('editProfileModal');
        showToast('✅ Имя обновлено', 'success');
        
    } catch (error) {
        console.error('[profile] Ошибка обновления имени:', error);
        showToast('❌ Ошибка обновления имени', 'error');
    }
}

// ========== СМЕНА ПАРОЛЯ ==========

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('❌ Заполните все поля', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('❌ Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('❌ Пароли не совпадают', 'error');
        return;
    }
    
    try {
        // Сначала аутентифицируем пользователя
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            showToast('❌ Неверный текущий пароль', 'error');
            return;
        }
        
        // Меняем пароль
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (updateError) throw updateError;
        
        closeModal('changePasswordModal');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showToast('✅ Пароль изменён', 'success');
        
    } catch (error) {
        console.error('[profile] Ошибка смены пароля:', error);
        showToast('❌ Ошибка смены пароля', 'error');
    }
}

// ========== ВЫХОД НА ВСЕХ УСТРОЙСТВАХ ==========

async function logoutAll() {
    if (!confirm('Выйти на всех устройствах? Придётся заново войти везде.')) return;
    
    try {
        await supabase.auth.signOut({ scope: 'global' });
        window.location.href = '../auth-supabase.html?logout=all';
    } catch (error) {
        console.error('[profile] Ошибка выхода:', error);
        showToast('❌ Ошибка выхода', 'error');
    }
}

// ========== УДАЛЕНИЕ АККАУНТА ==========

async function deleteAccount() {
    const step1 = confirm('⚠️ Вы уверены? Это действие НЕОБРАТИМО. Все ваши данные будут удалены.');
    if (!step1) return;
    
    const step2 = prompt('Введите "УДАЛИТЬ" для подтверждения:');
    if (step2 !== 'УДАЛИТЬ') {
        showToast('❌ Подтверждение неверное. Отмена.', 'error');
        return;
    }
    
    const password = prompt('Введите ваш пароль для подтверждения:');
    if (!password) return;
    
    try {
        // Проверяем пароль
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: password
        });
        
        if (signInError) {
            showToast('❌ Неверный пароль', 'error');
            return;
        }
        
        showToast('⏳ Удаление аккаунта...', 'info');
        
        // Удаляем данные пользователя
        await supabase.from('tasks').delete().eq('user_id', currentUser.id);
        await supabase.from('profiles').delete().eq('id', currentUser.id);
        await supabase.from('licenses').delete().eq('buyer_user_id', currentUser.id);
        
        // Удаляем auth пользователя (требует admin rights, в MVP пропускаем)
        // await supabase.auth.admin.deleteUser(currentUser.id);
        
        // Выходим
        await supabase.auth.signOut();
        window.location.href = '../auth-supabase.html?deleted=true';
        
    } catch (error) {
        console.error('[profile] Ошибка удаления:', error);
        showToast('❌ Ошибка удаления аккаунта', 'error');
    }
}

// ========== СЕССИИ ==========

async function loadSessionCount() {
    try {
        const { data } = await supabase.auth.getSession();
        // В MVP просто показываем 1
        document.getElementById('sessionCount').textContent = '1';
    } catch (e) {
        document.getElementById('sessionCount').textContent = '—';
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '—';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

window.closeModal = closeModal;

// ========== ЭКСПОРТ ==========

export default { initProfilePage };
