// Notes Permissions
// Доступ ко всем заметкам для всех авторизованных пользователей

export const NOTES_PERMISSIONS = {
  view_notes: 'view:notes',
  create_notes: 'create:notes',
  edit_notes: 'edit:notes',
  delete_notes: 'delete:notes'
};

export function canViewNotes() {
  return true; // Все пользователи могут просматривать свои заметки
}

export function canEditNotes() {
  return true; // RLS обрабатывает владение
}

export const requiredPermissions = ['view_notes'];

