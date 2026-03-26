/**
 * ============================================
 * ФАЙЛ: js/core/api.js
 * РОЛЬ: Работа с данными (CSV, GitHub API)
 * ЗАВИСИМОСТИ: нет
 * ИСПОЛЬЗУЕТСЯ В: всех модулях, работающих с данными
 * ============================================
 */

window.CRM = window.CRM || {};
window.CRM.api = {};

const REPO_OWNER = 'Allikk38';
const REPO_NAME = 'crm-for-team';
const BRANCH = 'main';

// Загрузка CSV файла
async function loadCSV(filename) {
    try {
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filename}`;
        const response = await fetch(url);
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error(`Ошибка загрузки ${filename}:`, error);
        return [];
    }
}
window.CRM.api.loadCSV = loadCSV;
window.loadCSV = loadCSV; // Обратная совместимость

// Парсинг CSV
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        result.push(obj);
    }
    
    return result;
}
window.CRM.api.parseCSV = parseCSV;

// Экранирование CSV значения
function escapeCSV(value) {
    const strValue = value === null || value === undefined ? '' : String(value);
    
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
}
window.CRM.api.escapeCSV = escapeCSV;

// Конвертация массива в CSV
function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(obj => headers.map(header => escapeCSV(obj[header])).join(','))
    ];
    
    return rows.join('\n');
}
window.CRM.api.arrayToCSV = arrayToCSV;
window.arrayToCSV = arrayToCSV; // Обратная совместимость

// Получение SHA файла из GitHub
async function getFileSHAWithToken(filename, token) {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения SHA:', error);
        return null;
    }
}

// Сохранение данных в GitHub
async function saveCSVToGitHub(filename, data, commitMessage) {
    let token = localStorage.getItem('github_token');
    
    if (!token) {
        token = prompt('🔐 Введите ваш GitHub Personal Access Token (требуется для сохранения данных):\n\nКак создать токен:\n1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)\n2. Generate new token (classic)\n3. Выберите права: "repo" (полный доступ к репозиториям)\n4. Скопируйте токен и вставьте сюда');
        
        if (!token) {
            alert('Сохранение невозможно без токена');
            return false;
        }
        
        localStorage.setItem('github_token', token);
    }
    
    try {
        const sha = await getFileSHAWithToken(filename, token);
        const csvContent = arrayToCSV(data);
        
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: commitMessage || `Update ${filename}`,
                content: btoa(unescape(encodeURIComponent(csvContent))),
                sha: sha,
                branch: BRANCH
            })
        });
        
        if (response.ok) {
            console.log('✅ Сохранено успешно:', filename);
            return true;
        } else {
            const error = await response.json();
            
            if (response.status === 401) {
                localStorage.removeItem('github_token');
                return await saveCSVToGitHub(filename, data, commitMessage);
            }
            
            console.error('Ошибка сохранения:', error);
            alert(`Ошибка сохранения: ${error.message}`);
            return false;
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
        return false;
    }
}
window.CRM.api.saveCSVToGitHub = saveCSVToGitHub;
window.saveCSVToGitHub = saveCSVToGitHub; // Обратная совместимость

console.log('[api.js] Загружен');
