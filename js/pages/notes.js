/**
 * ============================================
 * ФАЙЛ: js/pages/notes.js
 * РОЛЬ: Логика страницы заметок
 * 
 * ОСОБЕННОСТИ:
 *   - CRUD операции с заметками через Supabase
 *   - Категории и закрепление заметок
 *   - Поиск по заголовку и содержимому
 *   - Простой textarea редактор
 *   - Realtime обновления через Supabase
 * 
 * ЗАВИСИМОСТИ:
 *   - js/services/notes-supabase.js
 *   - js/core/supabase-session.js
 *   - js/utils/helpers.js
 * 
 * ИСТОРИЯ:
 *   - 31.03.2026: Исправлено закрытие модалки через display
 * ============================================
 */

import { getCurrentSupabaseUser, requireSupabaseAuth, updateSupabaseUserInterface } from '../core/supabase-session.js';
import * as notesService from '../services/notes-supabase.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let notes = [];
let currentCategory = 'all';
let searchQuery = '';
let textareaElement = null;
let isInitialized = false;
let realtimeChannel = null;
let isModalOpening = false;

// ========== КОНФИГУРАЦИЯ ==========
const CATEGORIES = {
    work: { name: 'Работа', icon: 'fa-briefcase' },
    personal: { name: 'Личное', icon: 'fa-user' },
    ideas: { name: 'Идеи', icon: 'fa-lightbulb' },
    tasks: { name: 'Задачи', icon: 'fa-check-square' }
};

// ========== МОДАЛЬНОЕ ОКНО ==========

function closeNoteModal() {
    console.log('[notes] closeNoteModal вызван');
    
    const modal = document.getElementById('noteModal');
    if (!modal) {
        console.error('[notes] Модальное окно не найдено для закрытия');
        return;
    }
    
    if (!modal.classList.contains('active')) {
        console.log('[notes] Модалка уже закрыта');
        return;
    }
    
    modal.classList.remove('active');
    modal.style.display = 'none';  // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ!
    document.body.style.overflow = '';
    
    const idField = document.getElementById('noteId');
    const titleField = document.getElementById('noteTitle');
    if (idField) idField.value = '';
    if (titleField) titleField.value = '';
    setEditorContent('');
    
    console.log('[notes] Модальное окно закрыто');
}

function openNoteModal(noteId = null) {
    if (isModalOpening) {
        console.log('[notes] Уже открываем, пропускаем');
        return;
    }
    
    console.log('[notes] openNoteModal вызван, noteId:', noteId);
    
    const modal = document.getElementById('noteModal');
    if (!modal) {
        console.error('[notes] Модальное окно не найдено!');
        return;
    }
    
    if (modal.classList.contains('active')) {
        console.log('[notes] Модалка уже открыта');
        return;
    }
    
    isModalOpening = true;
    
    const titleEl = document.getElementById('modalTitle');
    const idField = document.getElementById('noteId');
    const titleField = document.getElementById('noteTitle');
    const categoryField = document.getElementById('noteCategory');
    
    if (!titleEl || !idField || !titleField || !categoryField) {
        console.error('[notes] Не найдены элементы формы');
        isModalOpening = false;
        return;
    }
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            titleEl.textContent = 'Редактировать заметку';
            idField.value = note.id;
            titleField.value = note.title || '';
            categoryField.value = note.category || 'work';
            setEditorContent(note.content || '');
        }
    } else {
        titleEl.textContent = 'Новая заметка';
        idField.value = '';
        titleField.value = '';
        categoryField.value = 'work';
        setEditorContent('');
    }
    
    modal.style.display = 'flex';  // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ!
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log('[notes] Модальное окно открыто');
    
    setTimeout(() => {
        isModalOpening = false;
    }, 500);
    
    setTimeout(() => {
        if (titleField) titleField.focus();
    }, 100);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function getEditorContent() {
    return textareaElement ? textareaElement.value : '';
}

function setEditorContent(content) {
    if (textareaElement) {
        textareaElement.value = content || '';
    }
}

function formatNoteDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) return 'только что';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} ч назад`;
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 3600000));
        return `${days} дн назад`;
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// ========== CRUD ОПЕРАЦИИ ==========

async function saveNote() {
    const id = document.getElementById('noteId')?.value;
    const title = document.getElementById('noteTitle')?.value.trim();
    const content = getEditorContent();
    const category = document.getElementById('noteCategory')?.value;

    if (!title) {
        showToast('Введите заголовок заметки', 'error');
        return;
    }

    try {
        if (id) {
            await notesService.updateNote(id, { title, content, category });
            showToast('Заметка обновлена', 'success');
        } else {
            await notesService.createNote(title, content, category);
            showToast('Заметка создана', 'success');
        }
        
        closeNoteModal();
        await loadNotes();
    } catch (error) {
        console.error('[notes] Ошибка сохранения:', error);
        showToast('Ошибка сохранения заметки', 'error');
    }
}

async function deleteNote(id) {
    if (!confirm('Удалить заметку?')) return;
    
    try {
        await notesService.deleteNote(id);
        await loadNotes();
        showToast('Заметка удалена', 'success');
    } catch (error) {
        console.error('[notes] Ошибка удаления:', error);
        showToast('Ошибка удаления', 'error');
    }
}

async function togglePin(id) {
    try {
        await notesService.togglePin(id);
        await loadNotes();
    } catch (error) {
        console.error('[notes] Ошибка закрепления:', error);
        showToast('Ошибка закрепления', 'error');
    }
}

// ========== ФИЛЬТРАЦИЯ ==========

function getFilteredNotes() {
    let filtered = [...notes];

    if (currentCategory !== 'all') {
        filtered = filtered.filter(n => n.category === currentCategory);
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(n => 
            n.title.toLowerCase().includes(query) ||
            (n.content && n.content.toLowerCase().includes(query))
        );
    }

    filtered.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
    });

    return filtered;
}

// ========== РЕНДЕРИНГ ==========

function attachCardHandlers() {
    document.querySelectorAll('.note-card').forEach(card => {
        card.onclick = (e) => {
            if (!e.target.closest('.note-action-btn')) {
                const noteId = card.dataset.noteId;
                openNoteModal(noteId);
            }
        };
    });
    
    document.querySelectorAll('.pin-note').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await togglePin(id);
        };
    });
    
    document.querySelectorAll('.delete-note').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await deleteNote(id);
        };
    });
}

function renderNotes() {
    const container = document.getElementById('notesGrid');
    if (!container) return;
    
    const filtered = getFilteredNotes();
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <p>Нет заметок</p>
                <button class="add-note-btn" id="emptyStateAddBtn">
                    <i class="fas fa-plus"></i> Создать заметку
                </button>
            </div>
        `;
        
        const emptyBtn = document.getElementById('emptyStateAddBtn');
        if (emptyBtn) {
            emptyBtn.onclick = () => openNoteModal();
        }
        return;
    }
    
    container.innerHTML = filtered.map(note => {
        const category = CATEGORIES[note.category] || { name: note.category, icon: 'fa-tag' };
        const preview = note.content 
            ? note.content.substring(0, 100).replace(/\n/g, ' ').replace(/#/g, '') 
            : '';
        
        return `
            <div class="note-card ${note.is_pinned ? 'pinned' : ''}" data-note-id="${note.id}">
                <div class="note-header">
                    <div class="note-title">${escapeHtml(note.title || 'Без названия')}</div>
                    <div class="note-actions">
                        <button class="note-action-btn pin-note ${note.is_pinned ? 'pinned-active' : ''}" 
                                data-id="${note.id}" 
                                title="${note.is_pinned ? 'Открепить' : 'Закрепить'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="note-action-btn delete-note" 
                                data-id="${note.id}" 
                                title="Удалить">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="note-category">
                    <i class="fas ${category.icon}"></i> ${category.name}
                </div>
                <div class="note-content">
                    ${preview ? escapeHtml(preview) : '<em>Нет содержимого</em>'}
                </div>
                <div class="note-footer">
                    <span><i class="far fa-clock"></i> ${formatNoteDate(note.updated_at)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    attachCardHandlers();
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadNotes() {
    try {
        notes = await notesService.getNotes();
        renderNotes();
        console.log(`[notes] Загружено ${notes.length} заметок`);
    } catch (error) {
        console.error('[notes] Ошибка загрузки:', error);
        const container = document.getElementById('notesGrid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки заметок: ${error.message || 'Неизвестная ошибка'}</p>
                    <button class="add-note-btn" onclick="window.notesApp?.openNoteModal()">
                        <i class="fas fa-plus"></i> Создать заметку
                    </button>
                </div>
            `;
        }
        showToast('Ошибка загрузки заметок', 'error');
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ РЕДАКТОРА ==========

function initEditor() {
    const editorContainer = document.getElementById('editor');
    
    if (!editorContainer) {
        console.error('[notes] Элемент #editor не найден');
        return;
    }
    
    if (textareaElement) {
        console.log('[notes] Редактор уже инициализирован');
        return;
    }
    
    const textarea = document.createElement('textarea');
    textarea.id = 'editor-textarea';
    textarea.className = 'note-editor';
    textarea.placeholder = 'Напишите что-нибудь...';
    textarea.style.cssText = `
        width: 100%; 
        min-height: 250px; 
        padding: 12px; 
        background: var(--input-bg); 
        border: 1px solid var(--card-border); 
        border-radius: 12px; 
        color: var(--text-primary);
        font-family: inherit;
        font-size: 0.9rem;
        line-height: 1.5;
        resize: vertical;
    `;
    
    editorContainer.innerHTML = '';
    editorContainer.appendChild(textarea);
    textareaElement = textarea;
    
    console.log('[notes] Textarea редактор инициализирован');
}

// ========== ПРЯМАЯ ПРИВЯЗКА КНОПОК ==========

function bindButtons() {
    console.log('[notes] Привязка кнопок...');
    
    const addBtn = document.getElementById('addNoteBtn');
    if (addBtn) {
        addBtn.onclick = null;
        addBtn.onclick = function(e) {
            e.preventDefault();
            console.log('[notes] Кнопка "Новая заметка" НАЖАТА!');
            openNoteModal();
            return false;
        };
        console.log('[notes] Кнопка addNoteBtn привязана');
    } else {
        console.error('[notes] Кнопка addNoteBtn НЕ НАЙДЕНА!');
    }
    
    const cancelBtn = document.getElementById('cancelNoteBtn');
    if (cancelBtn) {
        cancelBtn.onclick = null;
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            console.log('[notes] Кнопка "Отмена" НАЖАТА!');
            closeNoteModal();
            return false;
        };
        console.log('[notes] Кнопка cancelNoteBtn привязана');
    } else {
        console.error('[notes] Кнопка cancelNoteBtn НЕ НАЙДЕНА!');
    }
    
    const saveBtn = document.getElementById('saveNoteBtn');
    if (saveBtn) {
        saveBtn.onclick = null;
        saveBtn.onclick = function(e) {
            e.preventDefault();
            console.log('[notes] Кнопка "Сохранить" НАЖАТА!');
            saveNote();
            return false;
        };
        console.log('[notes] Кнопка saveNoteBtn привязана');
    }
    
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                console.log('[notes] Клик на overlay, закрываем');
                closeNoteModal();
            }
        };
    }
    
    document.onkeydown = function(e) {
        if (e.key === 'Escape') {
            const modalEl = document.getElementById('noteModal');
            if (modalEl && modalEl.classList.contains('active')) {
                console.log('[notes] Escape нажат, закрываем');
                closeNoteModal();
            }
        }
    };
}

