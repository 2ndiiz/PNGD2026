// PNGD2026 DEV secure data bootstrap — TEST sheets only.
(function () {
  'use strict';

  const API_BASE = 'https://pngd-budget-secure-dev.vathit-lim.workers.dev';
  const TEST_SHEET_TO_YEAR = new Map([
    ['13vEju4eyoysO1ETl14I65jBRwhXsKpWR2Q-22hEUhUM', '2026'],
    ['1BWt9Wt4OuQ4s_pNvARettnX4585rMpj-0zjetLAoOP4', '2027'],
  ]);
  const SESSION_KEY = 'pngd_secure_dev_session_v1';
  const nativeFetch = window.fetch.bind(window);
  let proof = typeof window.__PNGD_DEV_AUTH_PROOF === 'string' ? window.__PNGD_DEV_AUTH_PROOF : '';
  let loginPromise = null;
  delete window.__PNGD_DEV_AUTH_PROOF;

  function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  function saveSession(token) {
    try { sessionStorage.setItem(SESSION_KEY, token); } catch (_) { /* session storage unavailable */ }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* ignore */ }
  }

  async function login(force) {
    if (!force) {
      const cached = readSession();
      if (cached) return cached;
    }
    if (!proof) throw new Error('Secure DEV authentication proof is unavailable. Reload and unlock StatiCrypt again.');
    if (!loginPromise) {
      loginPromise = nativeFetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof }),
        cache: 'no-store',
      }).then(async res => {
        if (!res.ok) throw new Error('Secure DEV authentication failed (HTTP ' + res.status + ')');
        const body = await res.json();
        if (!body || !body.token) throw new Error('Secure DEV authentication returned no session');
        saveSession(body.token);
        return body.token;
      }).finally(() => {
        loginPromise = null;
      });
    }
    return loginPromise;
  }

  function matchSecureSheet(input) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, location.href);
    } catch (_) {
      return null;
    }
    if (url.hostname !== 'docs.google.com') return null;
    const match = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)\/gviz\/tq$/);
    if (!match) return null;
    const year = TEST_SHEET_TO_YEAR.get(match[1]);
    return year ? { year, url } : null;
  }

  async function fetchSecureYear(year, retryAuth) {
    const token = await login(false);
    let res = await nativeFetch(API_BASE + '/data?year=' + encodeURIComponent(year), {
      method: 'GET',
      headers: { authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    if (res.status === 401 && retryAuth) {
      clearSession();
      const refreshed = await login(true);
      res = await nativeFetch(API_BASE + '/data?year=' + encodeURIComponent(year), {
        method: 'GET',
        headers: { authorization: 'Bearer ' + refreshed },
        cache: 'no-store',
      });
    }
    return res;
  }

  window.fetch = function secureDevFetch(input, init) {
    const match = matchSecureSheet(input);
    if (!match) return nativeFetch(input, init);
    return fetchSecureYear(match.year, true);
  };

  window.__PNGD_SECURE_DEV = Object.freeze({
    active: true,
    api: API_BASE,
    dataSource: 'TEST sheets only',
  });

  console.info('[PNGD DEV] secure TEST data gateway active');
})();
