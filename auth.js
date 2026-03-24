// auth.js - управление пользователями и ролями

let currentUser = null;

// Роли и их права
const ROLES = {
    admin: ['view', 'edit', 'delete', 'manage_users'],
    manager: ['view', 'edit'],
    agent: ['view', 'edit_own'],
    viewer: ['view']
};

// Загрузка пользователей из CSV
async function loadUsers() {
    const users = await loadCSV('data/users.csv');
    return users;
}

// Проверка прав пользователя
function hasPermission(permission) {
    if (!currentUser) return false;
    const userRole = currentUser.role;
    return ROLES[userRole] && ROLES[userRole].includes(permission);
}

// Проверка роли
function hasRole(role) {
    return currentUser && currentUser.role === role;
}

// Проверка сессии
function checkSession() {
    const session = localStorage.getItem('crm_session');
    if (session) {
        try {
            currentUser = JSON.parse(session);
            return currentUser;
        } catch(e) {
            return null;
        }
    }
    return null;
}

// Инициализация авторизации
async function initAuth() {
    // Проверяем сессию
    const sessionUser = checkSession();
    if (sessionUser) {
        // Проверяем, не изменилась ли роль в users.csv
        const users = await loadUsers();
        const updatedUser = users.find(u => u.github_username === sessionUser.github_username);
        if (updatedUser) {
            currentUser = {
                github_username: updatedUser.github_username,
                name: updatedUser.name,
                role: updatedUser.role,
                email: updatedUser.email || ''
            };
            // Обновляем сессию
            localStorage.setItem('crm_session', JSON.stringify(currentUser));
        } else {
            currentUser = sessionUser;
        }
        
        updateUserInterface();
        return currentUser;
    }
    
    // Нет сессии — перенаправляем на страницу входа
    if (!window.location.pathname.includes('auth.html')) {
        window.location.href = 'auth.html';
    }
    
    return null;
}

// Выход из системы
function logout() {
    localStorage.removeItem('crm_session');
    window.location.href = 'auth.html';
}

// Обновление интерфейса в зависимости от пользователя
function updateUserInterface() {
    const userNameSpan = document.getElementById('userName');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userNameSpan && currentUser) {
        userNameSpan.innerHTML = `<i class="fab fa-github"></i> ${currentUser.name} (${getRoleLabel(currentUser.role)})`;
    }
    
    if (welcomeMessage && currentUser) {
        welcomeMessage.textContent = `Добро пожаловать, ${currentUser.name}! Ваша роль: ${getRoleLabel(currentUser.role)}`;
    }
    
    // Скрываем/показываем элементы в зависимости от роли
    document.querySelectorAll('[data-role]').forEach(el => {
        const requiredRoles = el.dataset.role.split(',');
        const hasAccess = requiredRoles.includes(currentUser.role);
        el.style.display = hasAccess ? '' : 'none';
    });
    
    // Добавляем кнопку выхода, если её нет
    if (!document.getElementById('logoutBtn') && currentUser) {
        const navButtons = document.querySelector('.nav-buttons');
        if (navButtons) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'nav-btn';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Выйти';
            logoutBtn.style.marginLeft = 'auto';
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

// Экспорт функций
window.auth = {
    initAuth,
    hasPermission,
    hasRole,
    getCurrentUser: () => currentUser,
    logout
};
