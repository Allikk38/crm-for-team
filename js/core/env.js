/**
 * Environment configuration
 * Toggle DEBUG via localStorage.setItem('CRM_DEBUG', 'true')
 */

export const DEBUG = localStorage.getItem('CRM_DEBUG') === 'true';

if (DEBUG) {
    console.log('[env] DEBUG mode enabled');
} else {
    console.log('[env] Production mode (DEBUG=false)');
}

// Feature flags
export const FEATURES = {
    LAZY_LOADING: true,
    VIRTUAL_SCROLLING: false,
    OFFLINE_MODE: false
};

