// manager.js - панель управления менеджера

let allTasks = [];
let allUsers = [];
let currentUser = null;

// Загрузка данных
async function loadData() {
    allTasks = await loadCSV('data/tasks.csv');
    allTasks = allTasks.map(task => ({
        ...task,
        id: parseInt(task.id),
        due_date: task.due_date || ''
    }));
    
    allUsers = await loadCSV('data/users.csv');
    
    // Фильтруем только агентов
    const agents = allUsers.filter(u => u.role === 'agent');
    
    return agents;
}

// Расчёт KPI
function calculateKPI() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const total = allTasks.length;
    const inProgressCount = allTasks.filter(t => t.status === 'in_progress').length;
    
    // Просроченные: статус не done и due_date < сегодня
    const overdue = allTasks.filter(t => {
        if (t.status === 'done') return false;
        if (!t.due_date) return false;
        return t.due_date < today;
    });
    
    // Закрытые за неделю
    const closedThisWeek = allTasks.filter(t => {
        if (t.status !== 'done') return false;
        if (!t.updated_at) return false;
        return t.updated_at >= weekAgoStr;
    });
    
    return {
        total,
        overdue: overdue.length,
        closedWeek: closedThisWeek.length,
        inProgress: inProgressCount,
        overdueList: overdue
    };
}

// Расчёт нагрузки по агентам
function calculateAgentLoad() {
    const agents = allUsers.filter(u => u.role === 'agent');
    const today = new Date().toISOString().split('T')[0];
    
    return agents.map(agent => {
        const agentTasks = allTasks.filter(t => t.assigned_to === agent.github_username);
        const activeTasks = agentTasks.filter(t => t.status !== 'done').length;
        const overdueTasks = agentTasks.filter(t => {
            if (t.status === 'done') return false;
            if (!t.due_date) return false;
            return t.due_date < today;
        }).length;
        const completedTasks = agentTasks.filter(t => t.status === 'done').length;
        
        // Процент загрузки (максимум 5 активных задач на агента)
        const maxLoad = 5;
        const loadPercent = Math.min(100, (activeTasks / maxLoad) * 100);
        
        return {
            ...agent,
            activeTasks,
            overdueTasks,
            completedTasks,
            loadPercent
        };
    }).sort((a, b) => b.activeTasks - a.activeTasks);
}

// Отображение нагрузки по агентам
function renderAgentLoad(agentLoad) {
    const container = document.getElementById('agentList');
    if (!container) return;
    
    if (agentLoad.length === 0) {
        container.innerHTML = '<p style="opacity: 0.6; text-align: center;">Нет агентов в системе</p>';
        return;
    }
    
    container.innerHTML = agentLoad.map(agent => {
        const initials = agent.name.split(' ').map(n => n[0]).join('');
        const loadColor = agent.loadPercent > 80 ? '#ff6b6b' : agent.loadPercent > 50 ? '#ffc107' : '#4caf50';
        
        return `
            <div class="agent-item">
                <div class="agent-info">
                    <div class="agent-avatar">${initials}</div>
                    <div class="agent-name">${escapeHtml(agent.name)}</div>
                </div>
                <div class="agent-stats">
                    <span>📋 ${agent.activeTasks} активных</span>
                    ${agent.overdueTasks > 0 ? `<span class="overdue-badge">⚠️ ${agent.overdueTasks} просрочено</span>` : ''}
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${agent.loadPercent}%; background: ${loadColor};"></div>
                    </div>
                    <span>${Math.round(agent.loadPercent)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// Отображение просроченных задач
function renderOverdueTasks(overdueList) {
    const container = document.getElementById('overdueTasksList');
    if (!container) return;
    
    if (overdueList.length === 0) {
        container.innerHTML = '<p style="opacity: 0.6; text-align: center; padding: 20px;">✅ Нет просроченных задач</p>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    container.innerHTML = overdueList.map(task => {
        const assignee = allUsers.find(u => u.github_username === task.assigned_to);
        const assigneeName = assignee ? assignee.name : 'Не назначен';
        const daysOverdue = Math.floor((new Date(today) - new Date(task.due_date)) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="overdue-task">
                <div>
                    <div class="overdue-title">${escapeHtml(task.title)}</div>
                    <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 4px;">
                        👤 ${assigneeName} | 📅 просрочено на ${daysOverdue} дн.
                    </div>
                </div>
                <button class="action-btn" onclick="goToTask(${task.id})">Перейти →</button>
            </div>
        `;
    }).join('');
}

// Отображение графика активности
function renderActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    
    // Получаем последние 7 дней
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }
    
    // Считаем закрытые задачи по дням
    const closedByDay = days.map(day => {
        return allTasks.filter(t => {
            if (t.status !== 'done') return false;
            if (!t.updated_at) return false;
            return t.updated_at === day;
        }).length;
    });
    
    const maxCount = Math.max(...closedByDay, 1);
    
    container.innerHTML = days.map((day, index) => {
        const height = (closedByDay[index] / maxCount) * 120;
        const dayLabel = day.slice(5); // MM-DD
        
        return `
            <div class="chart-bar">
                <div class="bar" style="height: ${Math.max(4, height)}px;"></div>
                <div class="bar-label">${dayLabel}</div>
                <div style="font-size: 0.65rem; color: #a0a0ff;">${closedByDay[index]}</div>
            </div>
        `;
    }).join('');
}

// Обновление KPI
function updateKPI(kpi) {
    document.getElementById('totalTasks').textContent = kpi.total;
    document.getElementById('overdueTasks').textContent = kpi.overdue;
    document.getElementById('closedWeek').textContent = kpi.closedWeek;
    document.getElementById('inProgress').textContent = kpi.inProgress;
}

// Переход к задаче на доске
function goToTask(taskId) {
    window.location.href = `tasks.html?task=${taskId}`;
}

// Инициализация
async function init() {
    await auth.initAuth();
    currentUser = auth.getCurrentUser();
    
    // Проверка прав доступа
    if (!currentUser || (currentUser.role !== 'manager' && currentUser.role !== 'admin')) {
        document.querySelector('main').innerHTML = `
            <div class="info-panel" style="text-align: center;">
                <h2>⛔ Доступ ограничен</h2>
                <p>Эта страница доступна только менеджерам и администраторам.</p>
                <a href="index.html" class="nav-btn" style="margin-top: 20px; display: inline-block;">Вернуться на главную</a>
            </div>
        `;
        return;
    }
    
    await loadData();
    
    const kpi = calculateKPI();
    updateKPI(kpi);
    
    const agentLoad = calculateAgentLoad();
    renderAgentLoad(agentLoad);
    
    renderOverdueTasks(kpi.overdueList);
    renderActivityChart();
}

// Запуск
document.addEventListener('DOMContentLoaded', init);
