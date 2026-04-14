const TYPE_CLS = {INC:'t-inc',SR:'t-sr',CHG:'t-chg',PB:'t-pb'};
const TYPE_LBL = {INC:'INC',SR:'SR',CHG:'CHG',PB:'PB'};

function load() {
  chrome.runtime.sendMessage({type:'GET_TICKETS'}, data => {
    const tickets = data.ev_tickets || [];
    const lastSync = data.ev_last_sync;

    document.getElementById('stat-total').textContent = tickets.length || '0';
    document.getElementById('stat-esc').textContent = tickets.filter(t=>t.status==='Escaladé').length || '0';
    document.getElementById('stat-done').textContent = tickets.filter(t=>t.status==='Résolu').length || '0';

    const dot = document.getElementById('sync-dot');
    const label = document.getElementById('sync-label');
    if (lastSync) {
      dot.classList.remove('off');
      const d = new Date(lastSync);
      label.textContent = `Sync : ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
    } else {
      dot.classList.add('off');
    }

    const list = document.getElementById('ticket-list');
    if (tickets.length === 0) {
      list.innerHTML = '<div class="empty">Ouvrez EasyVista Foncia pour<br>démarrer la synchronisation</div>';
      return;
    }
    const recent = tickets.slice(-8).reverse();
    list.innerHTML = recent.map(t => `
      <div class="ticket-item">
        <span class="t-badge ${TYPE_CLS[t.type]||'t-inc'}">${TYPE_LBL[t.type]||t.type}</span>
        <div>
          <div class="t-title">${t.title}</div>
          <div class="t-id">${t.id} — ${t.status}</div>
        </div>
      </div>
    `).join('');
  });

  // Vérifier si un onglet EV est ouvert
  chrome.tabs.query({url:'https://foncia.easyvista.com/*'}, tabs => {
    const el = document.getElementById('tab-status');
    if (tabs.length > 0) {
      el.textContent = 'Onglet EV : actif ✓';
      el.style.color = '#2E7D32';
    } else {
      el.textContent = 'Onglet EV : inactif';
      el.style.color = '#9E9E9E';
    }
  });
}

function openEV() {
  chrome.runtime.sendMessage({type:'OPEN_EV'});
  window.close();
}

function forceSync() {
  chrome.tabs.query({url:'https://foncia.easyvista.com/*'}, tabs => {
    if (tabs.length === 0) {
      alert('Aucun onglet EasyVista ouvert. Cliquez sur "Ouvrir EasyVista Foncia" d\'abord.');
      return;
    }
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      func: () => {
        // Déclenche un re-scraping DOM
        document.dispatchEvent(new CustomEvent('ev_force_sync'));
        // Scrolle pour déclencher les lazy loads
        window.scrollTo(0, document.body.scrollHeight);
        setTimeout(() => window.scrollTo(0, 0), 500);
      }
    });
    setTimeout(load, 2000);
  });
}

function clearTickets() {
  if (confirm('Vider tous les tickets en cache ?')) {
    chrome.runtime.sendMessage({type:'CLEAR_TICKETS'}, () => load());
  }
}

// Écouter les mises à jour depuis le background
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'TICKETS_UPDATED') load();
});

load();
setInterval(load, 5000);