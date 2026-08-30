// PNGD2026 PROD secure data bootstrap — Production sheets via authenticated Worker.
(function () {
  'use strict';

  const API_BASE = 'https://pngd-budget-secure-prod.vathit-lim.workers.dev';
  const PROD_SHEET_TO_YEAR = new Map([
    ['1Omvnc6JR4Ie0TIAz3DLON4zfdFICPSOTDMUKfCqk2U0', '2026'],
    ['1CtTmd6oOXZnn299w7olefvdrXWl-R1xvtUQhcK9JaKw', '2027'],
  ]);
  const SESSION_KEY = 'pngd_secure_prod_session_v1';
  const nativeFetch = window.fetch.bind(window);
  let proof = typeof window.__PNGD_PROD_AUTH_PROOF === 'string' ? window.__PNGD_PROD_AUTH_PROOF : '';
  let loginPromise = null;
  delete window.__PNGD_PROD_AUTH_PROOF;

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
    if (!proof) throw new Error('Secure PROD authentication proof is unavailable. Reload and unlock StatiCrypt again.');
    if (!loginPromise) {
      loginPromise = nativeFetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof }),
        cache: 'no-store',
      }).then(async res => {
        if (!res.ok) throw new Error('Secure PROD authentication failed (HTTP ' + res.status + ')');
        const body = await res.json();
        if (!body || !body.token) throw new Error('Secure PROD authentication returned no session');
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
    const year = PROD_SHEET_TO_YEAR.get(match[1]);
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

  window.fetch = function secureProdFetch(input, init) {
    const match = matchSecureSheet(input);
    if (!match) return nativeFetch(input, init);
    return fetchSecureYear(match.year, true);
  };

  window.__PNGD_SECURE_PROD = Object.freeze({
    active: true,
    api: API_BASE,
    dataSource: 'Production sheets via authenticated Worker',
  });

  console.info('[PNGD PROD] secure data gateway active');
})();
