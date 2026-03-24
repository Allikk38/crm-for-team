// core.js - общие функции для работы с данными

const REPO_OWNER = 'твойаккаунт'; // Замени на свой GitHub username
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
