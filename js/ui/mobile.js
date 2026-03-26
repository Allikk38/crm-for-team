/**
 * ============================================
 * ФАЙЛ: js/ui/mobile.js
 * РОЛЬ: Мобильная адаптация и жесты
 * ЗАВИСИМОСТИ:
 *   - js/ui/animations.js
 * ИСПОЛЬЗУЕТСЯ В: всех страницах
 * ============================================
 */

class MobileManager {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = null;
        this.init();
    }
    
    init() {
        this.createMenuToggle();
        this.setupGestures();
        this.setupResizeHandler();
        this.optimizeForMobile();
        
        console.log('[MobileManager] Инициализирован, isMobile:', this.isMobile);
    }
    
    // Создание кнопки бургер-меню
    createMenuToggle() {
        if (!this.isMobile) return;
        
        // Удаляем существующую кнопку
        const existingToggle = document.querySelector('.mobile-menu-toggle');
        if (existingToggle) existingToggle.remove();
        
        // Создаем новую кнопку
        this.menuToggle = document.createElement('button');
        this.menuToggle.className = 'mobile-menu-toggle';
        this.menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        this.menuToggle.setAttribute('aria-label', 'Открыть меню');
        
        this.menuToggle.addEventListener('click', () => this.toggleSidebar());
        document.body.appendChild(this.menuToggle);
        
        // Закрываем меню при клике вне
        document.addEventListener('click', (e) => {
            if (this.isMobile && this.sidebar && this.sidebar.classList.contains('mobile-open')) {
                if (!this.sidebar.contains(e.target) && !this.menuToggle.contains(e.target)) {
                    this.closeSidebar();
                }
            }
        });
    }
    
    toggleSidebar() {
        if (!this.sidebar) return;
        
        if (this.sidebar.classList.contains('mobile-open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }
    
    openSidebar() {
        this.sidebar.classList.add('mobile-open');
        this.menuToggle.innerHTML = '<i class="fas fa-times"></i>';
        this.menuToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (window.animations) {
            window.animations.showToast('Меню открыто', 'info');
        }
    }
    
    closeSidebar() {
        this.sidebar.classList.remove('mobile-open');
        this.menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        this.menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Настройка свайп-жестов
    setupGestures() {
        if (!this.isMobile) return;
        
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
        });
    }
    
    handleSwipe(startX, endX, startY, endY) {
        const diffX = endX - startX;
        const diffY = endY - startY;
        
        // Горизонтальный свайп (влево/вправо)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // Свайп вправо - открыть меню
                if (this.sidebar && !this.sidebar.classList.contains('mobile-open')) {
                    this.openSidebar();
                }
            } else {
                // Свайп влево - закрыть меню
                if (this.sidebar && this.sidebar.classList.contains('mobile-open')) {
                    this.closeSidebar();
                }
            }
        }
    }
    
    // Оптимизация для мобильных устройств
    optimizeForMobile() {
        if (!this.isMobile) return;
        
        // Увеличиваем область нажатия для кнопок
        const allButtons = document.querySelectorAll('button, .nav-item, .action-btn');
        allButtons.forEach(btn => {
            btn.style.minHeight = '44px';
            btn.style.minWidth = '44px';
        });
        
        // Оптимизация для таблиц - горизонтальная прокрутка
        const tables = document.querySelectorAll('.users-table, .deals-table');
        tables.forEach(table => {
            table.style.overflowX = 'auto';
            table.style.webkitOverflowScrolling = 'touch';
        });
        
        // Оптимизация для Kanban - горизонтальная прокрутка
        const kanban = document.querySelector('.kanban-board');
        if (kanban) {
            kanban.style.overflowX = 'auto';
            kanban.style.display = 'flex';
            kanban.style.gap = '16px';
            
            const columns = document.querySelectorAll('.kanban-column');
            columns.forEach(col => {
                col.style.minWidth = '280px';
                col.style.flex = '0 0 auto';
            });
        }
        
        // Убираем hover-эффекты на мобильных (заменяем на tap)
        const hoverElements = document.querySelectorAll('.card, .kanban-column, .task-card');
        hoverElements.forEach(el => {
            el.addEventListener('touchstart', () => {
                el.classList.add('tap-active');
                setTimeout(() => el.classList.remove('tap-active'), 150);
            });
        });
    }
    
    // Обработчик изменения размера окна
    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const wasMobile = this.isMobile;
                this.isMobile = window.innerWidth <= 768;
                
                if (wasMobile !== this.isMobile) {
                    location.reload(); // Перезагружаем для применения новых стилей
                }
            }, 250);
        });
    }
}

// Создаем глобальный объект
window.MobileManager = MobileManager;

// Инициализация
let mobileManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mobileManager = new MobileManager();
    });
} else {
    mobileManager = new MobileManager();
}

window.CRM = window.CRM || {};
window.CRM.mobile = mobileManager;

console.log('[mobile.js] Загружен');