// ========== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ==========

function initEventListeners() {
    console.log('[notes] Инициализация обработчиков событий');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            renderNotes();
        };
    }
    
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category;
            renderNotes();
        };
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ REALTIME ==========

function setupRealtime() {
    if (realtimeChannel) {
        try {
            realtimeChannel.unsubscribe();
        } catch (e) {
            console.warn('[notes] Ошибка отписки:', e);
        }
        realtimeChannel = null;
    }
    
    try {
        realtimeChannel = notesService.subscribeToNotes((payload) => {
            console.log('[notes] Realtime update:', payload.eventType);
            loadNotes();
        });
    } catch (error) {
        console.warn('[notes] Realtime подписка не удалась:', error.message);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ==========

export async function initNotesPage() {
    if (isInitialized) {
        console.log('[notes] Страница уже инициализирована');
        return;
    }
    
    console.log('[notes] Инициализация страницы...');
    
    const isAuth = await requireSupabaseAuth('../auth-supabase.html');
    if (!isAuth) return;
    
    currentUser = getCurrentSupabaseUser();
    updateSupabaseUserInterface();
    
    initEditor();
    initEventListeners();
    bindButtons();
    
    // Убеждаемся, что модалка скрыта при загрузке
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    
    await loadNotes();
    setupRealtime();
    
    isInitialized = true;
    console.log('[notes] Страница инициализирована');
}

// ========== ЭКСПОРТ ==========

window.notesApp = {
    openNoteModal,
    closeNoteModal,
    saveNote,
    deleteNote,
    togglePin
};

window.debugNotes = {
    openModal: openNoteModal,
    closeModal: closeNoteModal,
    getNotes: () => notes
};