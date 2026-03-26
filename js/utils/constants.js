// Константы CRM
window.CRM = window.CRM || {};

window.CRM.constants = {
    ROLES: {
        ADMIN: 'admin',
        MANAGER: 'manager',
        AGENT: 'agent',
        VIEWER: 'viewer'
    },
    
    DEAL_STATUSES: [
        { id: 'new', name: 'New', icon: 'N', color: '#9e9e9e' },
        { id: 'showing', name: 'Showing', icon: 'V', color: '#2196f3' },
        { id: 'negotiation', name: 'Negotiation', icon: 'R', color: '#ffc107' },
        { id: 'deposit', name: 'Deposit', icon: 'D', color: '#9c27b0' },
        { id: 'documents', name: 'Documents', icon: 'P', color: '#ff9800' },
        { id: 'contract', name: 'Contract', icon: 'S', color: '#f44336' },
        { id: 'payment', name: 'Payment', icon: 'M', color: '#4caf50' },
        { id: 'closed', name: 'Closed', icon: 'C', color: '#607d8b' },
        { id: 'cancelled', name: 'Cancelled', icon: 'X', color: '#9e9e9e' }
    ],
    
    DEAL_TYPES: {
        primary: { name: 'Primary', icon: 'P', class: 'type-primary' },
        secondary: { name: 'Secondary', icon: 'S', class: 'type-secondary' },
        exchange: { name: 'Exchange', icon: 'A', class: 'type-exchange' },
        urgent: { name: 'Urgent', icon: 'U', class: 'type-urgent' }
    },
    
    COUNTERPARTY_TYPES: {
        seller: { name: 'Seller', icon: 'S', class: 'type-seller' },
        buyer: { name: 'Buyer', icon: 'B', class: 'type-buyer' },
        developer: { name: 'Developer', icon: 'D', class: 'type-developer' },
        investor: { name: 'Investor', icon: 'I', class: 'type-investor' }
    },
    
    NAVIGATION_ITEMS: [
        { path: 'index.html', icon: 'fas fa-chart-line', name: 'Dashboard', roles: ['admin', 'manager', 'agent', 'viewer'] },
        { path: 'tasks.html', icon: 'fas fa-tasks', name: 'Tasks', roles: ['admin', 'manager', 'agent', 'viewer'] },
        { path: 'complexes.html', icon: 'fas fa-building', name: 'Complexes', roles: ['admin', 'manager', 'agent', 'viewer'] },
        { path: 'deals.html', icon: 'fas fa-handshake', name: 'Deals', roles: ['admin', 'manager', 'agent'] },
        { path: 'counterparties.html', icon: 'fas fa-users', name: 'Counterparties', roles: ['admin', 'manager', 'agent'] },
        { path: 'calendar.html', icon: 'fas fa-calendar-alt', name: 'Calendar', roles: ['admin', 'manager', 'agent', 'viewer'] },
        { path: 'calendar-integration.html', icon: 'fas fa-plug', name: 'Calendar Integration', roles: ['admin', 'manager', 'agent'] },
        { path: 'manager.html', icon: 'fas fa-chart-simple', name: 'Manager Panel', roles: ['admin', 'manager'] },
        { path: 'admin.html', icon: 'fas fa-user-cog', name: 'Admin', roles: ['admin'] }
    ]
};

console.log('[constants.js] Loaded');
