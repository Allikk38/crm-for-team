/**
 * ============================================
 * ФАЙЛ: js/pages/tasks.js
 * РОЛЬ: Логика страницы доски задач (Kanban) - ОРКЕСТРАТОР
 * 
 * ОСОБЕННОСТИ:
 *   - Использует компоненты TaskKanban и TaskModal
 *   - Управляет жизненным циклом страницы
 *   - Координирует взаимодействие между компонентами
 *   - Загружает начальные данные
 *   - ЧИСТЫЙ ES6, БЕЗ ГЛОБАЛЬНЫХ ФУНКЦИЙ
 * 
 * ЗАВИСИМОСТИ:
 *   - js/components/task-kanban.js
 *   - js/components/task-modal.js
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 *   - js/services/tasks-supabase.js
 * 
 * ИСТОРИЯ:
 *   - 27.03.2026: Создание файла, вынос логики из tasks-supabase.html
 *   - 28.03.2026: Добавлен автокомплит для @упоминаний в комментариях
 *   - 28.03.2026: Исправлена загрузка пользователей и комментариев
 *   - 28.03.2026: Добавлена панель фильтров и статистика
 *   - 10.04.2026: ПОЛНЫЙ РЕФАКТОРИНГ — переход на компонентную архитектуру
 *   - 10.04.2026: Убраны все глобальные функции (window.xxx)
 *   - 10.04.2026: Выделены TaskKanban и TaskModal в отдельные компоненты
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { 
    getCurrentSupabaseUser, 
    requireSupabaseAuth, 
    updateSupabaseUserInterface 
} from '../core/supabase-session.js';
import { deleteTask } from '../services/tasks-supabase.js';
import { TaskKanban } from '../components/task-kanban.js';
import { TaskModal } from '../components/task-modal.js';
import { showToast } from '../utils/helpers.js';

/**
 * Класс-оркестратор страницы задач
 */
class TasksPage {
    // Приватные поля
    #currentUser = null;
    #users = [];
    #complexes = [];
    
    // Компоненты
    #kanban = null;
    #modal = null;
    
    // Флаг инициализации
    #initialized = false;

    constructor() {
        // Ничего не делаем в конструкторе
    }

    /**
     * Инициализация страницы
     */
    async init() {
        if (this.#initialized) {
            console.log('[tasks] Страница уже инициализирована');
            return;
        }
        
        console.log('[tasks] Инициализация страницы...');
        
        // Проверка авторизации
        const isAuth = await requireSupabaseAuth('../auth-supabase.html');
        if (!isAuth) return;
        
        this.#currentUser = getCurrentSupabaseUser();
        updateSupabaseUserInterface();
        console.log('[tasks] Текущий пользователь:', this.#currentUser?.name);
        
        // Загрузка начальных данных
        await this.#loadInitialData();
        
        // Создание компонентов
        this.#createComponents();
        
        // Привязка событий
        this.#bindEvents();
        
        // Инициализация сайдбара
        this.#initSidebar();
        
        this.#initialized = true;
        console.log('[tasks] Инициализация завершена');
    }

    /**
     * Загрузка начальных данных
     */
    async #loadInitialData() {
        await Promise.all([
            this.#loadUsers(),
            this.#loadComplexes()
        ]);
    }

    /**
     * Загрузка пользователей
     */
    async #loadUsers() {
        try {
            const user = this.#currentUser;
            if (!user) {
                this.#users = [];
                return;
            }
            
            // Получаем company_id текущего пользователя
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();
            
            let query = supabase.from('profiles').select('*');
            
            // Если пользователь в компании — показываем только коллег
            if (profile?.company_id) {
                query = query.eq('company_id', profile.company_id);
            } else {
                // Если нет компании — показываем только себя
                query = query.eq('id', user.id);
            }
            
            const { data, error } = await query;
            
            if (!error && data) {
                this.#users = data;
                console.log('[tasks] Загружено пользователей:', this.#users.length);
            } else {
                console.error('[tasks] Ошибка загрузки пользователей:', error);
                this.#users = [];
            }
        } catch (e) {
            console.error('[tasks] Ошибка загрузки пользователей:', e);
            this.#users = [];
        }
    }

    /**
     * Загрузка объектов
     */
    async #loadComplexes() {
        try {
            const { data, error } = await supabase
                .from('complexes')
                .select('*')
                .eq('user_id', this.#currentUser?.id);
            
            if (!error && data) {
                this.#complexes = data;
                console.log('[tasks] Загружено объектов:', this.#complexes.length);
            }
        } catch (e) {
            console.error('[tasks] Ошибка загрузки объектов:', e);
            this.#complexes = [];
        }
    }

    /**
     * Создание компонентов
     */
    #createComponents() {
        // Создаём модальное окно
        this.#modal = new TaskModal(async () => {
            // Коллбэк после сохранения задачи
            await this.#kanban.refresh();
        });
        
        this.#modal.init(this.#currentUser, this.#users);
        
        // Создаём канбан-доску
        this.#kanban = new TaskKanban({
            onEdit: (taskId) => {
                // Открыть модалку на редактирование
                this.#modal.open(taskId);
            },
            onDelete: async (taskId) => {
                // Удалить задачу
                const task = this.#kanban.getTaskById(taskId);
                const confirmMessage = task 
                    ? `Удалить задачу "${task.title}"?` 
                    : 'Удалить задачу?';
                
                if (confirm(confirmMessage)) {
                    const success = await deleteTask(taskId);
                    if (success) {
                        await this.#kanban.refresh();
                        showToast('success', 'Задача удалена');
                    } else {
                        showToast('error', 'Ошибка удаления задачи');
                    }
                }
            },
            onAdd: (status) => {
                // Открыть модалку для создания задачи с предустановленным статусом
                this.#modal.open(null, { status });
            }
        });
        
        this.#kanban.init(this.#currentUser, this.#users);
    }

    /**
     * Привязка событий
     */
    #bindEvents() {
        // Кнопка "Новая задача" в хедере
        const addTaskBtn = document.getElementById('addTaskBtn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.#modal.open(null, { status: 'pending' });
            });
        }
        
        // Обновление списка пользователей в модалке, если пользователи загрузились позже
        // (на случай асинхронной загрузки)
        if (this.#users.length > 0) {
            this.#modal.updateUsers(this.#users);
        }
    }

    /**
     * Инициализация сайдбара
     */
    #initSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
    }

    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

    /**
     * Обновить данные страницы
     */
    async refresh() {
        await this.#kanban.refresh();
    }

    /**
     * Уничтожить страницу (очистка ресурсов)
     */
    destroy() {
        if (this.#kanban) {
            this.#kanban.destroy();
            this.#kanban = null;
        }
        if (this.#modal) {
            this.#modal.destroy();
            this.#modal = null;
        }
        this.#initialized = false;
        console.log('[tasks] Страница уничтожена');
    }
}

// ========== ТОЧКА ВХОДА ==========

/**
 * Инициализация страницы задач
 * Вызывается из moduleLoader.js
 */
export async function initTasksPage() {
    const page = new TasksPage();
    await page.init();
    
    // Сохраняем инстанс в глобальную переменную только для отладки
    // (можно убрать в продакшене)
    window.__tasksPage = page;
}

// Для обратной совместимости с старым кодом, который мог использовать глобальные функции
// (эти функции больше не нужны, но оставляем пустые заглушки с предупреждениями)
if (typeof window !== 'undefined') {
    // Все глобальные функции удалены. Используйте TasksPage.
    console.log('[tasks] Глобальные функции удалены. Используется компонентная архитектура.');
}

export default TasksPage;
