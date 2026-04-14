# EasyVista Backlog Sync — Extension Chrome
## Foncia N2 Téléphonie — BERNARD Freddy

---

## Architecture

```
foncia.easyvista.com  ──►  content.js (intercepte XHR/Fetch + DOM)
                                │
                                ▼
                       chrome.storage.local
                                │
                         ┌──────┴──────┐
                         ▼             ▼
                     popup.html    backlog.html
                  (icône barre)   (backlog complet)
```

---

## Installation (5 minutes)

### Étape 1 — Charger l'extension
1. Ouvrir Chrome → `chrome://extensions`
2. Activer **Mode développeur** (interrupteur en haut à droite)
3. Cliquer **"Charger l'extension non empaquetée"**
4. Sélectionner ce dossier `ev-extension`
5. L'icône EV apparaît dans la barre Chrome ✓

### Étape 2 — Ouvrir EasyVista Foncia
1. Naviguer vers `https://foncia.easyvista.com`
2. Se connecter normalement
3. L'extension démarre automatiquement en arrière-plan

### Étape 3 — Ouvrir le backlog
- Double-cliquer sur `backlog.html` dans ce dossier
  **ou** l'héberger sur un serveur local :
  ```bash
  cd ev-extension
  python3 -m http.server 8888
  # Ouvrir http://localhost:8888/backlog.html
  ```
- Cliquer **"🔄 Sync EV"** dans la barre d'outils

---

## Comment ça fonctionne

### Interception XHR/Fetch
Le `content.js` wraps `XMLHttpRequest` et `window.fetch` pour intercepter
les réponses JSON qu'EasyVista reçoit de son propre serveur.
Cible les endpoints :
- `/api/1/requests` (API REST EV)
- `?action=list` (interface classique)
- Tables contenant `SD_REQUEST`

### Scraping DOM
Si EV utilise du rendu serveur (HTML statique), le script scrape
les lignes de tableau avec sélecteurs :
- `tr[data-id]`, `[data-requestid]`, `.ev-list-item`

### Stockage
Les tickets sont normalisés et stockés dans `chrome.storage.local`.
Le backlog lit ce storage toutes les 10 secondes.

---

## Format ticket normalisé

```json
{
  "id": "INC-EV-000041",
  "ev_id": "41",
  "type": "INC",
  "title": "Description du ticket",
  "user": "NOM Prénom",
  "prio": "Haute",
  "status": "En cours",
  "sla": "4h",
  "assign": "BERNARD, Freddy",
  "cat": "Téléphonie Mobile",
  "source": "easyvista"
}
```

---

## Dépannage

**Les tickets n'apparaissent pas**
→ Naviguer dans EasyVista (ouvrir un ticket, actualiser la liste)
→ Les requêtes XHR déclenchent l'interception

**Erreur CORS**
→ Normal pour les requêtes directes. Le content script contourne ça
  car il s'exécute dans le contexte de la page EV elle-même.

**Badge rouge sur l'icône**
→ Nombre de tickets synchronisés lors de la dernière session

---

## Évolution possible

Pour une vraie API REST EasyVista (si le DSI fournit un token) :
- Ajouter `"host_permissions": ["https://foncia.easyvista.com/api/*"]`
- Faire des appels directs depuis `background.js`
- `GET /api/1/requests?max_rows=100&fields=REQUESTID,DESCRIPTION,...`

---

*Généré par Claude — Freddy Bernard — Foncia N2 Téléphonie — Avril 2026*
