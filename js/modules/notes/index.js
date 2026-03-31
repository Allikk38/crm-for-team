// Notes Module Definition

import { NOTES_PERMISSIONS, canViewNotes, canEditNotes } from './permissions.js';

export default {
  id: 'notes',
  name: 'Заметки',
  version: '1.0.0',
  icon: 'fa-sticky-note',
  category: 'personal',
  order: 100,
  mainPage: '/app/notes.html',
  pages: {
    '/app/notes.html': {
      title: 'Заметки',
      permissions: ['view_notes']
    }
  },
  requiredPermissions: ['view_notes'],
  available: true,
  onLoad: async () => {
    console.log('[notes-module] Загружен');
    return true;
  },
  permissions: NOTES_PERMISSIONS
};

