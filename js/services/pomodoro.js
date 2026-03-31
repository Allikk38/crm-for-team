/**
 * ============================================
 * ФАЙЛ: js/services/pomodoro.js
 * РОЛЬ: Глобальный сервис управления таймером помодоро
 * 
 * ОСОБЕННОСТИ:
 *   - Сохранение состояния в localStorage
 *   - Фоновый таймер, не сбрасывающийся при переходе между страницами
 *   - Синхронизация между вкладками через storage событие
 *   - Уведомления о завершении сессии
 *   - Статистика в localStorage и Supabase
 *   - Подписка на изменения состояния
 * 
 * ЗАВИСИМОСТИ:
 *   - js/core/supabase.js
 *   - js/core/supabase-session.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Создание сервиса
 *   - 31.03.2026: Добавлены экспорты для модульной архитектуры
 * ============================================
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser } from '../core/supabase-session.js';

console.log('[pomodoro] Сервис загружен');

// ========== КОНСТАНТЫ ==========

export const WORK_TIME = 25 * 60;  // 25 минут в секундах
export const BREAK_TIME = 5 * 60;  // 5 минут в секундах

// ========== СОСТОЯНИЕ ==========

let timerState = {
    mode: 'work',           // 'work' or 'break'
    status: 'idle',         // 'idle', 'running', 'paused'
    timeLeft: WORK_TIME,
    currentTaskId: null,
    completedSessions: 0,
    lastUpdated: null
};

let timerInterval = null;
let listeners = [];

// ========== ВНУТРЕННИЕ ФУНКЦИИ ==========

/**
 * Загрузка состояния из localStorage
 * @returns {Object} Состояние таймера
 */
function loadState() {
    const saved = localStorage.getItem('pomodoro_state');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            console.log('[pomodoro] Загружено состояние:', state);
            
            if (state.status === 'running' && state.lastUpdated) {
                const elapsed = Math.floor((Date.now() - state.lastUpdated) / 1000);
                const newTimeLeft = Math.max(0, state.timeLeft - elapsed);
                
                console.log(`[pomodoro] Восстановление таймера, прошло ${elapsed} сек, осталось ${newTimeLeft} сек`);
                
                timerState = {
                    ...state,
                    timeLeft: newTimeLeft,
                    lastUpdated: Date.now(),
                    status: newTimeLeft > 0 ? 'running' : 'idle'
                };
                
                if (newTimeLeft <= 0) {
                    console.log('[pomodoro] Время истекло при восстановлении');
                    completeSession();
                }
            } else {
                timerState = state;
                timerState.lastUpdated = null;
                if (timerState.status === 'running') {
                    timerState.status = 'paused';
                    console.log('[pomodoro] Таймер был запущен, но нет lastUpdated, ставим на паузу');
                }
            }
        } catch (e) {
            console.error('[pomodoro] Ошибка загрузки состояния:', e);
        }
    } else {
        console.log('[pomodoro] Состояние не найдено, используем значения по умолчанию');
    }
    return timerState;
}

/**
 * Сохранение состояния в localStorage
 */
function saveState() {
    const toSave = {
        ...timerState,
        lastUpdated: timerState.status === 'running' ? Date.now() : null
    };
    localStorage.setItem('pomodoro_state', JSON.stringify(toSave));
    
    // Уведомляем другие вкладки
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'pomodoro_state',
        newValue: JSON.stringify(toSave)
    }));
}

/**
 * Уведомление всех слушателей об изменении состояния
 */
function notifyListeners() {
    listeners.forEach(listener => {
        try {
            listener(timerState);
        } catch (e) {
            console.error('[pomodoro] Ошибка в слушателе:', e);
        }
    });
}

/**
 * Запуск таймера
 */
function startTimer() {
    console.log('[pomodoro] Запуск таймера, режим:', timerState.mode, 'осталось:', timerState.timeLeft);
    
    // Останавливаем старый интервал, если есть
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerState.status = 'running';
    timerState.lastUpdated = Date.now();
    saveState();
    notifyListeners();
    
    timerInterval = setInterval(() => {
        if (timerState.status === 'running' && timerState.timeLeft > 0) {
            timerState.timeLeft--;
            saveState();
            notifyListeners();
            
            if (timerState.timeLeft <= 0) {
                console.log('[pomodoro] Таймер достиг нуля');
                completeSession();
            }
        }
    }, 1000);
}

/**
 * Пауза таймера
 */
function pauseTimer() {
    if (timerState.status !== 'running') {
        console.log('[pomodoro] Таймер не запущен, пауза не требуется');
        return;
    }
    
    console.log('[pomodoro] Пауза таймера, осталось:', timerState.timeLeft);
    
    timerState.status = 'paused';
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    saveState();
    notifyListeners();
}

/**
 * Сброс текущей сессии
 */
