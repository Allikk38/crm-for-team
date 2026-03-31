/**
 * Notes Page Module
 * Modularized from app/notes.html inline script
 */

import { supabase } from '../core/supabase.js';
import { getCurrentSupabaseUser, requireSupabaseAuth, updateSupabaseUserInterface } from '../core/supabase-session.js';
import * as notesService from '../services/notes-supabase.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import * as sidebar from '../layout.js';

let currentUser = null;
let notes = [];
let currentCategory = 'all';
let searchQuery = '';
let editor = null;

// Categories config
const CATEGORIES = {
  work: { name: 'Работа' },
  personal: { name: 'Личное' },
  ideas: { name: 'Идеи' },
  tasks: { name: 'Задачи' }
};

export async function initNotesPage() {
  const isAuth = await requireSupabaseAuth('../auth-supabase.html');
  if (!isAuth) return;

  currentUser = getCurrentSupabaseUser();
  updateSupabaseUserInterface();

  // Init sidebar
  sidebar.initSidebar();

  await loadNotes();
  initEditor();
  initEventListeners();
  
  // Realtime subscription
  notesService.subscribeToNotes((payload) => {
    console.log('[notes-realtime]', payload);
    loadNotes();
  });

  console.log('[notes] Page initialized');
}

async function loadNotes() {
  try {
    notes = await notesService.getNotes();
    renderNotes();
  } catch (error) {
    console.error('[notes] Load error:', error);
    showToast('Ошибка загрузки заметок', 'error');
    document.getElementById('notesGrid').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки. Проверьте таблицу notes в Supabase.</p>
      </div>
    `;
  }
}

async function saveNote() {
  const id = document.getElementById('noteId').value;
  const title = document.getElementById('noteTitle').value.trim();
  const content = editor.value();
  const category = document.getElementById('noteCategory').value;

  if (!title) {
    showToast('Введите заголовок', 'error');
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
    console.error('[notes] Save error:', error);
    showToast('Ошибка сохранения', 'error');
  }
}

async function deleteNote(id) {
  if (confirm('Удалить заметку?')) {
    try {
      await notesService.deleteNote(id);
      await loadNotes();
      showToast('Заметка удалена', 'success');
    } catch (error) {
      showToast('Ошибка удаления', 'error');
    }
  }
}

async function togglePin(id) {
  try {
    await notesService.togglePin(id);
    await loadNotes();
  } catch (error) {
    showToast('Ошибка закрепления', 'error');
  }
}

// Filtering
function getFilteredNotes() {
  let filtered = [...notes];

  if (currentCategory !== 'all') {
    filtered = filtered.filter(n => n.category === currentCategory);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(n => 
      n.title.toLowerCase().includes(query) ||
      n.content?.toLowerCase().includes(query)
    );
  }

  // Pinned first
  filtered.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return filtered;
}

function renderNotes() {
  const container = document.getElementById('notesGrid');
  const filtered = getFilteredNotes();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sticky-note"></i>
        <p>Нет заметок</p>
        <button class="add-note-btn" onclick="window.notesApp.openNoteModal()">
          Создать заметку
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(note => {
    const category = CATEGORIES[note.category] || { name: note.category };
    const preview = note.content ? note.content.substring(0, 100).replace(/\\n/g, ' ') : '';

    return `
      <div class="note-card ${note.is_pinned ? 'pinned' : ''}" data-note-id="${note.id}">
        <div class="note-header">
          <div class="note-title">${escapeHtml(note.title || 'Без названия')}</div>
          <div class="note-actions">
            <button class="note-action-btn pin-note" data-id="${note.id}" data-pinned="${note.is_pinned}">
              <i class="fas fa-thumbtack"></i>
            </button>
            <button class="note-action-btn delete-note" data-id="${note.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="note-category">${category.name}</div>
        <div class="note-content">${escapeHtml(preview) || '<em>Нет содержимого</em>'}</div>
        <div class="note-footer">
          <span><i class="far fa-clock"></i> ${formatDate(note.updated_at)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Event listeners for cards
  setupNoteEventListeners();
}

function setupNoteEventListeners() {
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.note-action-btn')) {
        const noteId = card.dataset.noteId;
        window.notesApp.openNoteModal(noteId);
      }
    });
  });

  document.querySelectorAll('.pin-note').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const pinned = btn.dataset.pinned === 'true';
      await togglePin(id);
    });
  });

  document.querySelectorAll('.delete-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteNote(id);
    });
  });
}

// Modal
function openNoteModal(noteId = null) {
  const modal = document.getElementById('noteModal');
  const titleEl = document.getElementById('modalTitle');
  const idField = document.getElementById('noteId');

  if (noteId) {
    const note = notes.find(n => n.id === noteId);
    titleEl.textContent = 'Редактировать заметку';
    idField.value = note.id;
    document.getElementById('noteTitle').value = note.title || '';
    document.getElementById('noteCategory').value = note.category || 'work';
    editor.value(note.content || '');
  } else {
    titleEl.textContent = 'Новая заметка';
    idField.value = '';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteCategory').value = 'work';
    editor.value('');
  }

  modal.classList.add('active');
  editor.codemirror.refresh();
}

window.notesApp = { openNoteModal };  // Global access

function closeNoteModal() {
  document.getElementById('noteModal').classList.remove('active');
}

// Init EasyMDE
function initEditor() {
  editor = new EasyMDE({
    element: document.getElementById('editor'),
    spellChecker: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', '|', 'preview'],
    placeholder: 'Напишите что-нибудь...',
    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: false,
    }
  });
}

function initEventListeners() {
  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderNotes();
  });

  // Categories
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      renderNotes();
    });
  });

  // Buttons
  document.getElementById('addNoteBtn').addEventListener('click', () => openNoteModal());
  document.getElementById('saveNoteBtn').addEventListener('click', saveNote);

  window.closeNoteModal = closeNoteModal;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: var(--accent); color: white;
    padding: 12px 20px; border-radius: 8px; z-index: 10000; transform: translateX(400px);
    animation: slideIn 0.3s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Expose globals for HTML onclick
window.notesApp = {
  openNoteModal,
  closeNoteModal: closeNoteModal
};

