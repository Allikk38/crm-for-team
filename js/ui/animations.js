/**
 * ============================================
 * ФАЙЛ: js/ui/animations.js
 * РОЛЬ: Динамические анимации и микровзаимодействия
 * ЗАВИСИМОСТИ:
 *   - css/animations.css (стили анимаций)
 * ИСПОЛЬЗУЕТСЯ В:
 *   - Все страницы CRM
 * ============================================
 */

class AnimationManager {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Инициализируем наблюдатель за появлением элементов
        this.initIntersectionObserver();
        
        // Добавляем ripple-эффект кнопкам
        this.initRippleEffect();
        
        // Добавляем анимации при загрузке страницы
        this.initPageAnimations();
        
        console.log('[AnimationManager] Инициализирован');
    }

    /**
     * Наблюдатель за появлением элементов при скролле
     */
    initIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        // Наблюдаем за элементами с классом animate-on-scroll
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            this.observer.observe(el);
        });
    }

    /**
     * Ripple-эффект для кнопок
     */
    initRippleEffect() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .nav-btn, .theme-toggle, .collapse-btn');
            if (button && !button.classList.contains('no-ripple')) {
                this.createRipple(e, button);
            }
        });
    }

    createRipple(event, element) {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        
        ripple.style.position = 'absolute';
        ripple.style.width = '0';
        ripple.style.height = '0';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(108, 108, 255, 0.4)';
        ripple.style.transform = 'translate(-50%, -50%)';
        ripple.style.pointerEvents = 'none';
        
        element.appendChild(ripple);
        
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.transition = 'width 0.4s ease, height 0.4s ease, opacity 0.4s ease';
        
        setTimeout(() => {
            ripple.style.opacity = '0';
            setTimeout(() => ripple.remove(), 400);
        }, 400);
    }

    /**
     * Анимация появления страницы
     */
    initPageAnimations() {
        // Добавляем fade-in для main-content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.opacity = '0';
            setTimeout(() => {
                mainContent.style.transition = 'opacity 0.3s ease';
                mainContent.style.opacity = '1';
            }, 50);
        }
        
        // Анимация для карточек
        document.querySelectorAll('.card, .kanban-column, .kpi-card').forEach((card, index) => {
            card.style.animationDelay = `${index * 0.05}s`;
            card.classList.add('fade-in-scale');
        });
    }

    /**
     * Анимация добавления новой строки в таблицу
     * @param {HTMLElement} row - строка таблицы
     */
    animateNewRow(row) {
        row.classList.add('table-row-highlight');
        setTimeout(() => {
            row.classList.remove('table-row-highlight');
        }, 1000);
    }

    /**
     * Анимация удаления элемента
     * @param {HTMLElement} element - удаляемый элемент
     * @param {Function} callback - функция после анимации
     */
    animateRemove(element, callback) {
        element.style.transition = 'all 0.2s ease';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (callback) callback();
        }, 200);
    }

    /**
     * Анимация появления модального окна
     * @param {HTMLElement} modal - модальное окно
     */
    showModal(modal) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
        
        modal.style.display = 'block';
        modal.classList.add('fade-in-scale');
        
        overlay.onclick = () => this.hideModal(modal, overlay);
    }

    /**
     * Анимация закрытия модального окна
     * @param {HTMLElement} modal - модальное окно
     * @param {HTMLElement} overlay - оверлей
     */
    hideModal(modal, overlay) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-closing');
            overlay.remove();
        }, 200);
    }

    /**
     * Анимация уведомления (тоста)
     * @param {string} message - текст уведомления
     * @param {string} type - тип (success, error, info)
     * @param {number} duration - длительность в мс
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast-removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        return icons[type] || icons.info;
    }

    /**
     * Анимация загрузки (скелетон)
     * @param {HTMLElement} container - контейнер для скелетона
     * @param {Function} loadFunction - функция загрузки данных
     */
    async withSkeleton(container, loadFunction) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton';
        skeleton.style.height = '100px';
        skeleton.style.margin = '10px 0';
        
        container.innerHTML = '';
        container.appendChild(skeleton);
        
        try {
            const result = await loadFunction();
            container.innerHTML = '';
            return result;
        } catch (error) {
            container.innerHTML = '<div class="error">Ошибка загрузки</div>';
            throw error;
        }
    }
}

// Инициализация при загрузке DOM
let animationManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        animationManager = new AnimationManager();
    });
} else {
    animationManager = new AnimationManager();
}

// Экспорт в глобальный объект
window.CRM = window.CRM || {};
window.CRM.ui = window.CRM.ui || {};
window.CRM.ui.animations = animationManager;

// Для обратной совместимости
window.animations = animationManager;

console.log('[js/ui/animations.js] Загружен');
