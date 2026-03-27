/**
 * ============================================
 * ФАЙЛ: js/pages/admin.js
 * РОЛЬ: Логика страницы управления пользователями (админ-панель)
 * 
 * ОСОБЕННОСТИ:
 *   - Список всех пользователей
 *   - Создание нового пользователя
 *   - Сброс пин-кода
 *   - Изменение роли пользователя
 *   - Удаление пользователя
 *   - Только для администраторов
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из admin-supabase.html
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';

// Состояние страницы
let usersList = [];
let currentAdmin = null;

console.log('[admin.js] Модуль загружен');

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

function generateRandomPin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function getRoleLabel(role) {
    const labels = {
        admin: 'Администратор',
        manager: 'Менеджер',
        agent: 'Агент',
        viewer: 'Наблюдатель'
    };
    return labels[role] || role;
}

// ========== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ==========

async function loadUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (!error && data) {
        usersList = data;
        console.log(`[admin] Загружено ${usersList.length} пользователей`);
        renderUsersTable();
    } else {
        console.error('[admin] Ошибка загрузки пользователей:', error);
        usersList = [];
        renderUsersTable();
    }
}

// ========== РЕНДЕРИНГ ТАБЛИЦЫ ==========

async function updateUserRole(userId, newRole) {
    console.log('[admin] Обновление роли:', userId, '→', newRole);
    
    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
    
    if (!error) {
        await loadUsers();
        showToast('success', 'Роль пользователя обновлена');
    } else {
        console.error('[admin] Ошибка обновления роли:', error);
        showToast('error', 'Ошибка обновления роли');
    }
}

function renderUsersTable() {
    const container = document.getElementById('usersTable');
    if (!container) return;
    
    if (usersList.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>Нет пользователей</p></div>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Логин</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Email</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const user of usersList) {
        const canDelete = user.id !== currentAdmin?.id;
        
        html += `
            <tr data-user-id="${user.id}">
                <td>${escapeHtml(user.github_username || '—')}</td>
                <td>${escapeHtml(user.name)}</td>
                <td>
                    <select class="role-select" data-user-id="${user.id}" onchange="window.changeUserRole('${user.id}', this.value)">
                        <option value="agent" ${user.role === 'agent' ? 'selected' : ''}>Агент</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Наблюдатель</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td>${escapeHtml(user.email || '—')}</td>
                <td>${escapeHtml(user.created_at ? user.created_at.split('T')[0] : '—')}</td>
                <td>
                    <button class="action-btn" onclick="window.openResetPinModal('${user.id}', '${escapeHtml(user.name)}')" title="Сбросить пин-код">
                        <i class="fas fa-key"></i>
                    </button>
                    ${canDelete ? `
                    <button class="action-btn danger" onclick="window.deleteUser('${user.id}')" title="Удалить пользователя">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    console.log('[admin] Таблица отрисована');
}

// ========== CRUD ОПЕРАЦИИ ==========

async function createUser(username, name, role, email) {
    console.log('[admin] Создание пользователя:', username);
    
    const tempPin = generateRandomPin();
    const tempEmail = email || `${username}@temp.com`;
    
    // Создаем пользователя в auth.users
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: tempEmail,
        password: tempPin,
        options: {
            data: { 
                full_name: name,
                github_username: username
            }
        }
    });
    
    if (authError) {
        console.error('[admin] Ошибка создания auth пользователя:', authError);
        return { success: false, error: authError.message };
    }
    
    if (authData.user) {
        // Добавляем профиль
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                github_username: username,
                name: name,
                role: role,
                email: tempEmail,
                created_at: new Date().toISOString()
            }]);
        
        if (profileError) {
            console.error('[admin] Ошибка создания профиля:', profileError);
            return { success: false, error: profileError.message };
        }
        
        console.log('[admin] Пользователь создан, ID:', authData.user.id);
        return { success: true, tempPin: tempPin };
    }
    
    return { success: false, error: 'Неизвестная ошибка' };
}

async function resetUserPin(userId) {
    const newPin = generateRandomPin();
    console.log('[admin] Сброс пин-кода для пользователя:', userId);
    
    const { error } = await supabase
        .from('profiles')
        .update({ pin: newPin, updated_at: new Date().toISOString() })
        .eq('id', userId);
    
    if (!error) {
        return { success: true, newPin };
    }
    
    console.error('[admin] Ошибка сброса пин-кода:', error);
    return { success: false, error: 'Ошибка сброса пин-кода' };
}

async function deleteUserById(userId) {
    console.log('[admin] Удаление пользователя:', userId);
    
    // Удаляем профиль
    const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
    
    if (profileError) {
        console.error('[admin] Ошибка удаления профиля:', profileError);
        return { success: false, error: profileError.message };
    }
    
    return { success: true };
}

// ========== МОДАЛЬНЫЕ ОКНА ==========

function openAddUserModal() {
    const modal = document.getElementById('addUserModal');
    modal.style.display = 'flex';
    console.log('[admin] Открыто модальное окно добавления пользователя');
}

function closeAddUserModal() {
    const modal = document.getElementById('addUserModal');
    modal.style.display = 'none';
    document.getElementById('newUsername').value = '';
    document.getElementById('newName').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('newRole').value = 'agent';
}

async function addUser() {
    const username = document.getElementById('newUsername').value.trim();
    const name = document.getElementById('newName').value.trim();
    const role = document.getElementById('newRole').value;
    const email = document.getElementById('newEmail').value.trim();
    
    if (!username || !name) {
        showToast('warning', 'Заполните логин и имя');
        return;
    }
    
    console.log('[admin] Добавление пользователя:', { username, name, role, email });
    
    const result = await createUser(username, name, role, email);
    
    if (result.success) {
        showToast('success', `Пользователь создан! Пин-код: ${result.tempPin}`, 5000);
        closeAddUserModal();
        await loadUsers();
        
        // Подсвечиваем новую строку
        setTimeout(() => {
            const newRow = document.querySelector('tr:last-child');
            if (newRow) newRow.classList.add('table-row-highlight');
        }, 100);
    } else {
        showToast('error', result.error || 'Ошибка создания');
    }
}

function openResetPinModal(userId, userName) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('resetUserName').textContent = userName;
    const modal = document.getElementById('resetPinModal');
    modal.style.display = 'flex';
    console.log('[admin] Открыто модальное окно сброса пин-кода для:', userName);
}

function closeResetPinModal() {
    const modal = document.getElementById('resetPinModal');
    modal.style.display = 'none';
}

async function resetPin() {
    const userId = document.getElementById('resetUserId').value;
    console.log('[admin] Сброс пин-кода для пользователя:', userId);
    
    const result = await resetUserPin(userId);
    
    if (result.success) {
        showToast('success', `Пин-код сброшен! Новый пин-код: ${result.newPin}`, 5000);
        closeResetPinModal();
        await loadUsers();
    } else {
        showToast('error', result.error || 'Ошибка сброса');
    }
}

async function deleteUser(userId) {
    const user = usersList.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${user.name}"? Это действие необратимо.`)) return;
    
    console.log('[admin] Удаление пользователя:', user.name);
    
    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (row) row.classList.add('row-removing');
    
    setTimeout(async () => {
        const result = await deleteUserById(userId);
        if (result.success) {
            showToast('success', 'Пользователь удалён');
            await loadUsers();
        } else {
            showToast('error', result.error || 'Ошибка удаления');
            if (row) row.classList.remove('row-removing');
        }
    }, 200);
}

// ========== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ДЛЯ HTML ==========

window.changeUserRole = async (userId, newRole) => {
    await updateUserRole(userId, newRole);
};

window.openResetPinModal = openResetPinModal;
window.closeResetPinModal = closeResetPinModal;
window.resetPin = resetPin;
window.deleteUser = deleteUser;
window.openAddUserModal = openAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.addUser = addUser;

// ========== ИНИЦИАЛИЗАЦИЯ ==========

export async function initAdminPage() {
    console.log('[admin] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('auth-supabase.html');
    if (!isAuth) return;
    
    currentAdmin = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    console.log('[admin] Текущий пользователь:', currentAdmin?.name, 'роль:', currentAdmin?.role);
    
    // Проверка прав доступа (только администратор)
    if (currentAdmin.role !== 'admin') {
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
    
    await loadUsers();
    
    // Обработчики кнопок
    document.getElementById('addUserBtn')?.addEventListener('click', openAddUserModal);
    document.getElementById('confirmAddUserBtn')?.addEventListener('click', addUser);
    document.getElementById('confirmResetPinBtn')?.addEventListener('click', resetPin);
    
    // Закрытие модальных окон по клику вне
    window.onclick = function(event) {
        const addModal = document.getElementById('addUserModal');
        const resetModal = document.getElementById('resetPinModal');
        if (event.target === addModal) closeAddUserModal();
        if (event.target === resetModal) closeResetPinModal();
    };
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    if (window.CRM?.ui?.animations) {
        console.log('[admin] Анимации инициализированы');
    }
    
    console.log('[admin] Инициализация завершена');
}