function resetTimer() {
    console.log('[pomodoro] Сброс таймера');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerState.status = 'idle';
    timerState.timeLeft = timerState.mode === 'work' ? WORK_TIME : BREAK_TIME;
    timerState.lastUpdated = null;
    saveState();
    notifyListeners();
}

/**
 * Завершение текущей сессии (работа -> отдых или отдых -> работа)
 */
function completeSession() {
    console.log('[pomodoro] Завершение сессии, режим:', timerState.mode);
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (timerState.mode === 'work') {
        timerState.completedSessions++;
        
        // Сохраняем статистику
        saveSessionStats();
        
        // Переключаем на отдых
        timerState.mode = 'break';
        timerState.timeLeft = BREAK_TIME;
        timerState.status = 'idle';
        
        // Уведомление
        if (Notification.permission === 'granted') {
            new Notification('🍅 Помидор завершен!', {
                body: 'Время отдохнуть 5 минут',
                icon: '/favicon.ico'
            });
        }
        
        playSound();
        
    } else {
        // Отдых закончен, возвращаемся к работе
        timerState.mode = 'work';
        timerState.timeLeft = WORK_TIME;
        timerState.status = 'idle';
        
        if (Notification.permission === 'granted') {
            new Notification('💪 Отдых закончен!', {
                body: 'Приступаем к работе',
                icon: '/favicon.ico'
            });
        }
        
        playSound();
    }
    
    timerState.lastUpdated = null;
    saveState();
    notifyListeners();
}

/**
 * Воспроизведение звука уведомления
 */
function playSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,U3RlYWQgbm90aWZpY2F0aW9uIHNvdW5k');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('[pomodoro] Звук не воспроизведен'));
    } catch (e) {
        console.log('[pomodoro] Звук не поддерживается');
    }
}

/**
 * Сохранение статистики сессии в localStorage и Supabase
 */
async function saveSessionStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        let stats = JSON.parse(localStorage.getItem('pomodoro_stats') || '{}');
        
        if (!stats[today]) {
            stats[today] = { sessions: 0, minutes: 0 };
        }
        
        stats[today].sessions++;
        stats[today].minutes += 25;
        
        localStorage.setItem('pomodoro_stats', JSON.stringify(stats));
        
        // Сохраняем в Supabase
        const user = getCurrentSupabaseUser();
        if (user && user.id) {
            try {
                const { data: existing } = await supabase
                    .from('pomodoro_stats')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .maybeSingle();
                
                if (existing) {
                    await supabase
                        .from('pomodoro_stats')
                        .update({
                            sessions: existing.sessions + 1,
                            minutes: existing.minutes + 25,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('pomodoro_stats')
                        .insert({
                            user_id: user.id,
                            date: today,
                            sessions: 1,
                            minutes: 25
                        });
                }
            } catch (e) {
                console.log('[pomodoro] Статистика не сохранена в Supabase:', e.message);
            }
        }
    } catch (e) {
        console.error('[pomodoro] Ошибка сохранения статистики:', e);
    }
}

// ========== ПУБЛИЧНЫЕ ФУНКЦИИ ==========

/**
 * Получить статистику за указанное количество дней
 * @param {number} days - Количество дней
 * @returns {Array} Массив статистики по дням
 */
export function getStats(days = 7) {
    const stats = JSON.parse(localStorage.getItem('pomodoro_stats') || '{}');
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        result.push({
            date: dateStr,
            sessions: stats[dateStr]?.sessions || 0,
            minutes: stats[dateStr]?.minutes || 0
        });
    }
    
    return result;
}

/**
 * Получить текущее состояние таймера
 * @returns {Object} Копия состояния таймера
 */
export function getState() {
    return { ...timerState };
}

/**
 * Запустить таймер
 */
export function start() {
    startTimer();
}

/**
 * Поставить таймер на паузу
 */
export function pause() {
    pauseTimer();
}

/**
 * Сбросить текущую сессию
 */
export function reset() {
    resetTimer();
}

/**
 * Завершить текущую сессию принудительно
 */
export function complete() {
    completeSession();
}

/**
 * Подписаться на изменения состояния таймера
 * @param {Function} listener - Функция-слушатель
 * @returns {Function} Функция для отписки
 */
export function subscribe(listener) {
    listeners.push(listener);
    return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
    };
}

/**
 * Запросить разрешение на уведомления
 */
export function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

loadState();

if (timerState.status === 'running') {
    console.log('[pomodoro] Таймер был активен, запускаем');
    startTimer();
}

window.addEventListener('storage', (e) => {
    if (e.key === 'pomodoro_state' && e.newValue) {
        try {
            const newState = JSON.parse(e.newValue);
            const wasRunning = timerState.status === 'running';
            const isRunning = newState.status === 'running';
            
            timerState = newState;
            
            if (isRunning && !wasRunning) {
                startTimer();
            } else if (!isRunning && wasRunning) {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }
            
            notifyListeners();
        } catch (e) {}
    }
});

requestNotificationPermission();

console.log('[pomodoro] Сервис инициализирован');