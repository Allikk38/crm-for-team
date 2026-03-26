/**
 * ============================================
 * ФАЙЛ: js/core/auth.js
 * РОЛЬ: Управление авторизацией и сессиями
 * ЗАВИСИМОСТИ:
 *   - js/core/api.js (loadCSV, saveCSVToGitHub)
 *   - js/utils/helpers.js (escapeHtml)
 * ИСПОЛЬЗУЕТСЯ В: всех защищённых страницах
 * ============================================
 */

window.CRM = window.CRM || {};
window.CRM.auth = {};

// Глобальная переменная для текущего пользователя (только в auth.js)
let currentUserData = null;

// Роли и их права
const ROLES = {
    admin: {
        name: 'Администратор',
        permissions: ['view_all', 'edit_all', 'delete_all', 'manage_users', 'view_manager_panel']
    },
    manager: {
        name: 'Менеджер',
        permissions: ['view_all_tasks', 'view_all_complexes', 'edit_assigned', 'view_manager_panel']
    },
    agent: {
        name: 'Агент',
        permissions: ['view_own_tasks', 'view_public_tasks', 'edit_own_tasks', 'view_own_complexes']
    },
    viewer: {
        name: 'Наблюдатель',
        permissions: ['view_public_tasks', 'view_public_complexes']
    }
};

// Загрузка пользователей
async function loadUsers() {
    try {
        const users = await loadCSV('data/users.csv');
        return users || [];
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return [];
    }
}

// Сохранение пользователей
async function saveUsers(users) {
    const currentUserAuth = getCurrentUser();
    if (!currentUserAuth || !hasPermission('manage_users')) {
        console.error('Нет прав на сохранение пользователей');
        return false;
    }
    
    return await saveCSVToGitHub(
        'data/users.csv',
        users,
        'Update users by ' + currentUserAuth.name
    );
}

// Создание нового пользователя (только для admin)
async function createUser(username, name, role, email) {
    const current = getCurrentUser();
    if (!current || !hasPermission('manage_users')) {
        return { success: false, error: 'Недостаточно прав' };
    }
    
    if (!username || !name || !role) {
        return { success: false, error: 'Заполните все обязательные поля' };
    }
    
    const users = await loadUsers();
    
    if (users.find(u => u.github_username === username)) {
        return { success: false, error: 'Пользователь с таким логином уже существует' };
    }
    
    const tempPin = Math.floor(1000 + Math.random() * 9000).toString();
    
    const newUser = {
        github_username: username,
        name: name,
        role: role,
        email: email || '',
        pin: tempPin,
        created_at: new Date().toISOString().split('T')[0]
    };
    
    users.push(newUser);
    const saved = await saveUsers(users);
    
    if (saved) {
        return { 
            success: true, 
            user: newUser,
            tempPin: tempPin
        };
    }
    
    return { success: false, error: 'Ошибка сохранения' };
}

// Получить всех пользователей
async function getUsers() {
    const users = await loadUsers();
    const current = getCurrentUser();
    
    if (!current) return [];
    
    if (current.role === 'admin') {
        return users;
    }
    
    if (current.role === 'manager') {
        return users.filter(u => u.role === 'agent' || u.github_username === current.github_username);
    }
    
    return users.filter(u => u.github_username === current.github_username);
}

// Вход по имени и пин-коду
async function loginWithPin(username, pin) {
    const users = await loadUsers();
    const user = users.find(u => u.github_username === username);
    
    if (!user) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    const storedPin = String(user.pin || '1234');
    const inputPin = String(pin);
    
    if (inputPin !== storedPin) {
        return { success: false, error: 'Неверный пин-код' };
    }
    
    if (storedPin === '1234' && (!user.pin_changed || user.pin_changed !== 'true')) {
        return { 
            success: false, 
            error: 'Это ваш первый вход. Пожалуйста, смените пин-код',
            needChange: true,
            user: {
                github_username: user.github_username,
                name: user.name,
                role: user.role,
                email: user.email || ''
            }
        };
    }
    
    return {
        success: true,
        user: {
            github_username: user.github_username,
            name: user.name,
            role: user.role,
            email: user.email || '',
            pin: user.pin
        }
    };
}

// Смена пин-кода
async function changePin(username, oldPin, newPin) {
    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
        return { success: false, error: 'Пин-код должен быть 4 цифры' };
    }
    
    const users = await loadUsers();
    const userIndex = users.findIndex(u => u.github_username === username);
    
    if (userIndex === -1) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    const user = users[userIndex];
    const storedPin = String(user.pin || '1234');
    
    if (String(oldPin) !== storedPin) {
        return { success: false, error: 'Неверный текущий пин-код' };
    }
    
    users[userIndex].pin = newPin;
    users[userIndex].pin_changed = 'true';
    const saved = await saveUsers(users);
    
    if (saved) {
        return { success: true };
    } else {
        return { success: false, error: 'Ошибка сохранения' };
    }
}

// Сброс пин-кода (только для админа)
async function resetPin(username) {
    const current = getCurrentUser();
    if (!current || !hasPermission('manage_users')) {
        return { success: false, error: 'Недостаточно прав' };
    }
    
    const users = await loadUsers();
    const userIndex = users.findIndex(u => u.github_username === username);
    
    if (userIndex === -1) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    users[userIndex].pin = newPin;
    delete users[userIndex].pin_changed;
    
    const saved = await saveUsers(users);
    
    if (saved) {
        return { success: true, newPin: newPin };
    }
    
    return { success: false, error: 'Ошибка сохранения' };
}

