/**
 * ============================================
 * ФАЙЛ: js/components/admin-licenses.js
 * РОЛЬ: Компонент управления лицензиями в админ-панели
 * 
 * ФУНКЦИОНАЛ:
 *   - Просмотр лицензий компании
 *   - Отображение использования мест
 *   - Покупка новых лицензий
 *   - Назначение/отзыв лицензий
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

console.log('[admin-licenses] Компонент загружен');

export class AdminLicenses {
    constructor(container) {
        this.container = container;
        this.licenses = [];
        this.catalog = [];
        this.companies = [];
        this.selectedCompanyId = null;
        this.isLoading = false;
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========

    async loadData() {
        // Загружаем компании
        const { data: companiesData } = await supabase
            .from('companies')
            .select('id, name, owner_id')
            .order('created_at', { ascending: false });

        this.companies = companiesData || [];

        if (this.companies.length > 0) {
            this.selectedCompanyId = this.companies[0].id;
        }

        // Загружаем каталог
        this.catalog = await marketplace.getCatalog();

        // Загружаем лицензии
        await this.loadLicenses();
    }

    async loadLicenses() {
        if (!this.selectedCompanyId) {
            this.licenses = [];
            return;
        }

        this.licenses = await marketplace.getCompanyLicenses(this.selectedCompanyId);
    }

    // ========== ОПЕРАЦИИ С ЛИЦЕНЗИЯМИ ==========

    async purchaseLicense(itemIdentifier, licenseType) {
        return await marketplace.purchaseLicense(
            itemIdentifier,
            licenseType,
            this.selectedCompanyId
        );
    }

    async assignLicense(licenseId, userId) {
        return await marketplace.assignLicenseToUser(licenseId, userId);
    }

    async revokeLicense(licenseId, userId) {
        return await marketplace.revokeLicenseFromUser(licenseId, userId);
    }

    // ========== РЕНДЕРИНГ ==========

    async render() {
        await this.loadData();

        this.container.innerHTML = `
            <div class="admin-section">
                <div class="section-header">
                    <h2><i class="fas fa-key"></i> Лицензии компании</h2>
                    <button class="btn btn-primary" id="purchaseLicenseBtn">
                        <i class="fas fa-plus"></i> Купить лицензию
                    </button>
                </div>

                ${this.renderCompanySelector()}
                ${this.renderLicensesList()}
            </div>

            ${this.renderPurchaseModal()}
            ${this.renderAssignModal()}
        `;

        this.attachEvents();
        this.addStyles();
    }

    renderCompanySelector() {
        if (this.companies.length === 0) {
            return `
                <div class="empty-state" style="padding: 40px;">
                    <i class="fas fa-building"></i>
                    <p>Нет компаний в системе</p>
                    <p class="hint">Сначала создайте компанию в разделе «Команда»</p>
                </div>
            `;
        }

        return `
            <div class="company-selector">
                <label><i class="fas fa-building"></i> Выберите компанию</label>
                <select id="companySelect">
                    ${this.companies.map(c => `
                        <option value="${c.id}" ${c.id === this.selectedCompanyId ? 'selected' : ''}>
                            ${this.escapeHtml(c.name)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    renderLicensesList() {
        if (!this.selectedCompanyId) {
            return `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>Выберите компанию для просмотра лицензий</p>
                </div>
            `;
        }

        if (this.licenses.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>У компании нет активных лицензий</p>
                    <button class="btn btn-primary" id="emptyPurchaseBtn" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Купить лицензию
                    </button>
                </div>
            `;
        }

        return `
            <div class="licenses-grid">
                ${this.licenses.map(license => this.renderLicenseCard(license)).join('')}
            </div>
        `;
    }

    renderLicenseCard(license) {
        const item = license.item || {};
        const maxSeats = this.getMaxSeats(license.license_type);
        const assignments = license.assignments || [];
        const usedSeats = assignments.length;
        const percent = maxSeats === 999999 ? Math.min(100, usedSeats * 10) : (usedSeats / maxSeats) * 100;

        const licenseTypeLabels = {
            'personal': '👤 Личная',
            'team_3': '👥 До 3 мест',
            'team_10': '👥 До 10 мест',
            'team_unlimited': '🏢 Безлимит'
        };

        return `
            <div class="license-card" data-license-id="${license.id}">
                <div class="license-card-header">
                    <div class="license-icon">
                        <i class="fas ${item.icon || 'fa-puzzle-piece'}"></i>
                    </div>
                    <div class="license-info">
                        <div class="license-name">
                            ${this.escapeHtml(item.name || 'Модуль')}
                            <span class="license-badge">${licenseTypeLabels[license.license_type] || license.license_type}</span>
                        </div>
                        <div class="license-meta">
                            <span><i class="fas fa-calendar"></i> Куплено: ${this.formatDate(license.purchased_at)}</span>
                            ${license.expires_at ? `
                                <span><i class="fas fa-clock"></i> До: ${this.formatDate(license.expires_at)}</span>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="license-progress">
                    <div class="progress-header">
                        <span>Использовано мест</span>
                        <span>${usedSeats} / ${maxSeats === 999999 ? '∞' : maxSeats}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percent}%"></div>
                    </div>
                </div>

                <div class="assignments-list">
                    <div class="assignments-header">
                        <span>👥 Назначенные пользователи</span>
                        <button class="btn-icon" data-action="assign" data-license-id="${license.id}" title="Назначить пользователя">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    ${this.renderAssignments(license.id, assignments)}
                </div>
            </div>
        `;
    }

    renderAssignments(licenseId, assignments) {
        if (assignments.length === 0) {
            return `
                <div class="no-assignments">
                    <i class="fas fa-users-slash"></i>
                    <span>Нет назначенных пользователей</span>
                </div>
            `;
        }

        return assignments.map(a => {
            const user = a.user || {};
            return `
                <div class="assignment-item">
                    <div class="user-info">
                        <span class="user-name">${this.escapeHtml(user.name || '—')}</span>
                        <span class="user-email">${this.escapeHtml(user.email || '')}</span>
                    </div>
                    <button class="btn-icon danger" data-action="revoke" data-license-id="${licenseId}" data-user-id="${user.id}" title="Отозвать доступ">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    renderPurchaseModal() {
        const availableItems = this.catalog.filter(item => {
            // Исключаем бесплатные модули и уже купленные
            if (item.price_personal === 0) return false;
            return !this.licenses.some(l => l.item?.identifier === item.identifier);
        });

        return `
            <div id="purchaseLicenseModal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3><i class="fas fa-shopping-cart"></i> Купить лицензию</h3>
                        <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${availableItems.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-check-circle"></i>
                                <p>Все доступные модули уже куплены</p>
                            </div>
                        ` : `
                            <div class="form-group">
                                <label>Выберите модуль</label>
                                <select id="purchaseItemSelect">
                                    <option value="">— Выберите —</option>
                                    ${availableItems.map(item => `
                                        <option value="${item.identifier}">${this.escapeHtml(item.name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" id="licenseOptionsGroup" style="display: none;">
                                <label>Тип лицензии</label>
                                <div class="license-options" id="licenseOptions"></div>
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Отмена</button>
                        <button class="btn btn-primary" id="confirmPurchaseBtn" disabled>Купить</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderAssignModal() {
        return `
            <div id="assignLicenseModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-plus"></i> Назначить лицензию</h3>
                        <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Выберите пользователя</label>
                            <select id="assignUserSelect">
                                <option value="">— Загрузка... —</option>
                            </select>
                        </div>
                        <input type="hidden" id="assignLicenseId">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Отмена</button>
                        <button class="btn btn-primary" id="confirmAssignBtn">Назначить</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

    attachEvents() {
        // Выбор компании
        this.container.querySelector('#companySelect')?.addEventListener('change', async (e) => {
            this.selectedCompanyId = e.target.value;
            await this.loadLicenses();
            this.refreshLicensesList();
        });

        // Кнопка покупки
        this.container.querySelector('#purchaseLicenseBtn')?.addEventListener('click', () => {
            this.openPurchaseModal();
        });

        this.container.querySelector('#emptyPurchaseBtn')?.addEventListener('click', () => {
            this.openPurchaseModal();
        });

        // Выбор товара в модалке покупки
        this.container.querySelector('#purchaseItemSelect')?.addEventListener('change', (e) => {
            const identifier = e.target.value;
            this.renderLicenseOptions(identifier);
        });

        // Подтверждение покупки
        this.container.querySelector('#confirmPurchaseBtn')?.addEventListener('click', async () => {
            await this.handlePurchase();
        });

        // Назначение лицензии
        this.container.querySelectorAll('[data-action="assign"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const licenseId = btn.dataset.licenseId;
                this.openAssignModal(licenseId);
            });
        });

        // Отзыв лицензии
        this.container.querySelectorAll('[data-action="revoke"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const licenseId = btn.dataset.licenseId;
                const userId = btn.dataset.userId;
                await this.handleRevoke(licenseId, userId);
            });
        });

        // Подтверждение назначения
        this.container.querySelector('#confirmAssignBtn')?.addEventListener('click', async () => {
            await this.handleAssign();
        });

        // Закрытие модалок
        this.container.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

    openPurchaseModal() {
        const modal = this.container.querySelector('#purchaseLicenseModal');
        if (modal) {
            modal.classList.add('active');
            // Сбрасываем выбор
            const select = this.container.querySelector('#purchaseItemSelect');
            if (select) select.value = '';
            const optionsGroup = this.container.querySelector('#licenseOptionsGroup');
            if (optionsGroup) optionsGroup.style.display = 'none';
            const confirmBtn = this.container.querySelector('#confirmPurchaseBtn');
            if (confirmBtn) confirmBtn.disabled = true;
        }
    }

    renderLicenseOptions(identifier) {
        const item = this.catalog.find(i => i.identifier === identifier);
        if (!item) return;

        const optionsGroup = this.container.querySelector('#licenseOptionsGroup');
        const optionsContainer = this.container.querySelector('#licenseOptions');
        const confirmBtn = this.container.querySelector('#confirmPurchaseBtn');

        if (!optionsGroup || !optionsContainer) return;

        const options = [];
        if (item.price_personal !== null) {
            options.push({ type: 'personal', name: '👤 Личная', price: item.price_personal });
        }
        if (item.price_team_3 !== null) {
            options.push({ type: 'team_3', name: '👥 Командная (до 3 мест)', price: item.price_team_3 });
        }
        if (item.price_team_10 !== null) {
            options.push({ type: 'team_10', name: '👥 Командная (до 10 мест)', price: item.price_team_10 });
        }
        if (item.price_team_unlimited !== null) {
            options.push({ type: 'team_unlimited', name: '🏢 Безлимит', price: item.price_team_unlimited });
        }

        optionsContainer.innerHTML = options.map((opt, index) => `
            <label class="license-option">
                <input type="radio" name="licenseType" value="${opt.type}" ${index === 0 ? 'checked' : ''}>
                <span class="option-name">${opt.name}</span>
                <span class="option-price">${this.formatPrice(opt.price)}</span>
            </label>
        `).join('');

        optionsGroup.style.display = 'block';
        confirmBtn.disabled = false;
    }

    async openAssignModal(licenseId) {
        const modal = this.container.querySelector('#assignLicenseModal');
        const select = this.container.querySelector('#assignUserSelect');
        const hiddenInput = this.container.querySelector('#assignLicenseId');

        if (!modal || !select) return;

        hiddenInput.value = licenseId;

        // Загружаем пользователей компании
        const { data: users } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('company_id', this.selectedCompanyId)
            .order('name');

        // Загружаем уже назначенных пользователей
        const { data: assigned } = await supabase
            .from('license_assignments')
            .select('user_id')
            .eq('license_id', licenseId);

        const assignedIds = new Set((assigned || []).map(a => a.user_id));
        const availableUsers = (users || []).filter(u => !assignedIds.has(u.id));

        if (availableUsers.length === 0) {
            select.innerHTML = '<option value="">Нет доступных пользователей</option>';
        } else {
            select.innerHTML = '<option value="">— Выберите —</option>';
            availableUsers.forEach(u => {
                select.innerHTML += `<option value="${u.id}">${this.escapeHtml(u.name)} (${this.escapeHtml(u.email || '')})</option>`;
            });
        }

        modal.classList.add('active');
    }

    async handlePurchase() {
        const select = this.container.querySelector('#purchaseItemSelect');
        const identifier = select?.value;
        const selectedOption = this.container.querySelector('input[name="licenseType"]:checked');
        const licenseType = selectedOption?.value;

        if (!identifier || !licenseType) {
            this.showToast('Выберите модуль и тип лицензии', 'warning');
            return;
        }

        try {
            await this.purchaseLicense(identifier, licenseType);
            this.showToast('✅ Лицензия куплена', 'success');
            this.container.querySelector('#purchaseLicenseModal')?.classList.remove('active');
            await this.loadLicenses();
            this.refreshLicensesList();
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    async handleAssign() {
        const licenseId = this.container.querySelector('#assignLicenseId')?.value;
        const userId = this.container.querySelector('#assignUserSelect')?.value;

        if (!licenseId || !userId) {
            this.showToast('Выберите пользователя', 'warning');
            return;
        }

        try {
            await this.assignLicense(licenseId, userId);
            this.showToast('✅ Доступ предоставлен', 'success');
            this.container.querySelector('#assignLicenseModal')?.classList.remove('active');
            await this.loadLicenses();
            this.refreshLicensesList();
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    async handleRevoke(licenseId, userId) {
        if (!confirm('Отозвать доступ у пользователя?')) return;

        try {
            await this.revokeLicense(licenseId, userId);
            this.showToast('✅ Доступ отозван', 'success');
            await this.loadLicenses();
            this.refreshLicensesList();
        } catch (error) {
            this.showToast(`❌ Ошибка: ${error.message}`, 'error');
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    refreshLicensesList() {
        const container = this.container.querySelector('.admin-section');
        if (container) {
            const oldList = container.querySelector('.licenses-grid, .empty-state');
            const newContent = this.renderLicensesList();
            
            if (oldList) {
                oldList.outerHTML = newContent;
            } else {
                const companySelector = container.querySelector('.company-selector');
                companySelector.insertAdjacentHTML('afterend', newContent);
            }
            
            this.attachEvents();
        }
    }

    getMaxSeats(licenseType) {
        switch (licenseType) {
            case 'team_3': return 3;
            case 'team_10': return 10;
            case 'team_unlimited': return 999999;
            default: return 1;
        }
    }

    formatPrice(price) {
        if (price === 0) return 'Бесплатно';
        return `${(price / 100).toLocaleString()} ₽`;
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU');
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
        if (document.querySelector('#admin-licenses-styles')) return;

        const style = document.createElement('style');
        style.id = 'admin-licenses-styles';
        style.textContent = `
            .licenses-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
                gap: 20px;
                padding: 20px;
            }

            .license-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                padding: 20px;
                transition: all 0.2s;
            }

            .license-card:hover {
                border-color: var(--accent);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .license-card-header {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
            }

            .license-icon {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 20px;
            }

            .license-info {
                flex: 1;
            }

            .license-name {
                font-weight: 600;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .license-badge {
                font-size: 0.65rem;
                padding: 2px 8px;
                border-radius: 20px;
                background: rgba(108, 108, 255, 0.15);
                color: var(--accent);
            }

            .license-meta {
                font-size: 0.75rem;
                color: var(--text-muted);
                display: flex;
                gap: 16px;
            }

            .license-progress {
                margin-bottom: 20px;
            }

            .progress-header {
                display: flex;
                justify-content: space-between;
                font-size: 0.8rem;
                margin-bottom: 6px;
            }

            .progress-bar {
                height: 6px;
                background: var(--input-bg);
                border-radius: 3px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--accent), var(--accent-hover));
                border-radius: 3px;
                transition: width 0.3s;
            }

            .assignments-list {
                border-top: 1px solid var(--card-border);
                padding-top: 16px;
            }

            .assignments-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                font-size: 0.85rem;
                font-weight: 500;
            }

            .assignment-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--card-border);
            }

            .assignment-item:last-child {
                border-bottom: none;
            }

            .user-name {
                font-weight: 500;
                font-size: 0.85rem;
            }

            .user-email {
                font-size: 0.7rem;
                color: var(--text-muted);
                margin-left: 8px;
            }

            .no-assignments {
                text-align: center;
                padding: 20px;
                color: var(--text-muted);
                font-size: 0.85rem;
            }

            .no-assignments i {
                margin-right: 8px;
            }

            .btn-icon {
                width: 28px;
                height: 28px;
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

            .btn-icon:hover {
                background: rgba(108, 108, 255, 0.15);
                color: var(--accent);
                border-color: var(--accent);
            }

            .btn-icon.danger:hover {
                background: rgba(255, 107, 107, 0.15);
                color: #ff6b6b;
                border-color: #ff6b6b;
            }

            .company-selector {
                padding: 20px;
                border-bottom: 1px solid var(--card-border);
            }

            .company-selector label {
                display: block;
                margin-bottom: 8px;
                font-size: 0.85rem;
                color: var(--text-muted);
            }

            .company-selector select {
                width: 100%;
                max-width: 300px;
                padding: 10px 16px;
                background: var(--input-bg);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                color: var(--text-primary);
            }

            .modal-large {
                max-width: 500px;
            }

            .license-option {
                display: flex;
                align-items: center;
                padding: 12px;
                border: 1px solid var(--card-border);
                border-radius: 12px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .license-option:hover {
                background: var(--hover-bg);
            }

            .license-option input[type="radio"] {
                margin-right: 12px;
                accent-color: var(--accent);
            }

            .option-name {
                flex: 1;
                font-weight: 500;
            }

            .option-price {
                font-weight: 700;
                color: var(--accent);
            }

            @media (max-width: 768px) {
                .licenses-grid {
                    grid-template-columns: 1fr;
                    padding: 16px;
                }

                .company-selector select {
                    max-width: 100%;
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
        console.log('[admin-licenses] Компонент уничтожен');
        this.container.innerHTML = '';
    }
}

export default AdminLicenses;
