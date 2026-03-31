// DOMPurify CDN (no npm needed)
const DOMPurify = window.DOMPurify || (function() {
    // Fallback для старых браузеров
    return {
        sanitize: (dirty) => dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    };
})();

// Sanitize template с данными
export function sanitizeHtml(template, data = {}) {
    let html = template;
    
    // Заменяем плейсхолдеры escaped данными
    for (const [key, value] of Object.entries(data)) {
        const escaped = escapeHtml(value);
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), escaped);
    }
    
    return DOMPurify.sanitize(html);
}

// Safe innerHTML wrapper
export function safeInnerHTML(element, html) {
    element.innerHTML = DOMPurify.sanitize(html);
}

// Dynamic script loader
export async function loadScript(src) {
    if (document.querySelector(`script[src*="${src}"]`)) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(window.DOMPurify);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Инициализация при загрузке
if (typeof window !== 'undefined') {
    loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.min.js');
}

export { DOMPurify };

