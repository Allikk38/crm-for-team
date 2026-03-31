# TODO: Фаза 1 - Критические исправления

## ✅ Завершено
- [x] Анализ проекта
- [x] IMPROVEMENTS.md

## 🔄 В работе (Фаза 1)

### 1.1 Удаление debug кода (console.*)
- [ ] layout.js (15+ console)
- [ ] js/modules/tasks/index.js
- [ ] js/modules/complexes/index.js  
- [ ] js/components/widgets/*.js (5 файлов)
- [ ] Добавить DEBUG=1 флаг в js/core/env.js

### 1.2 XSS защита (innerHTML → textContent)
- [ ] js/components/dashboard-container.js
- [ ] js/components/deal-card-list.js
- [ ] js/components/kanban.js
- [ ] js/pages/tasks.js
- [ ] Добавить DOMPurify в js/utils/security.js

### 1.3 Supabase оптимизация
- [ ] js/pages/tasks.js (.limit(50))
- [ ] js/pages/deals.js 
- [ ] js/services/tasks-supabase.js
- [ ] js/services/deals-supabase.js
- [ ] Global error handler

### 1.4 Error boundaries
- [ ] js/core/errorHandler.js (новый)
- [ ] Интеграция в layout.js

## ⏳ Следующие фазы
- [ ] Фаза 2: Performance
- [ ] Фаза 3: Accessibility
- [ ] Фаза 4: DevOps

**Progress: 15%** (анализ + план)
