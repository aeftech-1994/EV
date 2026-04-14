/**
 * EV Backlog Sync — Content Script v1.2
 * Injecté dans foncia.easyvista.com
 * Intercepte les réponses XHR natives d'EasyVista et extrait les tickets
 */

(function () {
  'use strict';

  // ─── Guard anti double-injection ─────────────────────────────────────────
  // background.js peut injecter via scripting.executeScript() en plus du
  // content_scripts déclaratif — on s'assure de n'initialiser qu'une fois
  if (window._EV_SYNC_LOADED) return;
  window._EV_SYNC_LOADED = true;

  // ─── 1. Intercepteur XHR natif ───────────────────────────────────────────
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
          if (
            xhr.status === 200 &&
            (url.includes('/api/1/requests') ||
              (url.includes('/index.php') && url.includes('action=list')) ||
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
    const records = data.records || data.request || data.requests || data.SD_REQUEST || [];

    if (Array.isArray(records) && records.length > 0) {
      tickets = records.map(r => parseEVTicket(r)).filter(Boolean);
    } else if (data.REQUESTID || data.RFC_NUMBER) {
      const t = parseEVTicket(data);
      if (t) tickets = [t];
    }

    if (tickets.length > 0) storeTickets(tickets);
  }

  // ─── 4. Normalisation ticket EV → format backlog ─────────────────────────
  function parseEVTicket(r) {
    if (!r) return null;

    let type = 'INC';
    const rtype = (r.SD_CATALOG_NAME || r.CATALOG_NAME || r.REQUEST_TYPE || '').toUpperCase();
    if (rtype.includes('CHANGE') || rtype.includes('CHANGEMENT') || r.RFC_NUMBER) type = 'CHG';
    else if (rtype.includes('SERVICE') || rtype.includes('DEMANDE') || rtype.includes('SR')) type = 'SR';
    else if (rtype.includes('PROBLEM') || rtype.includes('PROBLEME')) type = 'PB';

    const id = r.REQUESTID || r.RFC_NUMBER || r.REQUEST_NUMBER || r.ID || null;
    if (!id) return null;

    const prio = parsePrio(r.URGENCY_NAME || r.PRIORITY_NAME || r.IMPACT_NAME || '');
    const status = parseStatus(r.STATUS_NAME || r.REQUEST_STATUS || r.STATUS || '');

    let sla = '—';
    if (r.MAX_RESOLUTION_DATE_UT || r.DEADLINE) {
      const deadline = new Date(r.MAX_RESOLUTION_DATE_UT || r.DEADLINE);
      const diffH = Math.round((deadline - Date.now()) / 3600000);
      sla = diffH < 0 ? `${Math.abs(diffH)}h ⚠️` : `${diffH}h`;
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

  // ─── 5. Helpers parsing priorité / statut ────────────────────────────────
  function parsePrio(raw) {
    const s = raw.toLowerCase();
    if (s.includes('critique') || s.includes('critical') || s === '1') return 'Critique';
    if (s.includes('haute') || s.includes('high') || s === '2') return 'Haute';
    if (s.includes('basse') || s.includes('low') || s === '4') return 'Basse';
    return 'Moyenne';
  }

  function parseStatus(raw) {
    const s = raw.toLowerCase();
    if (s.includes('cours') || s.includes('progress') || s.includes('wip')) return 'En cours';
    if (s.includes('attente') || s.includes('wait') || s.includes('pending')) return 'En attente';
    if (s.includes('résolu') || s.includes('resolv') || s.includes('closed') || s.includes('fermé')) return 'Résolu';
    if (s.includes('escalad') || s.includes('escalat')) return 'Escaladé';
    return 'Nouveau';
  }

  // ─── 6. Scraping DOM — grille Kendo UI EasyVista ─────────────────────────
  // EV utilise Kendo UI : les lignes sont dans .k-grid tbody tr ou
  // dans des conteneurs avec data-rqnum / data-id / data-requestid
  function scrapeDOMTickets() {
    // Sélecteurs par ordre de spécificité décroissante
    const rows = document.querySelectorAll([
      '[data-rqnum]',
      '[data-requestid]',
      '[data-id]',
      '.k-grid tbody tr[role="row"]',
      '.k-grid-content tr',
      'table.list-table tr[data-id]',
      'tr.request-row',
      '.ev-list-item'
    ].join(', '));

    if (rows.length === 0) return;

    const tickets = [];
    rows.forEach(row => {
      // Numéro de ticket — data-rqnum est le format EasyVista natif (ex: S260414_000159)
      const evNum = row.dataset.rqnum || row.dataset.requestid || row.dataset.id;
      if (!evNum) return;

      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;

      // Titre — chercher la cellule avec le plus de texte ou un data-title
      const titleCell = row.querySelector('[data-title], .ev-title, td.subject, td:nth-child(2)') || cells[1] || cells[0];
      const title = titleCell.textContent.trim() || `Ticket EV #${evNum}`;

      // Bénéficiaire
      const userCell = row.querySelector('[data-user], .ev-user, td.requestor, td:nth-child(3)') || cells[2];
      const user = userCell?.textContent.trim() || 'Inconnu';

      // Date — chercher un attribut data- ou une cellule date
      const dateRaw =
        row.dataset.submitdate ||
        row.dataset.createdate ||
        row.dataset.date ||
        row.querySelector('[data-date], td.date, td.created-date')?.dataset.date ||
        row.querySelector('td[data-submitdate]')?.dataset.submitdate ||
        extractDateFromCell(row.querySelector('td.date, td:last-child'));

      // Priorité — classes CSS ou texte de cellule
      const prio = extractPrioFromRow(row);

      // Statut — classes CSS ou texte de cellule
      const status = extractStatusFromRow(row);

      // Type — basé sur le préfixe du numéro EV (S = SR, I = INC)
      const type = evNum.startsWith('S') ? 'SR' : evNum.startsWith('I') ? 'INC' : 'INC';

      tickets.push({
        id: `${type}-EV-${evNum}`,
        ev_id: evNum,
        type,
        title,
        user,
        prio,
        status,
        sla: '—',
        assign: 'BERNARD, Freddy',
        date: dateRaw ? formatDate(dateRaw) : formatDate(new Date()),
        cat: 'Téléphonie Mobile',
        desc: `Extrait depuis EasyVista (DOM scraping)`,
        log: [{ d: formatDate(new Date()), a: 'EV DOM Sync', t: 'Extrait depuis le DOM EasyVista' }],
        source: 'dom'
      });
    });

    if (tickets.length > 0) storeTickets(tickets);
  }

  function extractPrioFromRow(row) {
    // Classes CSS communes EasyVista/Kendo pour la priorité
    const classList = row.className + ' ' + (row.innerHTML || '');
    if (/prio[-_]?(1|critique|critical)/i.test(classList)) return 'Critique';
    if (/prio[-_]?(2|haut|high)/i.test(classList)) return 'Haute';
    if (/prio[-_]?(4|bass|low)/i.test(classList)) return 'Basse';

    // Fallback : chercher un élément badge/span avec le texte
    const badge = row.querySelector('.priority, .prio, [class*="prio"], [class*="priority"]');
    if (badge) return parsePrio(badge.textContent);

    return 'Moyenne';
  }

  function extractStatusFromRow(row) {
    // Classes CSS communes EasyVista/Kendo pour le statut
    const classList = row.className;
    if (/status[-_]?(cours|progress|wip)/i.test(classList)) return 'En cours';
    if (/status[-_]?(attente|wait|pending)/i.test(classList)) return 'En attente';
    if (/status[-_]?(resolu|resolv|closed|ferm)/i.test(classList)) return 'Résolu';

    // Fallback : chercher un élément badge/span avec le texte de statut
    const badge = row.querySelector('.status, [class*="status"], .ev-status');
    if (badge) return parseStatus(badge.textContent);

    return 'Nouveau';
  }

  function extractDateFromCell(cell) {
    if (!cell) return null;
    // Format DD/MM/YYYY HH:MM ou DD/MM/YYYY
    const match = cell.textContent.match(/(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?)/);
    if (match) return match[1];
    // Attributs data- sur la cellule
    return cell.dataset.date || cell.dataset.value || null;
  }

  function formatDate(d) {
    try {
      // Gérer le format DD/MM/YYYY HH:MM natif EV
      if (typeof d === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(d)) {
        const [day, month, rest] = d.split('/');
        const [year, time] = rest.split(' ');
        const dt = new Date(`${year}-${month}-${day}T${time || '00:00'}:00`);
        return `${day}/${month} ${time || '00:00'}`;
      }
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

  function storeTickets(tickets) {
    chrome.storage.local.get(['ev_tickets'], result => {
      const existing = result.ev_tickets || [];
      const merged = mergeTickets(existing, tickets);
      chrome.storage.local.set({ ev_tickets: merged, ev_last_sync: new Date().toISOString() });
      chrome.runtime.sendMessage({ type: 'TICKETS_UPDATED', count: tickets.length, total: merged.length });
    });
  }

  // ─── 7. Déclenchement du scraping ────────────────────────────────────────
  if (document.readyState === 'complete') {
    setTimeout(scrapeDOMTickets, 2000);
  } else {
    window.addEventListener('load', () => setTimeout(scrapeDOMTickets, 2000));
  }

  // Re-scraping sur navigation SPA (EV utilise AJAX pour naviguer)
  const observer = new MutationObserver(() => {
    clearTimeout(window._evScrapeTimer);
    window._evScrapeTimer = setTimeout(scrapeDOMTickets, 1500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Exposer la fonction de sync pour que background.js puisse la déclencher
  // via chrome.scripting.executeScript() lors du tick de l'alarme auto-sync
  window._evTriggerSync = scrapeDOMTickets;

  // Signal de présence
  chrome.storage.local.set({ ev_tab_active: true, ev_url: window.location.href });

  console.log('[EV Sync] Content script v1.2 actif sur', window.location.hostname);
})();
