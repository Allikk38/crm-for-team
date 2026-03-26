/**
 * ============================================
 * ФАЙЛ: js/ui/onboarding.js
 * РОЛЬ: Обучение новых пользователей (красивый тур)
 * ============================================
 */

class OnboardingManager {
    constructor() {
        this.steps = [];
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.tooltip = null;
        this.init();
    }
    
    init() {
        const hasSeenOnboarding = localStorage.getItem('crm_onboarding_seen');
        
        if (!hasSeenOnboarding) {
            setTimeout(() => {
                this.startOnboarding();
            }, 1500);
        }
        
        this.addHelpButton();
        
        console.log('[OnboardingManager] Инициализирован');
    }
    
    addHelpButton() {
        const helpBtn = document.createElement('button');
        helpBtn.className = 'help-tour-btn';
        helpBtn.innerHTML = '<i class="fas fa-graduation-cap"></i>';
        helpBtn.setAttribute('aria-label', 'Обучение');
        helpBtn.setAttribute('title', 'Обучение работе с CRM');
        
        helpBtn.onclick = () => this.startOnboarding();
        
        document.body.appendChild(helpBtn);
    }
    
    getStepsForPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().split('.')[0] || 'index';
        
        const commonSteps = [
            {
                element: '.sidebar',
                title: '📱 Навигационное меню',
                content: 'Здесь находится главное меню. Нажмите на ☰ внизу экрана, чтобы открыть его на мобильном.',
                position: 'right'
            },
            {
                element: '.user-profile',
                title: '👤 Ваш профиль',
                content: 'Нажмите сюда, чтобы открыть личный кабинет и изменить настройки.',
                position: 'bottom'
            }
        ];
        
        const pageSteps = {
            'index': [
                {
                    element: '.dashboard .card:first-child',
                    title: '📊 Активные задачи',
                    content: 'Здесь отображается количество активных задач. Нажмите на карточку, чтобы перейти к задачам.',
                    position: 'top'
                },
                {
                    element: '.analytics-card:first-child',
                    title: '📈 Ключевые показатели',
                    content: 'Следите за эффективностью вашей работы через эти метрики.',
                    position: 'top'
                },
                {
                    element: '#agentRanking',
                    title: '🏆 Рейтинг агентов',
                    content: 'Здесь вы можете увидеть, кто из коллег показывает лучшие результаты.',
                    position: 'top'
                }
            ],
            'tasks': [
                {
                    element: '.kanban-column:first-child',
                    title: '📋 Доска задач (Kanban)',
                    content: 'Перетаскивайте задачи между колонками, чтобы менять их статус. На мобильном — нажмите и удерживайте.',
                    position: 'right'
                },
                {
                    element: '.add-task-btn-header',
                    title: '➕ Новая задача',
                    content: 'Нажмите, чтобы создать новую задачу и назначить её исполнителю.',
                    position: 'bottom'
                },
                {
                    element: '.task-card:first-child',
                    title: '📝 Карточка задачи',
                    content: 'Нажмите на задачу, чтобы открыть детали, добавить комментарии или изменить приоритет.',
                    position: 'left'
                }
            ],
            'calendar': [
                {
                    element: '.calendar-container',
                    title: '📅 Календарь задач',
                    content: 'Все задачи с дедлайнами отображаются здесь. На мобильном — нажмите на ячейку, чтобы увидеть задачи.',
                    position: 'top'
                },
                {
                    element: '.calendar-nav',
                    title: '🗓️ Навигация',
                    content: 'Используйте эти кнопки для переключения между месяцами и возврата к текущей дате.',
                    position: 'bottom'
                }
            ],
            'deals': [
                {
                    element: '.kanban-board-deals',
                    title: '💼 Сделки',
                    content: 'Отслеживайте все сделки по статусам: от нового обращения до закрытия.',
                    position: 'top'
                },
                {
                    element: '.add-deal-btn',
                    title: '🆕 Новая сделка',
                    content: 'Создайте новую сделку, выбрав объект, продавца и покупателя.',
                    position: 'bottom'
                }
            ],
            'complexes': [
                {
                    element: '.complexes-grid',
                    title: '🏢 Объекты недвижимости',
                    content: 'Все объекты (ЖК, дома) отображаются здесь в виде карточек.',
                    position: 'top'
                },
                {
                    element: '#addComplexBtn',
                    title: '➕ Новый объект',
                    content: 'Добавьте новый объект недвижимости для работы с ним.',
                    position: 'bottom'
                }
            ],
            'counterparties': [
                {
                    element: '.counterparties-grid',
                    title: '👥 Контрагенты',
                    content: 'База клиентов: продавцы, покупатели, застройщики и инвесторы.',
                    position: 'top'
                },
                {
                    element: '.counterparties-filters',
                    title: '🔍 Фильтры',
                    content: 'Используйте фильтры для быстрого поиска нужных контрагентов.',
                    position: 'bottom'
                }
            ],
            'manager': [
                {
                    element: '.kpi-grid',
                    title: '📊 Аналитика менеджера',
                    content: 'Общая статистика по задачам: всего, просрочено, завершено за неделю.',
                    position: 'top'
                },
                {
                    element: '.agent-list',
                    title: '👥 Нагрузка команды',
                    content: 'Следите за загрузкой каждого агента и распределяйте задачи равномерно.',
                    position: 'top'
                }
            ],
            'admin': [
                {
                    element: '.users-table',
                    title: '👥 Управление пользователями',
                    content: 'Здесь вы можете добавлять, удалять пользователей и сбрасывать их пин-коды.',
                    position: 'top'
                },
                {
                    element: '#addUserBtn',
                    title: '➕ Добавить пользователя',
                    content: 'Создайте нового пользователя, укажите его роль и email.',
                    position: 'bottom'
                }
            ]
        };
        
