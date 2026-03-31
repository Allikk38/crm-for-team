/**
 * ============================================
 * ФАЙЛ: js/pages/marketplace.js
 * РОЛЬ: Логика страницы маркетплейса модулей и виджетов
 * 
 * ОСОБЕННОСТИ:
 *   - Каталог доступных модулей
 *   - Покупка модулей для команды
 *   - Автоматическое обновление навигации после покупки
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Вынесение логики из marketplace.html
 *   - 31.03.2026: Упрощение - только каталог
 * ============================================
 */

import { getCurrentSupabaseUser, requireSupabaseAuth, updateSupabaseUserInterface } from '../core/supabase-session.js';
import { 
    getModulesCatalog, 
    purchaseModuleForTeam, 
    getCompanyLicenses
} from '../services/license-supabase.js';

let currentUser = null;
let licenses = [];
let modulesCatalog = [];

console.log('[marketplace.js] Модуль загружен');

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

async function loadModulesCatalog() {
    const catalog = await getModulesCatalog();
    modulesCatalog = Object.entries(catalog).map(([id, data]) => ({
        id,
        name: data.name,
        icon: id === 'real_estate' ? 'fa-building' : 
              id === 'finance' ? 'fa-coins' :
              id === 'education' ? 'fa-graduation-cap' :
              id === 'health' ? 'fa-heartbeat' : 'fa-rocket',
        description: data.description || 'Расширение функционала',
        price: data.price,
        period: 'мес',
        features: data.features || ['Расширенные возможности'],
        isFree: data.isFree || data.price === 0,
        pages: data.pages || []
    }));
    console.log('[marketplace] Каталог загружен, модулей:', modulesCatalog.length);
}

async function loadData() {
    licenses = await getCompanyLicenses();
    console.log('[marketplace] Данные загружены, лицензий:', licenses.length);
}

function isModulePurchased(moduleId) {
    return licenses.some(l => l.module_id === moduleId);
}

async function handlePurchaseModule(moduleId) {
    const module = modulesCatalog.find(m => m.id === moduleId);
    if (!module) return;
    
    if (module.isFree) {
        showToast('Базовый модуль уже доступен бесплатно', 'warning');
        return;
    }
    
    if (isModulePurchased(moduleId)) {
        showToast('Модуль уже приобретен', 'warning');
        return;
    }
    
    const success = await purchaseModuleForTeam(moduleId, 10);
    if (success) {
        await loadData();
        await renderCatalog();
        
        if (window.sidebar?.renderNavigation) {
            window.sidebar.renderNavigation();
        }
        
        showToast(`✅ Модуль "${module.name}" приобретен для команды!`, 'success');
    } else {
        showToast('❌ Ошибка при покупке модуля', 'error');
    }
}

async function renderCatalog() {
    const container = document.getElementById('modulesGrid');
    if (!container) return;
    
    await loadData();
    
    if (modulesCatalog.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет доступных модулей</div>';
        return;
    }
    
    container.innerHTML = modulesCatalog.map((module, index) => {
        const purchased = isModulePurchased(module.id);
        const priceDisplay = module.price === 0 ? 'Бесплатно' : `${module.price} ₽`;
        
        let buttonHtml = '';
        if (module.isFree) {
            buttonHtml = `<button class="module-btn purchased" disabled><i class="fas fa-check"></i> Бесплатный</button>`;
        } else if (purchased) {
            buttonHtml = `<button class="module-btn purchased" disabled><i class="fas fa-check"></i> Приобретен</button>`;
        } else {
            buttonHtml = `<button class="module-btn primary" onclick="window.purchaseModule('${module.id}')"><i class="fas fa-shopping-cart"></i> Купить ${priceDisplay}/${module.period}</button>`;
        }
        
        return `
            <div class="module-card ${purchased ? 'purchased' : ''}" style="animation-delay: ${index * 0.05}s">
                <div class="module-icon">
                    <i class="fas ${module.icon}"></i>
                </div>
                <div class="module-name">${escapeHtml(module.name)}</div>
                <div class="module-description">${escapeHtml(module.description)}</div>
                <ul class="module-features">
                    ${module.features.map(f => `<li><i class="fas fa-check-circle" style="color: #4caf50;"></i> ${escapeHtml(f)}</li>`).join('')}
                </ul>
                <div class="module-footer">
                    <div class="module-price">${priceDisplay}${module.price > 0 ? `<small>/${module.period}</small>` : ''}</div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    }).join('');
}

window.purchaseModule = handlePurchaseModule;

export async function initMarketplacePage() {
    console.log('[marketplace] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    await loadModulesCatalog();
    await renderCatalog();
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    console.log('[marketplace] Инициализация завершена');
}