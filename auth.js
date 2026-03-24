
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

// Инициализация авторизации (для теста используем выпадающий список)
async function initAuth() {
    const users = await loadUsers();
    
    if (users.length === 0) {
        console.warn('Нет пользователей в системе');
        return null;
    }
    
    const userSelect = document.getElementById('userSelect');
    const userNameSpan = document.getElementById('userName');
    
    if (userSelect) {
        // Заполняем выпадающий список
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.github_username;
            option.textContent = `${user.name} (${user.role})`;
            userSelect.appendChild(option);
        });
        
        // Обработчик выбора пользователя
        userSelect.addEventListener('change', (e) => {
            const selectedUser = users.find(u => u.github_username === e.target.value);
            if (selectedUser) {
                currentUser = selectedUser;
                updateUserInterface();
            }
        });
        
        // Выбираем первого пользователя по умолчанию
        if (users[0]) {
            userSelect.value = users[0].github_username;
            currentUser = users[0];
            updateUserInterface();
        }
        
        userSelect.style.display = 'block';
    }
    
    return currentUser;
}

// Обновление интерфейса в зависимости от пользователя
function updateUserInterface() {
    const userNameSpan = document.getElementById('userName');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userNameSpan && currentUser) {
        userNameSpan.textContent = `${currentUser.name} (${currentUser.role})`;
    }
    
    if (welcomeMessage && currentUser) {
        welcomeMessage.textContent = `Добро пожаловать, ${currentUser.name}! Ваша роль: ${currentUser.role}`;
    }
    
    // Скрываем/показываем элементы в зависимости от роли
    document.querySelectorAll('[data-role]').forEach(el => {
        const requiredRoles = el.dataset.role.split(',');
        const hasAccess = requiredRoles.includes(currentUser.role);
        el.style.display = hasAccess ? '' : 'none';
    });
}

// Экспорт функций (для глобального доступа)
window.auth = {
    initAuth,
    hasPermission,
    hasRole,
    getCurrentUser: () => currentUser
};
