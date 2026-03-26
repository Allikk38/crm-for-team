// Вспомогательные функции
window.CRM = window.CRM || {};

window.CRM.helpers = {
    escapeHtml: function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    formatDate: function(dateString) {
        if (!dateString) return '—';
        var date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    },
    
    getInitials: function(name) {
        if (!name) return '?';
        var parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },
    
    isOverdue: function(dateString) {
        if (!dateString) return false;
        var today = new Date().toISOString().split('T')[0];
        return dateString < today;
    },
    
    formatPrice: function(price) {
        if (!price) return '0 RUB';
        return price.toLocaleString() + ' RUB';
    },
    
    generateId: function() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    showToast: function(type, message) {
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 20px;border-radius:5px;z-index:9999;font-family:Arial;font-size:14px;';
        toast.innerHTML = message;
        document.body.appendChild(toast);
        setTimeout(function() {
            if (toast && toast.remove) toast.remove();
        }, 3000);
        console.log('[toast] ' + type + ': ' + message);
    }
};

console.log('[helpers.js] Loaded');
