/**
 * ============================================
 * ФАЙЛ: auth.js
 * РОЛЬ: Управление авторизацией и сессиями
 * СВЯЗИ:
 *   - core.js: loadCSV(), utils.saveCSVToGitHub()
 *   - Данные: data/users.csv (хранение пользователей и пин-кодов)
 * МЕХАНИКА:
 *   1. Проверка входа по имени + пин-коду
 *   2. Отправка magic link (заглушка, требует бэкенд)
 *   3. Управление сессией в localStorage
 *   4. Ролевая модель (admin, manager, agent, viewer)
 *   5. Сброс пин-кода при первом входе
 *   6. Автоматическое создание временного пин-кода для новых пользователей
 * ============================================
 */

let currentUser = null;

// Роли и их права
const ROLES = {
    admin: ['view', 'edit', 'delete', 'manage_users'],
    manager: ['view', 'edit'],
    agent: ['view', 'edit_own'],
    viewer: ['view']
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
    
    return await window.utils.saveCSVToGitHub(
        'data/users.csv',
        users,
        'Update users by ' + currentUserAuth.name
    );
}

// Вход по имени и пин-коду
async function loginWithPin(username, pin) {
    const users = await loadUsers();
    const user = users.find(u => u.github_username === username);
    
    if (!user) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    // Проверка пин-кода
    const storedPin = user.pin || '1234'; // временный код по умолчанию
    
    if (pin !== storedPin) {
        return { success: false, error: 'Неверный пин-код' };
    }
    
    // Если это первый вход (пин-код по умолчанию), требуем сменить
    if (pin === '1234' && (!user.pin || user.pin === '1234')) {
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
    const storedPin = user.pin || '1234';
    
    if (oldPin !== storedPin) {
        return { success: false, error: 'Неверный текущий пин-код' };
    }
    
    users[userIndex].pin = newPin;
    const saved = await saveUsers(users);
    
    if (saved) {
        return { success: true };
    } else {
        return { success: false, error: 'Ошибка сохранения' };
    }
}

// Отправка magic link (заглушка — требует бэкенд)
async function sendMagicLink(email) {
    const users = await loadUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return { success: false, error: 'Пользователь с таким email не найден' };
    }
    
    // Генерируем уникальный токен
    const token = btoa(user.github_username + ':' + Date.now());
    const link = window.location.origin + '/crm-for-team/callback.html?token=' + token;
    
    // В реальной реализации здесь был бы вызов API для отправки email
    console.log('Magic link:', link);
    
    // Показываем ссылку в консоли (для демо)
    alert('Для демонстрации: ссылка для входа\n' + link);
    
    // Сохраняем токен в localStorage для проверки
    localStorage.setItem('magic_token_' + token, user.github_username);
    setTimeout(() => {
        localStorage.removeItem('magic_token_' + token);
    }, 30 * 60 * 1000); // 30 минут
    
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
    currentUser = user;
}

// Проверка сессии
function checkSession() {
    const sessionData = localStorage.getItem('crm_session');
    if (!sessionData) return null;
    
    try {
        const session = JSON.parse(sessionData);
        if (session.expires && session.expires > Date.now()) {
            currentUser = session.user;
            return currentUser;
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
    currentUser = null;
    window.location.href = 'auth.html';
}

// Получить текущего пользователя
function getCurrentUser() {
    if (currentUser) return currentUser;
    return checkSession();
}

// Проверка прав пользователя
function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const userRole = user.role;
    return ROLES[userRole] && ROLES[userRole].includes(permission);
}

// Проверка роли
function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}

// Обновление интерфейса (вызывается после входа)
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
    
    // Скрываем/показываем элементы в зависимости от роли
    document.querySelectorAll('[data-role]').forEach(el => {
        const requiredRoles = el.dataset.role.split(',');
        const hasAccess = requiredRoles.includes(user.role);
        el.style.display = hasAccess ? '' : 'none';
    });
    
    // Добавляем кнопку выхода, если её нет
    if (!document.getElementById('logoutBtn')) {
        const navButtons = document.querySelector('.nav-buttons');
        if (navButtons) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'nav-btn';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Выйти';
            logoutBtn.onclick = logout;
            navButtons.appendChild(logoutBtn);
        }
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация авторизации (проверка сессии при загрузке)
async function initAuth() {
    const user = checkSession();
    if (user) {
        currentUser = user;
        updateUserInterface();
        return user;
    }
    
    // Если нет сессии и мы не на странице входа — перенаправляем
    if (!window.location.pathname.includes('auth.html') && 
        !window.location.pathname.includes('callback.html')) {
        window.location.href = 'auth.html';
    }
    
    return null;
}

// Экспорт
window.auth = {
    initAuth,
    loginWithPin,
    changePin,
    sendMagicLink,
    verifyMagicToken,
    saveSession,
    checkSession,
    logout,
    getCurrentUser,
    hasPermission,
    hasRole,
    updateUserInterface
};
