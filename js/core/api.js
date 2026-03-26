/**
 * ФАЙЛ: api.js
 * РОЛЬ: Работа с GitHub API и CSV
 */

// Конфигурация
const GITHUB_TOKEN_KEY = 'github_token';
const REPO_OWNER = 'Allikk38';
const REPO_NAME = 'crm-for-team';
const BRANCH = 'main';

// Получение токена
function getGitHubToken() {
    return localStorage.getItem(GITHUB_TOKEN_KEY);
}

// Сохранение токена
export function setGitHubToken(token) {
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

// Загрузка CSV файла
export async function loadCSV(filename) {
    console.log('[api.js] Загрузка файла:', filename);
    try {
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filename}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('[api.js] Файл не найден:', filename);
                return [];
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const csvText = await response.text();
        if (!csvText.trim()) return [];
        
        return parseCSV(csvText);
    } catch (error) {
        console.error('[api.js] Ошибка загрузки:', error);
        return [];
    }
}

// Парсинг CSV
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = values[idx] || '';
            });
            result.push(obj);
        }
    }
    
    return result;
}

// Парсинг строки CSV с учётом кавычек
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result;
}

// Конвертация массива в CSV
export function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(obj => headers.map(header => {
            let value = obj[header] || '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        }).join(','))
    ];
    
    return rows.join('\n');
}

// Сохранение CSV через GitHub API
export async function saveCSVToGitHub(filename, data, commitMessage) {
    console.log('[api.js] Сохранение файла:', filename);
    
    const token = getGitHubToken();
    if (!token) {
        console.error('[api.js] Токен GitHub не найден');
        return false;
    }
    
    const csvContent = arrayToCSV(data);
    const encodedContent = btoa(unescape(encodeURIComponent(csvContent)));
    
    try {
        // Получаем текущий SHA файла
        const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        let sha = null;
        
        const getResponse = await fetch(getUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
        
        // Сохраняем файл
        const putUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
        const putResponse = await fetch(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: commitMessage || `Update ${filename}`,
                content: encodedContent,
                sha: sha,
                branch: BRANCH
            })
        });
        
        if (!putResponse.ok) {
            throw new Error(`HTTP ${putResponse.status}`);
        }
        
        console.log('[api.js] Файл сохранён успешно');
        return true;
    } catch (error) {
        console.error('[api.js] Ошибка сохранения:', error);
        return false;
    }
}