        return [...commonSteps, ...(pageSteps[page] || [])];
    }
    
    startOnboarding() {
        if (this.isActive) {
            this.endOnboarding();
            return;
        }
        
        this.steps = this.getStepsForPage();
        if (this.steps.length === 0) {
            if (window.animations) {
                window.animations.showToast('Для этой страницы пока нет обучающего тура', 'info');
            }
            return;
        }
        
        this.currentStep = 0;
        this.isActive = true;
        this.createOverlay();
        this.showStep(this.currentStep);
        this.addSkipButton();
        
        console.log('[Onboarding] Начат тур из', this.steps.length, 'шагов');
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-overlay';
        document.body.appendChild(this.overlay);
    }
    
    createTooltip(element, step) {
        const rect = element.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        
        const isLast = this.currentStep === this.steps.length - 1;
        
        tooltip.innerHTML = `
            <div class="onboarding-tooltip-header">
                <h4>${step.title}</h4>
                <button class="onboarding-close" onclick="window.onboarding?.endOnboarding()">✕</button>
            </div>
            <div class="onboarding-tooltip-body">
                <p>${step.content}</p>
            </div>
            <div class="onboarding-tooltip-footer">
                <div class="onboarding-progress">
                    <span>${this.currentStep + 1} / ${this.steps.length}</span>
                    <div class="onboarding-progress-bar">
                        <div class="onboarding-progress-fill" style="width: ${((this.currentStep + 1) / this.steps.length) * 100}%"></div>
                    </div>
                </div>
                <div class="onboarding-buttons">
                    ${this.currentStep > 0 ? '<button class="onboarding-prev">← Назад</button>' : ''}
                    <button class="onboarding-next">${isLast ? '✨ Завершить' : 'Далее →'}</button>
                </div>
            </div>
        `;
        
        let top, left;
        const tooltipWidth = 320;
        const tooltipHeight = 200;
        
        switch (step.position) {
            case 'top':
                top = rect.top - tooltipHeight - 20;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'bottom':
                top = rect.bottom + 20;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.left - tooltipWidth - 20;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.right + 20;
                break;
            default:
                top = rect.top - tooltipHeight - 20;
                left = rect.left;
        }
        
        top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));
        left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));
        
        tooltip.style.cssText = `
            position: fixed;
            top: ${top}px;
            left: ${left}px;
            width: ${tooltipWidth}px;
            background: var(--card-bg);
            border-radius: 20px;
            border: 1px solid var(--accent);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            animation: fadeInScale 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
            backdrop-filter: blur(20px);
            overflow: hidden;
        `;
        
        element.style.outline = '3px solid var(--accent)';
        element.style.outlineOffset = '4px';
        element.style.transition = 'all 0.2s';
        
        return tooltip;
    }
    
    showStep(index) {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        if (this.currentElement) {
            this.currentElement.style.outline = '';
        }
        
        const step = this.steps[index];
        if (!step) return;
        
        const element = document.querySelector(step.element);
        if (!element) {
            console.warn('[Onboarding] Элемент не найден:', step.element);
            this.nextStep();
            return;
        }
        
        this.currentElement = element;
        
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        this.tooltip = this.createTooltip(element, step);
        document.body.appendChild(this.tooltip);
        
        const nextBtn = this.tooltip.querySelector('.onboarding-next');
        const prevBtn = this.tooltip.querySelector('.onboarding-prev');
        
        nextBtn?.addEventListener('click', () => this.nextStep());
        prevBtn?.addEventListener('click', () => this.prevStep());
    }
    
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.endOnboarding();
        }
    }
    
    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }
    
    addSkipButton() {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'onboarding-skip';
        skipBtn.innerHTML = 'Пропустить обучение';
        skipBtn.onclick = () => this.endOnboarding();
        
        document.body.appendChild(skipBtn);
        this.skipButton = skipBtn;
    }
    
    endOnboarding() {
        this.isActive = false;
        
        if (this.overlay) this.overlay.remove();
        if (this.tooltip) this.tooltip.remove();
        if (this.skipButton) this.skipButton.remove();
        
        if (this.currentElement) {
            this.currentElement.style.outline = '';
        }
        
        localStorage.setItem('crm_onboarding_seen', 'true');
        
        if (window.animations) {
            window.animations.showToast('🎉 Обучение завершено!', 'success');
        }
        
        console.log('[Onboarding] Тур завершён');
    }
}

window.OnboardingManager = OnboardingManager;

let onboardingManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onboardingManager = new OnboardingManager();
    });
} else {
    onboardingManager = new OnboardingManager();
}

window.CRM = window.CRM || {};
window.CRM.onboarding = onboardingManager;
window.onboarding = onboardingManager;

console.log('[onboarding.js] Загружен');
