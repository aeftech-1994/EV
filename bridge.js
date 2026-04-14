/**
 * EV Backlog Bridge — injecté dans backlog.html par l'extension
 * Expose les données du storage dans window.EV_STORAGE
 */
(function() {
  function pushData() {
    chrome.storage.local.get(['ev_tickets', 'ev_last_sync'], function(data) {
      window.postMessage({
        type: 'EV_TICKETS_DATA',
        tickets: data.ev_tickets || [],
        lastSync: data.ev_last_sync || null
      }, 'http://localhost:9999');
    });
  }
  // Push immédiat + toutes les 8 secondes
  pushData();
  setInterval(pushData, 8000);
  // Écouter les demandes du backlog
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'EV_GET_TICKETS') pushData();
  });
})();
