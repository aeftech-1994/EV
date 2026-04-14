/**
 * EV Backlog Sync — Content Script
 * Injecté dans foncia.easyvista.com
 * Intercepte les réponses XHR natives d'EasyVista et extrait les tickets
 */

(function () {
  'use strict';

  // ─── 1. Intercepteur XHR natif ───────────────────────────────────────────
  // On wrappe XMLHttpRequest pour capter les réponses JSON d'EV
  const OriginalXHR = window.XMLHttpRequest;

  function PatchedXHR() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open.bind(xhr);
    const originalSend = xhr.send.bind(xhr);

    let method = '', url = '';

    xhr.open = function (m, u, ...rest) {
      method = m;
      url = u;
      return originalOpen(m, u, ...rest);
    };

    xhr.send = function (...args) {
      xhr.addEventListener('load', function () {
        try {
          // On cible les endpoints EV qui retournent des listes de tickets/requests
          if (
            xhr.status === 200 &&
            (url.includes('/api/1/requests') ||
              url.includes('/index.php') && url.includes('action=list') ||
              url.includes('SD_REQUEST') ||
              url.includes('catalog') ||
              url.includes('query=SD_REQUEST'))
          ) {
            const ct = xhr.getResponseHeader('Content-Type') || '';
            if (ct.includes('application/json') || ct.includes('text/json')) {
              const data = JSON.parse(xhr.responseText);
              handleEVResponse(data, url);
            }
          }
        } catch (e) {
          // Silencieux — on ne bloque pas le fonctionnement d'EV
        }
      });
      return originalSend(...args);
    };

    return xhr;
  }

  // Copie les propriétés statiques
  Object.keys(OriginalXHR).forEach(k => {
    try { PatchedXHR[k] = OriginalXHR[k]; } catch (e) {}
  });
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // ─── 2. Intercepteur Fetch ────────────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      if (
        url.includes('/api/1/requests') ||
        url.includes('SD_REQUEST') ||
        url.includes('action=list')
      ) {
        const clone = response.clone();
        const data = await clone.json();
        handleEVResponse(data, url);
      }
    } catch (e) {}
    return response;
  };

  // ─── 3. Parser de réponse EasyVista ──────────────────────────────────────
  function handleEVResponse(data, url) {
    let tickets = [];

    // Format API REST EV : { records: [...] } ou { request: [...] }
    const records = data.records || data.request || data.requests || data.SD_REQUEST || [];

    if (Array.isArray(records) && records.length > 0) {
      tickets = records.map(r => parseEVTicket(r)).filter(Boolean);
    } else if (data.REQUESTID || data.RFC_NUMBER) {
      // Ticket unique
      const t = parseEVTicket(data);
      if (t) tickets = [t];
    }

    if (tickets.length > 0) {
      // Stockage local + envoi au background
      chrome.storage.local.get(['ev_tickets'], result => {
        const existing = result.ev_tickets || [];
        const merged = mergeTickets(existing, tickets);
        chrome.storage.local.set({ ev_tickets: merged, ev_last_sync: new Date().toISOString() });
        chrome.runtime.sendMessage({
          type: 'TICKETS_UPDATED',
          count: tickets.length,
          total: merged.length
        });
      });
    }
  }

  // ─── 4. Normalisation ticket EV → format backlog ─────────────────────────
  function parseEVTicket(r) {
    if (!r) return null;

    // Détection du type
    let type = 'INC';
    const rtype = (r.SD_CATALOG_NAME || r.CATALOG_NAME || r.REQUEST_TYPE || '').toUpperCase();
    if (rtype.includes('CHANGE') || rtype.includes('CHANGEMENT') || r.RFC_NUMBER) type = 'CHG';
    else if (rtype.includes('SERVICE') || rtype.includes('DEMANDE') || rtype.includes('SR')) type = 'SR';
    else if (rtype.includes('PROBLEM') || rtype.includes('PROBLEME')) type = 'PB';

    // Numéro
    const id = r.REQUESTID || r.RFC_NUMBER || r.REQUEST_NUMBER || r.ID || null;
    if (!id) return null;

    // Priorité
    const prioRaw = (r.URGENCY_NAME || r.PRIORITY_NAME || r.IMPACT_NAME || '').toLowerCase();
    let prio = 'Moyenne';
    if (prioRaw.includes('critique') || prioRaw.includes('critical') || prioRaw === '1') prio = 'Critique';
    else if (prioRaw.includes('haute') || prioRaw.includes('high') || prioRaw === '2') prio = 'Haute';
    else if (prioRaw.includes('basse') || prioRaw.includes('low') || prioRaw === '4') prio = 'Basse';

    // Statut
    const statusRaw = (r.STATUS_NAME || r.REQUEST_STATUS || r.STATUS || '').toLowerCase();
    let status = 'Nouveau';
    if (statusRaw.includes('cours') || statusRaw.includes('progress') || statusRaw.includes('wip')) status = 'En cours';
    else if (statusRaw.includes('attente') || statusRaw.includes('wait') || statusRaw.includes('pending')) status = 'En attente';
    else if (statusRaw.includes('résolu') || statusRaw.includes('resolv') || statusRaw.includes('closed') || statusRaw.includes('fermé')) status = 'Résolu';
    else if (statusRaw.includes('escalad') || statusRaw.includes('escalat')) status = 'Escaladé';

    // SLA
    let sla = '—';
    if (r.MAX_RESOLUTION_DATE_UT || r.DEADLINE) {
      const deadline = new Date(r.MAX_RESOLUTION_DATE_UT || r.DEADLINE);
      const now = new Date();
      const diffH = Math.round((deadline - now) / 3600000);
      if (diffH < 0) sla = `${Math.abs(diffH)}h ⚠️`;
      else sla = `${diffH}h`;
    } else if (status === 'Résolu') {
      sla = '✓ OK';
    }

    return {
      id: `${type}-EV-${String(id).padStart(6, '0')}`,
      ev_id: id,
      type,
      title: r.DESCRIPTION || r.SHORT_DESCRIPTION || r.TITLE || `Ticket EV #${id}`,
      user: r.REQUESTOR_NAME || r.SUBMITTER_NAME || r.REQUESTOR || 'Inconnu',
      prio,
      status,
      sla,
      assign: r.OWNER_NAME || r.ASSIGNED_TO || 'Non assigné',
      date: formatDate(r.SUBMIT_DATE || r.CREATION_DATE || new Date()),
      cat: r.CATALOG_NAME || r.SD_CATALOG_NAME || r.CATEGORY_NAME || 'Téléphonie Mobile',
      desc: r.DESCRIPTION || r.COMMENT || '—',
      log: [{ d: formatDate(new Date()), a: 'EV Sync', t: 'Synchronisé depuis EasyVista Foncia' }],
      source: 'easyvista'
    };
  }

  function formatDate(d) {
    try {
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    } catch (e) { return '—'; }
  }

  function mergeTickets(existing, incoming) {
    const map = {};
    existing.forEach(t => { map[t.id] = t; });
    incoming.forEach(t => { map[t.id] = { ...map[t.id], ...t }; });
    return Object.values(map);
  }

  // ─── 5. Scraping DOM de secours ───────────────────────────────────────────
  // Si EV utilise du server-side rendering, on peut lire le tableau HTML directement
  function scrapeDOMTickets() {
    const rows = document.querySelectorAll(
      'table.list-table tr[data-id], tr.request-row, .ev-list-item, [data-requestid]'
    );
    if (rows.length === 0) return;

    const tickets = [];
    rows.forEach(row => {
      const id = row.dataset.id || row.dataset.requestid;
      if (!id) return;
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      tickets.push({
        id: `INC-EV-${String(id).padStart(6, '0')}`,
        ev_id: id,
        type: 'INC',
        title: (cells[1] || cells[0]).textContent.trim() || `Ticket EV #${id}`,
        user: (cells[2] || cells[3] || {}).textContent?.trim() || 'Inconnu',
        prio: 'Moyenne',
        status: 'Nouveau',
        sla: '—',
        assign: 'BERNARD, Freddy',
        date: formatDate(new Date()),
        cat: 'Téléphonie Mobile',
        desc: `Extrait depuis EasyVista (DOM scraping)`,
        log: [{ d: formatDate(new Date()), a: 'EV DOM Sync', t: 'Extrait depuis le DOM EasyVista' }],
        source: 'dom'
      });
    });

    if (tickets.length > 0) {
      chrome.storage.local.get(['ev_tickets'], result => {
        const existing = result.ev_tickets || [];
        const merged = mergeTickets(existing, tickets);
        chrome.storage.local.set({ ev_tickets: merged, ev_last_sync: new Date().toISOString() });
        chrome.runtime.sendMessage({ type: 'TICKETS_UPDATED', count: tickets.length, total: merged.length });
      });
    }
  }

  // Lancer le scraping DOM après chargement complet
  if (document.readyState === 'complete') {
    setTimeout(scrapeDOMTickets, 2000);
  } else {
    window.addEventListener('load', () => setTimeout(scrapeDOMTickets, 2000));
  }

  // Re-scraping sur navigation SPA (EV utilise parfois AJAX pour naviguer)
  const observer = new MutationObserver(() => {
    clearTimeout(window._evScrapeTimer);
    window._evScrapeTimer = setTimeout(scrapeDOMTickets, 1500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Signal de présence
  chrome.storage.local.set({ ev_tab_active: true, ev_url: window.location.href });

  console.log('[EV Sync] Content script actif sur', window.location.hostname);
})();
