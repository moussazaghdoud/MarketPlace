// Lightweight i18n engine for Rainbow Portal
(function () {
    'use strict';

    var cache = {};
    var currentLang = 'en';
    var currentTranslations = {};
    var SUPPORTED = ['en', 'fr', 'es', 'it', 'de'];
    var DEFAULT_LANG = 'en';

    // Detect language: localStorage > browser > default
    function detectLang() {
        var stored = localStorage.getItem('lang');
        if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
        var nav = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
        return SUPPORTED.indexOf(nav) !== -1 ? nav : DEFAULT_LANG;
    }

    // Fetch and cache a translation file
    function loadTranslations(lang) {
        if (cache[lang]) return Promise.resolve(cache[lang]);
        // Resolve path: works from / or /pages/ since we use absolute path
        var base = window.location.origin;
        return fetch(base + '/i18n/' + lang + '.json')
            .then(function (r) { return r.json(); })
            .then(function (data) { cache[lang] = data; return data; });
    }

    // Get nested value by dot-separated key
    function getKey(obj, key) {
        var parts = key.split('.');
        var val = obj;
        for (var i = 0; i < parts.length; i++) {
            if (val == null) return undefined;
            val = val[parts[i]];
        }
        return val;
    }

    // Translate a single key, with optional fallback to English
    function t(key, fallback) {
        var val = getKey(currentTranslations, key);
        if (val !== undefined) return val;
        // Fallback to English cache
        if (currentLang !== 'en' && cache['en']) {
            val = getKey(cache['en'], key);
            if (val !== undefined) return val;
        }
        return fallback !== undefined ? fallback : key;
    }

    // Apply translations to all data-i18n elements on the page
    function applyTranslations() {
        // data-i18n → textContent
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var val = t(key);
            if (val !== key || currentLang === 'en') el.textContent = val;
        });
        // data-i18n-html → innerHTML
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-html');
            var val = t(key);
            if (val !== key || currentLang === 'en') el.innerHTML = val;
        });
        // data-i18n-placeholder → placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-placeholder');
            var val = t(key);
            if (val !== key || currentLang === 'en') el.placeholder = val;
        });
        // Update html lang attribute
        document.documentElement.lang = currentLang;
        // Update active language in switcher
        var switcher = document.getElementById('lang-current');
        if (switcher) switcher.textContent = currentLang.toUpperCase();
    }

    // Set language and re-apply
    function setLang(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
        currentLang = lang;
        localStorage.setItem('lang', lang);
        loadTranslations(lang).then(function (data) {
            currentTranslations = data;
            applyTranslations();
            // Dispatch event so page scripts can re-render JS-built content
            window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
        });
    }

    // Initialize on DOMContentLoaded
    function init() {
        var lang = detectLang();
        currentLang = lang;
        // Always preload English as fallback
        var promises = [loadTranslations('en')];
        if (lang !== 'en') promises.push(loadTranslations(lang));
        Promise.all(promises).then(function () {
            currentTranslations = cache[lang] || cache['en'];
            applyTranslations();
            window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.i18n = {
        t: t,
        setLang: setLang,
        getLang: function () { return currentLang; },
        supported: SUPPORTED
    };
})();
