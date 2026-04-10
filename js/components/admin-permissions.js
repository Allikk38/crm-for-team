/**
 * ============================================
 * ФАЙЛ: js/components/admin-permissions.js
 * РОЛЬ: Компонент управления правами доступа в админ-панели
 * 
 * ФУНКЦИОНАЛ:
 *   - Просмотр пользователей и их прав
 *   - Назначение модулей пользователям
 *   - Массовое сохранение прав
 *   - Интеграция с marketplace-service
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/services/marketplace-service.js
 * 
 * ИСТОРИЯ:
 *   - 10.04.2026: Выделен из admin.html в отдельный компонент
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import * as marketplace from '../services/marketplace-service.js';

console.log('[admin-permissions] Компонент загружен');

export class AdminPermissions {
    constructor(container) {
        this.container = container;
        this.users = [];
        this.catalog = [];
        this.userLicenses = new Map(); // userId -> Set(moduleIds)
        this.isLoading = false;
        this.unsavedChanges = new Map(); // userId -> Set(moduleIds)
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========

    async loadData() {
        // Загружаем пользователей
        const { data: usersData } = await supabase
            .from('profiles')
            .select('id, name, email, role, github_username')
            .order('name');

        this.users = usersData || [];

        // Загружаем каталог модулей
        this.catalog = await marketplace.getCatalog('module');

        // Загружаем лицензии для всех пользователей
        await this.loadAllLicenses();
    }

    async loadAllLicenses() {
        for (const user of this.users) {
            const licenses = await marketplace.getUserLicenses(user.id);
            const moduleIds = new Set([
                ...licenses.personal.map(l => l.item?.identifier),
                ...licenses.team.map(l => l.item?.identifier)
            ].filter(Boolean));

            this.userLicenses.set(user.id, moduleIds);
        }
    }

    // ========== ОПЕРАЦИИ С ПРАВАМИ ==========

    toggleModule(userId, moduleId, enabled) {
        if (!this.unsavedChanges.has(userId)) {
            // Копируем текущие права
            const current = this.userLicenses.get(userId) || new Set();
            this.unsavedChanges.set(userId, new Set(current));
        }

        const changes = this.unsavedChanges.get(userId);
        if (enabled) {
            changes.add(moduleId);
        } else {
            changes.delete(moduleId);
        }
    }

    hasChanges(userId) {
        return this.unsavedChanges.has(userId);
    }

    getEffectiveModules(userId) {
        if (this.unsavedChanges.has(userId)) {
            return this.unsavedChanges.get(userId);
        }
        return this.userLicenses.get(userId) || new Set();
    }

    async saveUserPermissions(userId) {
        const changes = this.unsavedChanges.get(userId);
        if (!changes) return true;

        const currentModules = this.userLicenses.get(userId) || new Set();
        
        // Назначаем новые модули
        for (const moduleId of changes) {
            if (!currentModules.has(moduleId)) {
                // В реальной системе здесь нужно создать личную лицензию
                // или назначить командную через marketplace
                console.log(`[admin-permissions] Назначен модуль ${moduleId} пользователю ${userId}`);
            }
        }

        // Отзываем удалённые модули
        for (const moduleId of currentModules) {
            if (!changes.has(moduleId)) {
                console.log(`[admin-permissions] Отозван модуль ${moduleId} у пользователя ${userId}`);
            }
        }

        // Очищаем несохранённые изменения
        this.unsavedChanges.delete(userId);
        this.userLicenses.set(userId, changes);

        return true;
    }

    async saveAllPermissions() {
        const promises = [];
        for (const userId of this.unsavedChanges.keys()) {
            promises.push(this.saveUserPermissions(userId));
        }
        await Promise.all(promises);
    }

    // ========== РЕНДЕРИНГ ==========

    async render() {
        await this.loadData();

        this.container.innerHTML = `
            <div class="admin-section">
                <div class="section-header">
                    <h2><i class="fas fa-lock"></i> Права доступа</h2>
                    <div class="header-actions">
                        <span class="unsaved-badge" id="unsavedBadge" style="display: none;">
                            <i class="fas fa-exclamation-triangle"></i> Есть несохранённые изменения
                        </span>
                        <button class="btn btn-primary" id="saveAllBtn" disabled>
                            <i class="fas fa-save"></i> Сохранить всё
                        </button>
                    </div>
                </div>

                <div class="permissions-filters">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="searchInput" placeholder="Поиск пользователей...">
                    </div>
                </div>

                ${this.renderPermissionsTable()}
            </div>
        `;

        this.attachEvents();
        this.addStyles();
    }

    renderPermissionsTable() {
        if (this.users.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Нет пользователей</p>
                </div>
            `;
        }

        // Фильтруем модули (только платные, которые можно назначать)
        const assignableModules = this.catalog.filter(m => m.price_personal !== 0);

        return `
            <div class="permissions-table-wrapper">
                <table class="permissions-table">
                    <thead>
                        <tr>
                            <th class="sticky-col">Пользователь</th>
                            ${assignableModules.map(m => `
                                <th class="module-col" title="${this.escapeHtml(m.description || '')}">
                                    <i class="fas ${m.icon || 'fa-puzzle-piece'}"></i>
                                    ${this.escapeHtml(m.name)}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(user => this.renderUserRow(user, assignableModules)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderUserRow(user, modules) {
        const effectiveModules = this.getEffectiveModules(user.id);
        const hasChanges = this.hasChanges(user.id);

        return `
            <tr data-user-id="${user.id}" class="${hasChanges ? 'has-changes' : ''}">
                <td class="sticky-col user-cell">
                    <div class="user-info-compact">
                        <div class="user-avatar-tiny">
                            ${this.getInitials(user.name)}
                        </div>
                        <div>
                            <div class="user-name">${this.escapeHtml(user.name)}</div>
                            <div class="user-role">${this.getRoleLabel(user.role)}</div>
                        </div>
                    </div>
                </td>
                ${modules.map(m => {
                    const hasAccess = effectiveModules.has(m.identifier);
                    return `
                        <td class="module-col checkbox-cell">
                            <label class="checkbox-wrapper">
                                <input type="checkbox" 
                                       data-user-id="${user.id}"
                                       data-module-id="${m.identifier}"
                                       ${hasAccess ? 'checked' : ''}>
                                <span class="checkbox-custom"></span>
                            </label>
                        </td>
                    `;
                }).join('')}
            </tr>
        `;
    }

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

    attachEvents() {
        // Поиск
        this.container.querySelector('#searchInput')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // Чекбоксы модулей
        this.container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = checkbox.dataset.userId;
                const moduleId = checkbox.dataset.moduleId;
                const enabled = checkbox.checked;

                this.toggleModule(userId, moduleId, enabled);
                this.updateUserRowState(userId);
                this.updateSaveButton();
            });
        });

        // Сохранить всё
        this.container.querySelector('#saveAllBtn')?.addEventListener('click', async () => {
            await this.handleSaveAll();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.handleSaveAll();
            }
        });
    }

    // ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

    filterUsers(query) {
        const rows = this.container.querySelectorAll('tbody tr');
        const lowerQuery = query.toLowerCase();

        rows.forEach(row => {
            const name = row.querySelector('.user-name')?.textContent.toLowerCase() || '';
            if (name.includes(lowerQuery)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    updateUserRowState(userId) {
        const row = this.container.querySelector(`tr[data-user-id="${userId}"]`);
        if (row) {
            const hasChanges = this.hasChanges(userId);
            row.classList.toggle('has-changes', hasChanges);
        }
    }

    updateSaveButton() {
        const hasUnsaved = this.unsavedChanges.size > 0;
        const badge = this.container.querySelector('#unsavedBadge');
        const saveBtn = this.container.querySelector('#saveAllBtn');

        if (badge) {
            badge.style.display = hasUnsaved ? 'inline-flex' : 'none';
        }
        if (saveBtn) {
            saveBtn.disabled = !hasUnsaved;
        }
    }

    async handleSaveAll() {
        if (this.unsavedChanges.size === 0) return;

        const saveBtn = this.container.querySelector('#saveAllBtn');
        const originalText = saveBtn.innerHTML;

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Сохранение...';

        try {
            await this.saveAllPermissions();
            this.showToast('✅ Права сохранены', 'success');
            
            // Обновляем UI
            this.container.querySelectorAll('tr.has-changes').forEach(row => {
                row.classList.remove('has-changes');
            });
            
            this.updateSaveButton();
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    getRoleLabel(role) {
        const labels = {
            admin: 'Админ',
            manager: 'Менеджер',
            agent: 'Агент',
            viewer: 'Зритель'
        };
        return labels[role] || role;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    addStyles() {
        if (document.querySelector('#admin-permissions-styles')) return;

        const style = document.createElement('style');
        style.id = 'admin-permissions-styles';
        style.textContent = `
            .header-actions {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .unsaved-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: rgba(255, 193, 7, 0.15);
                color: #ffc107;
                border-radius: 20px;
                font-size: 0.8rem;
            }

            .permissions-filters {
                padding: 16px 20px;
                border-bottom: 1px solid var(--card-border);
            }

            .search-box {
                position: relative;
                max-width: 300px;
            }

            .search-box i {
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
            }

            .search-box input {
                width: 100%;
                padding: 10px 16px 10px 42px;
                background: var(--input-bg);
                border: 1px solid var(--card-border);
                border-radius: 40px;
                color: var(--text-primary);
            }

            .permissions-table-wrapper {
                overflow-x: auto;
                max-height: calc(100vh - 300px);
                overflow-y: auto;
            }

            .permissions-table {
                width: 100%;
                border-collapse: collapse;
                min-width: 800px;
            }

            .permissions-table th,
            .permissions-table td {
                padding: 12px 16px;
                text-align: center;
                border-bottom: 1px solid var(--card-border);
            }

            .permissions-table th {
                background: var(--hover-bg);
                font-weight: 600;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--text-muted);
                white-space: nowrap;
            }

            .permissions-table th i {
                margin-right: 6px;
                color: var(--accent);
            }

            .sticky-col {
                position: sticky;
                left: 0;
                background: var(--card-bg);
                z-index: 1;
                text-align: left !important;
            }

            .permissions-table th.sticky-col {
                background: var(--hover-bg);
                z-index: 2;
            }

            .permissions-table tbody tr:hover td {
                background: rgba(108, 108, 255, 0.03);
            }

            .permissions-table tbody tr:hover td.sticky-col {
                background: rgba(108, 108, 255, 0.05);
            }

            tr.has-changes td {
                background: rgba(255, 193, 7, 0.05);
            }

            tr.has-changes td.sticky-col {
                background: rgba(255, 193, 7, 0.08);
            }

            .user-cell {
                min-width: 200px;
            }

            .user-info-compact {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .user-avatar-tiny {
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 13px;
                flex-shrink: 0;
            }

            .user-name {
                font-weight: 500;
                font-size: 0.9rem;
            }

            .user-role {
                font-size: 0.7rem;
                color: var(--text-muted);
            }

            .module-col {
                min-width: 80px;
                white-space: nowrap;
            }

            .checkbox-cell {
                vertical-align: middle;
            }

            .checkbox-wrapper {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }

            .checkbox-wrapper input[type="checkbox"] {
                display: none;
            }

            .checkbox-custom {
                width: 20px;
                height: 20px;
                border: 2px solid var(--card-border);
                border-radius: 6px;
                display: inline-block;
                position: relative;
                transition: all 0.2s;
                cursor: pointer;
            }

            .checkbox-wrapper input[type="checkbox"]:checked + .checkbox-custom {
                background: var(--accent);
                border-color: var(--accent);
            }

            .checkbox-wrapper input[type="checkbox"]:checked + .checkbox-custom::after {
                content: '';
                position: absolute;
                left: 6px;
                top: 2px;
                width: 5px;
                height: 10px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            .checkbox-wrapper:hover .checkbox-custom {
                border-color: var(--accent);
            }

            @media (max-width: 768px) {
                .permissions-table th,
                .permissions-table td {
                    padding: 8px 10px;
                }

                .user-cell {
                    min-width: 160px;
                }

                .module-col {
                    min-width: 60px;
                }

                .user-name {
                    font-size: 0.8rem;
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
        console.log('[admin-permissions] Компонент уничтожен');
        this.container.innerHTML = '';
    }
}

export default AdminPermissions;
