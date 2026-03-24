// core.js - общие функции для работы с данными

const REPO_OWNER = 'Allikk38'; // Замени на свой GitHub username
const REPO_NAME = 'crm-for-team';  // Название репозитория
const BRANCH = 'main';

// Загрузка CSV файла из репозитория
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

// Парсинг CSV в массив объектов
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

// Сохранение данных в GitHub (будет реализовано позже)
async function saveCSV(filename, data) {
    console.log('Сохранение в GitHub будет реализовано позже');
    // TODO: реализовать запись через GitHub API
    return false;
}

// Нормализация строки (убираем лишние пробелы, приводим к нижнему регистру)
function normalizeString(str) {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}
// Функция для получения SHA файла (нужно для обновления)
async function getFileSHA(filename) {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`
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

// Функция для сохранения CSV в GitHub
async function saveCSVToGitHub(filename, data, commitMessage) {
    const token = prompt('Введите ваш GitHub Personal Access Token (для сохранения):');
    if (!token) return false;
    
    try {
        // Получаем текущий SHA файла
        const sha = await getFileSHAWithToken(filename, token);
        
        // Конвертируем данные в CSV
        const csvContent = arrayToCSV(data);
        
        // Отправляем запрос на обновление
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: commitMessage || `Update ${filename}`,
                content: btoa(csvContent),
                sha: sha,
                branch: BRANCH
            })
        });
        
        if (response.ok) {
            alert('Сохранено успешно!');
            return true;
        } else {
            const error = await response.json();
            alert(`Ошибка сохранения: ${error.message}`);
            return false;
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
        return false;
    }
}

async function getFileSHAWithToken(filename, token) {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Конвертация массива объектов в CSV
function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(obj => headers.map(header => escapeCSV(obj[header] || '')).join(','))
    ];
    
    return rows.join('\n');
}

function escapeCSV(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// Экспортируем новые функции
window.utils = {
    saveCSVToGitHub,
    arrayToCSV
};