// Отправка magic link
async function sendMagicLink(email) {
    const users = await loadUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return { success: false, error: 'Пользователь с таким email не найден' };
    }
    
    const token = btoa(user.github_username + ':' + Date.now());
    const link = window.location.origin + '/crm-for-team/callback.html?token=' + token;
    
    console.log('Magic link:', link);
    alert('Для демонстрации: ссылка для входа\n' + link);
    
    localStorage.setItem('magic_token_' + token, user.github_username);
    setTimeout(() => {
        localStorage.removeItem('magic_token_' + token);
    }, 30 * 60 * 1000);
    
    return { success: true };
}

// Проверка magic link токена
async function verifyMagicToken(token) {
    const username = localStorage.getItem('magic_token_' + token);
    if (!username) return null;
    
    const users = await loadUsers();
    const user = users.find(u => u.github_username === username);
    
    if (!user) return null;
    
    localStorage.removeItem('magic_token_' + token);
    
    return {
        github_username: user.github_username,
        name: user.name,
        role: user.role,
        email: user.email || ''
    };
}

// Сохранение сессии
function saveSession(user, days = 7) {
    const session = {
        user: user,
        expires: Date.now() + (days * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem('crm_session', JSON.stringify(session));
    currentUserData = user;
}

// Проверка сессии
function checkSession() {
    const sessionData = localStorage.getItem('crm_session');
    if (!sessionData) return null;
    
    try {
        const session = JSON.parse(sessionData);
        if (session.expires && session.expires > Date.now()) {
            currentUserData = session.user;
            return currentUserData;
        } else {
            localStorage.removeItem('crm_session');
            return null;
        }
    } catch(e) {
        localStorage.removeItem('crm_session');
        return null;
    }
}

// Выход из системы
function logout() {
    localStorage.removeItem('crm_session');
    currentUserData = null;
    window.location.href = 'auth.html';
}

// Получить текущего пользователя
function getCurrentUser() {
    if (currentUserData) return currentUserData;
    return checkSession();
}

// Проверка прав пользователя
function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const userRole = user.role;
    const rolePermissions = ROLES[userRole];
    return rolePermissions && rolePermissions.permissions.includes(permission);
}

// Проверка роли
function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}

// Фильтрация задач по правам пользователя
function filterTasksByPermissions(tasks) {
    const user = getCurrentUser();
    if (!user) return [];
    
    if (user.role === 'admin' || user.role === 'manager') {
        return tasks;
    }
    
    if (user.role === 'agent') {
        return tasks.filter(task => {
            return task.assigned_to === user.github_username || 
                   task.is_private !== 'true';
        });
    }
    
    return tasks.filter(task => task.is_private !== 'true');
}

// Фильтрация объектов по правам пользователя
function filterComplexesByPermissions(complexes) {
    const user = getCurrentUser();
    if (!user) return [];
    
    if (user.role === 'admin' || user.role === 'manager') {
        return complexes;
    }
    
    if (user.role === 'agent') {
        return complexes.filter(complex => {
            return complex.assignee === user.github_username || 
                   complex.is_public === 'true';
        });
    }
    
    return complexes.filter(complex => complex.is_public === 'true');
}

// Обновление интерфейса
function updateUserInterface() {
    const user = getCurrentUser();
    if (!user) return;
    
    const userNameSpan = document.getElementById('userName');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userNameSpan) {
        const roleLabel = getRoleLabel(user.role);
        userNameSpan.innerHTML = '<i class="fas fa-user-circle"></i> ' + escapeHtml(user.name) + ' (' + roleLabel + ')';
    }
    
    if (welcomeMessage) {
        welcomeMessage.textContent = 'Добро пожаловать, ' + user.name + '! Ваша роль: ' + getRoleLabel(user.role);
    }
    
    document.querySelectorAll('[data-role]').forEach(el => {
        const requiredRoles = el.dataset.role.split(',');
        const hasAccess = requiredRoles.includes(user.role);
        el.style.display = hasAccess ? '' : 'none';
    });
    
    const managerBtn = document.querySelector('a[href="manager.html"]');
    if (managerBtn) {
        managerBtn.style.display = (user.role === 'admin' || user.role === 'manager') ? '' : 'none';
    }
    
    const adminBtn = document.querySelector('a[href="admin.html"]');
    if (adminBtn) {
        adminBtn.style.display = user.role === 'admin' ? '' : 'none';
    }
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

// Инициализация авторизации
async function initAuth() {
    const user = checkSession();
    if (user) {
        currentUserData = user;
        updateUserInterface();
        return user;
    }
    
    const isAuthPage = window.location.pathname.includes('auth.html') || 
                       window.location.pathname.includes('callback.html');
    if (!isAuthPage) {
        window.location.href = 'auth.html';
    }
    
    return null;
}

// Экспорт
window.CRM.auth = {
    initAuth,
    loginWithPin,
    changePin,
    resetPin,
    createUser,
    getUsers,
    sendMagicLink,
    verifyMagicToken,
    saveSession,
    checkSession,
    logout,
    getCurrentUser,
    hasPermission,
    hasRole,
    filterTasksByPermissions,
    filterComplexesByPermissions,
    updateUserInterface
};

// Для обратной совместимости
window.auth = window.CRM.auth;

console.log('[auth.js] Загружен');
