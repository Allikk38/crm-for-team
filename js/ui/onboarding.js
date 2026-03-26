/**
 * ============================================
 * ФАЙЛ: js/ui/onboarding.js
 * РОЛЬ: Обучение новых пользователей (onboarding tour)
 * ЗАВИСИМОСТИ:
 *   - js/ui/animations.js
 * ИСПОЛЬЗУЕТСЯ В: всех страницах
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
        // Проверяем, нужно ли показывать обучение
        const hasSeenOnboarding = localStorage.getItem('crm_onboarding_seen');
        
        if (!hasSeenOnboarding) {
            // Ждем загрузки страницы
            setTimeout(() => {
                this.startOnboarding();
            }, 1000);
        }
        
        // Добавляем кнопку "Помощь" в интерфейс
        this.addHelpButton();
        
        console.log('[OnboardingManager] Инициализирован');
    }
    
    // Добавление кнопки помощи
    addHelpButton() {
        const helpBtn = document.createElement('button');
        helpBtn.className = 'help-tour-btn';
        helpBtn.innerHTML = '<i class="fas fa-question-circle"></i>';
        helpBtn.setAttribute('aria-label', 'Помощь и обучение');
        helpBtn.title = 'Помощь и обучение';
        helpBtn.onclick = () => this.startOnboarding();
        
        // Стили для кнопки
        helpBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: all 0.3s ease;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        helpBtn.onmouseenter = () => {
            helpBtn.style.transform = 'scale(1.1)';
        };
        helpBtn.onmouseleave = () => {
            helpBtn.style.transform = 'scale(1)';
        };
        
        document.body.appendChild(helpBtn);
    }
    
    // Определение шагов в зависимости от страницы
    getStepsForPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().split('.')[0] || 'index';
        
        const commonSteps = [
            {
                element: '.sidebar',
                title: '📱 Навигационное меню',
                content: 'Здесь находится главное меню. Вы можете свернуть его для экономии места.',
                position: 'right'
            },
            {
                element: '.user-profile',
                title: '👤 Ваш профиль',
                content: 'Нажмите сюда, чтобы открыть личный кабинет и изменить настройки.',
                position: 'bottom'
            },
            {
                element: '.theme-toggle',
                title: '🎨 Смена темы',
                content: 'Переключайтесь между светлой и тёмной темой для комфортной работы.',
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
                    content: 'Перетаскивайте задачи между колонками, чтобы менять их статус.',
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
                    content: 'Все задачи с дедлайнами отображаются здесь. Вы можете перетаскивать задачи на новые даты.',
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
                },
                {
                    element: '.overdue-list',
                    title: '⚠️ Просроченные задачи',
                    content: 'Задачи, которые требуют вашего внимания в первую очередь.',
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
    
    // Запуск обучения
    startOnboarding() {
        if (this.isActive) {
            this.endOnboarding();
            return;
        }
        
        this.steps = this.getStepsForPage();
        if (this.steps.length === 0) {
            this.showToast('Для этой страницы пока нет обучающего тура', 'info');
            return;
        }
        
        this.currentStep = 0;
        this.isActive = true;
        this.createOverlay();
        this.showStep(this.currentStep);
        
        // Добавляем кнопку пропуска
        this.addSkipButton();
        
        console.log('[Onboarding] Начат тур из', this.steps.length, 'шагов');
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9998;
            pointer-events: none;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(this.overlay);
    }
    
    createTooltip(element, step) {
        const rect = element.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        
        tooltip.innerHTML = `
            <div class="onboarding-tooltip-header">
                <h4>${step.title}</h4>
                <button class="onboarding-close" onclick="window.onboarding?.endOnboarding()">✕</button>
            </div>
            <div class="onboarding-tooltip-body">
                <p>${step.content}</p>
            </div>
            <div class="onboarding-tooltip-footer">
                <div class="onboarding-dots">
                    ${this.steps.map((_, i) => `<span class="dot ${i === this.currentStep ? 'active' : ''}"></span>`).join('')}
                </div>
                <div class="onboarding-buttons">
                    ${this.currentStep > 0 ? '<button class="onboarding-prev">← Назад</button>' : ''}
                    <button class="onboarding-next">${this.currentStep === this.steps.length - 1 ? 'Готово ✓' : 'Далее →'}</button>
                </div>
            </div>
        `;
        
        // Позиционирование тултипа
        let top, left;
        switch (step.position) {
            case 'top':
                top = rect.top - 120;
                left = rect.left + rect.width / 2 - 150;
                break;
            case 'bottom':
                top = rect.bottom + 20;
                left = rect.left + rect.width / 2 - 150;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - 80;
                left = rect.left - 320;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - 80;
                left = rect.right + 20;
                break;
            default:
                top = rect.top - 100;
                left = rect.left;
        }
        
        tooltip.style.cssText = `
            position: fixed;
            top: ${Math.max(10, top)}px;
            left: ${Math.max(10, left)}px;
            width: 300px;
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--accent);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: fadeInScale 0.3s ease;
            backdrop-filter: blur(12px);
        `;
        
        // Подсветка элемента
        element.style.outline = '3px solid var(--accent)';
        element.style.outlineOffset = '4px';
        element.style.transition = 'all 0.2s';
        
        return tooltip;
    }
    
    showStep(index) {
        // Удаляем предыдущий тултип
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        // Снимаем подсветку с предыдущего элемента
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
        
        // Прокручиваем к элементу
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Создаем тултип
        this.tooltip = this.createTooltip(element, step);
        document.body.appendChild(this.tooltip);
        
        // Добавляем обработчики
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
        skipBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 40px;
            cursor: pointer;
            z-index: 10001;
            font-size: 0.8rem;
            transition: all 0.2s;
        `;
        skipBtn.onclick = () => this.endOnboarding();
        skipBtn.onmouseenter = () => skipBtn.style.transform = 'translateY(-2px)';
        skipBtn.onmouseleave = () => skipBtn.style.transform = 'translateY(0)';
        
        document.body.appendChild(skipBtn);
        this.skipButton = skipBtn;
    }
    
    endOnboarding() {
        this.isActive = false;
        
        // Удаляем элементы
        if (this.overlay) this.overlay.remove();
        if (this.tooltip) this.tooltip.remove();
        if (this.skipButton) this.skipButton.remove();
        
        // Снимаем подсветку
        if (this.currentElement) {
            this.currentElement.style.outline = '';
        }
        
        // Сохраняем, что обучение пройдено
        localStorage.setItem('crm_onboarding_seen', 'true');
        
        this.showToast('Обучение завершено! 🎉', 'success');
        
        console.log('[Onboarding] Тур завершён');
    }
    
    showToast(message, type = 'info') {
        if (window.animations) {
            window.animations.showToast(message, type);
        }
    }
}

// Создаем глобальный объект
window.OnboardingManager = OnboardingManager;

// Инициализация
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
