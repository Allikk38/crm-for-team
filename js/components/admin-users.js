/**
 * ============================================
 * ФАЙЛ: js/components/admin-users.js
 * РОЛЬ: Компонент управления пользователями в админ-панели
 * 
 * ФУНКЦИОНАЛ:
 *   - Просмотр списка пользователей
 *   - Добавление нового пользователя
 *   - Изменение роли пользователя
 *   - Сброс пин-кода
 *   - Удаление пользователя
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из admin.html в отдельный компонент
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[admin-users] Компонент загружен');

export class AdminUsers {
    constructor(container) {
        this.container = container;
        this.users = [];
        this.currentUser = null;
        this.isLoading = false;
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========

    async loadUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            this.users = data;
            console.log(`[admin-users] Загружено ${this.users.length} пользователей`);
        } else {
            console.error('[admin-users] Ошибка загрузки:', error);
            this.users = [];
        }
    }

    // ========== CRUD ОПЕРАЦИИ ==========

    async createUser(userData) {
        const tempPin = this.generateRandomPin();
        const tempEmail = userData.email || `${userData.username}@temp.com`;

        // Создаём пользователя в auth.users
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: tempEmail,
            password: tempPin,
            options: {
                data: {
                    full_name: userData.name,
                    github_username: userData.username
                }
            }
        });

        if (authError) {
            throw new Error(authError.message);
        }

        if (authData.user) {
            // Добавляем профиль
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    github_username: userData.username,
                    name: userData.name,
                    role: userData.role,
                    email: tempEmail,
                    permission_sets: this.getDefaultPermissionSets(userData.role)
                }]);

            if (profileError) {
                throw new Error(profileError.message);
            }

            return { success: true, tempPin };
        }

        throw new Error('Неизвестная ошибка');
    }

    async updateUserRole(userId, newRole) {
        const permissionSets = this.getDefaultPermissionSets(newRole);

        const { error } = await supabase
            .from('profiles')
            .update({ 
                role: newRole, 
                permission_sets: permissionSets,
                updated_at: new Date().toISOString() 
            })
            .eq('id', userId);

        if (error) throw error;
        return true;
    }

    async resetUserPin(userId) {
        const newPin = this.generateRandomPin();

        // В реальной системе нужно обновить пароль в auth.users
        // Здесь сохраняем в profiles для демо
        const { error } = await supabase
            .from('profiles')
            .update({ pin: newPin, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) throw error;
        return { success: true, newPin };
    }

    async deleteUser(userId) {
        // Удаляем профиль
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) throw profileError;

        // В реальной системе нужно удалить и из auth.users
        return true;
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    generateRandomPin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    getDefaultPermissionSets(role) {
        switch (role) {
            case 'admin': return ['ADMIN', 'MANAGER', 'AGENT', 'BASE'];
            case 'manager': return ['MANAGER', 'AGENT', 'BASE'];
            case 'agent': return ['AGENT', 'BASE'];
            default: return ['BASE'];
        }
    }

    getRoleLabel(role) {
        const labels = {
            admin: 'Администратор',
            manager: 'Менеджер',
            agent: 'Агент',
            viewer: 'Наблюдатель'
        };
        return labels[role] || role;
    }

    getRoleBadgeClass(role) {
        const classes = {
            admin: 'role-admin',
            manager: 'role-manager',
            agent: 'role-agent',
            viewer: 'role-viewer'
        };
        return classes[role] || '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ========== РЕНДЕРИНГ ==========

    async render() {
        this.currentUser = getCurrentSupabaseUser();
        await this.loadUsers();

        this.container.innerHTML = `
            <div class="admin-section">
                <div class="section-header">
                    <h2><i class="fas fa-users"></i> Пользователи системы</h2>
                    <button class="btn btn-primary" id="addUserBtn">
                        <i class="fas fa-plus"></i> Добавить пользователя
                    </button>
                </div>

                <div class="users-table-wrapper">
                    ${this.renderTable()}
                </div>
            </div>

            ${this.renderAddUserModal()}
            ${this.renderResetPinModal()}
        `;

        this.attachEvents();
        this.addStyles();
    }

    renderTable() {
        if (this.users.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Нет пользователей</p>
                </div>
            `;
        }

        return `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Пользователь</th>
                        <th>Email</th>
                        <th>Роль</th>
                        <th>Дата регистрации</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.users.map(user => this.renderUserRow(user)).join('')}
                </tbody>
            </table>
        `;
    }

    renderUserRow(user) {
        const canDelete = user.id !== this.currentUser?.id;
        const isAdmin = user.role === 'admin';

        return `
            <tr data-user-id="${user.id}">
                <td>
                    <div class="user-name-cell">
                        <div class="user-avatar-small">
                            ${this.getInitials(user.name)}
                        </div>
                        <div>
                            <strong>${this.escapeHtml(user.name)}</strong>
                            <div class="user-username">@${this.escapeHtml(user.github_username || '—')}</div>
                        </div>
                    </div>
                </td>
                <td>${this.escapeHtml(user.email || '—')}</td>
                <td>
                    <select class="role-select" data-user-id="${user.id}" ${isAdmin && user.id === this.currentUser?.id ? 'disabled' : ''}>
                        <option value="agent" ${user.role === 'agent' ? 'selected' : ''}>Агент</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Наблюдатель</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn reset-pin-btn" data-user-id="${user.id}" data-user-name="${this.escapeHtml(user.name)}" title="Сбросить пин-код">
                            <i class="fas fa-key"></i>
                        </button>
                        ${canDelete ? `
                            <button class="action-btn danger delete-user-btn" data-user-id="${user.id}" data-user-name="${this.escapeHtml(user.name)}" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    renderAddUserModal() {
        return `
            <div id="addUserModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-plus"></i> Добавить пользователя</h3>
                        <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Логин (github_username)</label>
                            <input type="text" id="newUsername" placeholder="ivan_agent" required>
                        </div>
                        <div class="form-group">
                            <label>Полное имя</label>
                            <input type="text" id="newName" placeholder="Иван Петров" required>
                        </div>
                        <div class="form-group">
                            <label>Email (необязательно)</label>
                            <input type="email" id="newEmail" placeholder="ivan@example.com">
                        </div>
                        <div class="form-group">
                            <label>Роль</label>
                            <select id="newRole">
                                <option value="agent">Агент</option>
                                <option value="manager">Менеджер</option>
                                <option value="viewer">Наблюдатель</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Отмена</button>
                        <button class="btn btn-primary" id="confirmAddUserBtn">Создать</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderResetPinModal() {
        return `
            <div id="resetPinModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-key"></i> Сброс пин-кода</h3>
                        <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>Вы уверены, что хотите сбросить пин-код для пользователя <strong id="resetUserName"></strong>?</p>
                        <p class="hint">Новый пин-код будет сгенерирован автоматически.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Отмена</button>
                        <button class="btn btn-primary" id="confirmResetPinBtn">Сбросить</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

    attachEvents() {
        // Кнопка добавления пользователя
        this.container.querySelector('#addUserBtn')?.addEventListener('click', () => {
            this.openModal('addUserModal');
        });

        // Подтверждение добавления
        this.container.querySelector('#confirmAddUserBtn')?.addEventListener('click', async () => {
            await this.handleAddUser();
        });

        // Подтверждение сброса пин-кода
        this.container.querySelector('#confirmResetPinBtn')?.addEventListener('click', async () => {
            await this.handleResetPin();
        });

        // Изменение роли
        this.container.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = select.dataset.userId;
                const newRole = select.value;
                await this.handleRoleChange(userId, newRole);
            });
        });

        // Сброс пин-кода
        this.container.querySelectorAll('.reset-pin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                this.openResetPinModal(userId, userName);
            });
        });

        // Удаление пользователя
        this.container.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                await this.handleDeleteUser(userId, userName);
            });
        });

        // Закрытие модалок по клику вне
        this.container.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

    openModal(modalId) {
        const modal = this.container.querySelector(`#${modalId}`);
        if (modal) {
            modal.classList.add('active');
        }
    }

    openResetPinModal(userId, userName) {
        const modal = this.container.querySelector('#resetPinModal');
        const nameSpan = this.container.querySelector('#resetUserName');
        if (modal && nameSpan) {
            nameSpan.textContent = userName;
            modal.dataset.userId = userId;
            modal.classList.add('active');
        }
    }

    async handleAddUser() {
        const username = this.container.querySelector('#newUsername')?.value.trim();
        const name = this.container.querySelector('#newName')?.value.trim();
        const role = this.container.querySelector('#newRole')?.value;
        const email = this.container.querySelector('#newEmail')?.value.trim();

        if (!username || !name) {
            this.showToast('Заполните логин и имя', 'warning');
            return;
        }

        try {
            const result = await this.createUser({ username, name, role, email });
            
            if (result.success) {
                this.showToast(`✅ Пользователь создан! Пин-код: ${result.tempPin}`, 'success');
                this.container.querySelector('#addUserModal')?.classList.remove('active');
                
                // Очищаем форму
                this.container.querySelector('#newUsername').value = '';
                this.container.querySelector('#newName').value = '';
                this.container.querySelector('#newEmail').value = '';
                
                await this.refresh();
            }
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    async handleRoleChange(userId, newRole) {
        try {
            await this.updateUserRole(userId, newRole);
            this.showToast('Роль обновлена', 'success');
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
            await this.refresh();
        }
    }

    async handleResetPin() {
        const modal = this.container.querySelector('#resetPinModal');
        const userId = modal?.dataset.userId;

        if (!userId) return;

        try {
            const result = await this.resetUserPin(userId);
            
            if (result.success) {
                this.showToast(`✅ Пин-код сброшен! Новый: ${result.newPin}`, 'success');
                modal.classList.remove('active');
                await this.refresh();
            }
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    async handleDeleteUser(userId, userName) {
        if (!confirm(`Удалить пользователя "${userName}"? Это действие необратимо.`)) {
            return;
        }

        try {
            await this.deleteUser(userId);
            this.showToast('Пользователь удалён', 'success');
            await this.refresh();
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ДЛЯ UI ==========

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    addStyles() {
        if (document.querySelector('#admin-users-styles')) return;

        const style = document.createElement('style');
        style.id = 'admin-users-styles';
        style.textContent = `
            .admin-section {
                background: var(--card-bg);
                border-radius: 20px;
                border: 1px solid var(--card-border);
                overflow: hidden;
            }

            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid var(--card-border);
            }

            .section-header h2 {
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .users-table-wrapper {
                overflow-x: auto;
            }

            .users-table {
                width: 100%;
                border-collapse: collapse;
            }

            .users-table th,
            .users-table td {
                padding: 16px 20px;
                text-align: left;
                border-bottom: 1px solid var(--card-border);
            }

            .users-table th {
                background: var(--hover-bg);
                font-weight: 600;
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--text-muted);
            }

            .users-table tbody tr:hover {
                background: rgba(108, 108, 255, 0.05);
            }

            .user-name-cell {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .user-avatar-small {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 14px;
            }

            .user-username {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            .role-select {
                padding: 6px 12px;
                background: var(--input-bg);
                border: 1px solid var(--card-border);
                border-radius: 8px;
                color: var(--text-primary);
                font-size: 0.85rem;
                cursor: pointer;
            }

            .action-buttons {
                display: flex;
                gap: 8px;
            }

            .action-btn {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: transparent;
                border: 1px solid var(--card-border);
                color: var(--text-muted);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .action-btn:hover {
                background: rgba(108, 108, 255, 0.15);
                color: var(--accent);
                border-color: var(--accent);
            }

            .action-btn.danger:hover {
                background: rgba(255, 107, 107, 0.15);
                color: #ff6b6b;
                border-color: #ff6b6b;
            }

            .empty-state {
                text-align: center;
                padding: 60px;
                color: var(--text-muted);
            }

            .empty-state i {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .hint {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-top: 8px;
            }

            .btn {
                padding: 10px 20px;
                border-radius: 40px;
                border: none;
                cursor: pointer;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
            }

            .btn-primary {
                background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                color: white;
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(108, 108, 255, 0.4);
            }

            .btn-secondary {
                background: transparent;
                border: 1px solid var(--card-border);
                color: var(--text-primary);
            }

            .btn-secondary:hover {
                background: var(--hover-bg);
            }

            .form-group {
                margin-bottom: 16px;
            }

            .form-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 0.85rem;
                color: var(--text-muted);
            }

            .form-group input,
            .form-group select {
                width: 100%;
                padding: 12px 16px;
                background: var(--input-bg);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                color: var(--text-primary);
                font-size: 0.95rem;
            }

            .form-group input:focus,
            .form-group select:focus {
                outline: none;
                border-color: var(--accent);
            }

            @media (max-width: 768px) {
                .section-header {
                    flex-direction: column;
                    gap: 16px;
                }

                .users-table th,
                .users-table td {
                    padding: 12px;
                }

                .user-name-cell {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ========== ОБНОВЛЕНИЕ ==========

    async refresh() {
        await this.render();
    }

    destroy() {
        console.log('[admin-users] Компонент уничтожен');
        this.container.innerHTML = '';
    }
}

export default AdminUsers;
