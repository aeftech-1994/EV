/**
 * EV Backlog Sync — Background Service Worker v1.2
 */

// ─── Injection automatique sur EasyVista ─────────────────────────────────────
// Fallback si le content_script déclaratif est bloqué par CSP résiduel
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url?.includes('foncia.easyvista.com')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => {
      // Silencieux — déjà injecté ou permissions insuffisantes
    });
  }
});

// ─── Auto-sync toutes les 5 minutes ──────────────────────────────────────────
chrome.alarms.create('ev_auto_sync', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'ev_auto_sync') return;
  chrome.tabs.query({ url: 'https://foncia.easyvista.com/*' }, tabs => {
    tabs.forEach(tab => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window._evTriggerSync === 'function') window._evTriggerSync();
        }
      }).catch(() => {});
    });
  });
});

// ─── Messages internes (content script, popup) ───────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TICKETS_UPDATED') {
    chrome.action.setBadgeText({ text: String(msg.count) });
    chrome.action.setBadgeBackgroundColor({ color: '#1565C0' });
    chrome.notifications.create('ev_sync', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'EasyVista Backlog Sync',
      message: `${msg.count} ticket(s) synchronisé(s) — Total : ${msg.total}`
    });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
  }
  if (msg.type === 'GET_TICKETS') {
    chrome.storage.local.get(['ev_tickets', 'ev_last_sync'], data => {
      sendResponse(data);
    });
    return true;
  }
  if (msg.type === 'CLEAR_TICKETS') {
    chrome.storage.local.set({ ev_tickets: [], ev_last_sync: null });
    sendResponse({ ok: true });
  }
  if (msg.type === 'OPEN_EV') {
    chrome.tabs.create({ url: 'https://foncia.easyvista.com/index.php' });
  }
});

// ─── Messages EXTERNES (depuis backlog.html sur localhost) ───────────────────
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TICKETS') {
    chrome.storage.local.get(['ev_tickets', 'ev_last_sync'], data => {
      sendResponse({ tickets: data.ev_tickets || [], lastSync: data.ev_last_sync || null });
    });
    return true;
  }
  if (msg.type === 'PING') {
    sendResponse({ pong: true, version: '1.2' });
    return true;
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
  // Recréer l'alarme au démarrage si elle a disparu
  chrome.alarms.get('ev_auto_sync', alarm => {
    if (!alarm) chrome.alarms.create('ev_auto_sync', { periodInMinutes: 5 });
  });
});
