const TYPES={INC:{l:'Incident',c:'b-inc'},SR:{l:'Demande SR',c:'b-sr'},CHG:{l:'Changement',c:'b-chg'},PB:{l:'Problème',c:'b-pb'}};
const STATUS={'Nouveau':{c:'s-new',d:'d-new'},'En cours':{c:'s-wip',d:'d-wip'},'En attente':{c:'s-wait',d:'d-wait'},'Résolu':{c:'s-done',d:'d-done'},'Escaladé':{c:'s-esc',d:'d-esc'}};
const PC={Critique:'pc-crit',Haute:'pc-high',Moyenne:'pc-med',Basse:'pc-low'};

let allTickets = [
  {id:'INC-2024-0041',type:'INC',title:'Ligne mobile SFR non reçue — DUPONT Paul',user:'DUPONT Paul',prio:'Critique',status:'Escaladé',sla:'2h ⚠️',assign:'BERNARD, Freddy',date:'14/04 09:12',cat:'Téléphonie Mobile',desc:'La ligne commandée n\'a pas été provisionnée. Escalade Orange requise.',log:[{d:'14/04 09:12',a:'BERNARD F.',t:'Ticket créé et escaladé'}],source:'local'},
  {id:'INC-2024-0040',type:'INC',title:'iPhone 15 bloqué MDM après réinitialisation',user:'MARTIN Claire',prio:'Haute',status:'En cours',sla:'4h',assign:'BERNARD, Freddy',date:'14/04 08:44',cat:'Téléphonie Mobile',desc:'Le profil MDM échoue avec erreur 403 après réinitialisation.',log:[{d:'14/04 08:44',a:'MARTIN C.',t:'Incident déclaré'}],source:'local'},
  {id:'SR-2024-0088',type:'SR',title:'Nouvelle ligne mobile — LEROY Antoine',user:'RH Foncia',prio:'Moyenne',status:'En attente',sla:'24h',assign:'BERNARD, Freddy',date:'13/04 16:30',cat:'Téléphonie Mobile',desc:'Nouvelle embauche — en attente bon de commande OB.',log:[{d:'13/04 16:30',a:'RH',t:'Demande créée'}],source:'local'},
  {id:'CHG-2024-0015',type:'CHG',title:'Migration forfaits 4G → 5G parc mobile',user:'DSI Foncia',prio:'Haute',status:'En cours',sla:'72h',assign:'BERNARD, Freddy',date:'11/04 09:00',cat:'Téléphonie Mobile',desc:'Migration 47 lignes — Phase 1 en cours.',log:[{d:'11/04 09:00',a:'DSI',t:'Changement approuvé'}],source:'local'},
];

let fView='all', fSt='all', fPr='all', counter=43;

function getFiltered(){
  const q=(document.getElementById('q')||{}).value?.toLowerCase()||'';
  return allTickets.filter(t=>{
    if(fView==='ev'&&t.source!=='easyvista')return false;
    if(fView==='esc'&&t.status!=='Escaladé')return false;
    if(['INC','SR','CHG','PB'].includes(fView)&&t.type!==fView)return false;
    if(fSt!=='all'&&t.status!==fSt)return false;
    if(fPr!=='all'&&t.prio!==fPr)return false;
    if(q&&!t.title.toLowerCase().includes(q)&&!t.id.toLowerCase().includes(q)&&!t.user.toLowerCase().includes(q))return false;
    return true;
  });
}

function render(){
  const list=getFiltered();
  const tbody=document.getElementById('tbody');
  if(!list.length){tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:40px;color:#9E9E9E">Aucun ticket</td></tr>';updateBadges();return;}
  tbody.innerHTML=list.map(t=>{
    const tp=TYPES[t.type]||{l:t.type,c:'b-sr'};
    const st=STATUS[t.status]||{c:'s-new',d:'d-new'};
    const isEV=t.source==='easyvista'||t.source==='dom';
    return `<tr onclick="openDetail('${t.id}')">
      <td><input type="checkbox" onclick="event.stopPropagation()"></td>
      <td style="font-family:monospace;font-size:11px;color:#1565C0;font-weight:600">${t.id}</td>
      <td><span class="badge ${tp.c}">${tp.l}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</td>
      <td style="color:#424242">${t.user}</td>
      <td class="pc ${PC[t.prio]||''}">${t.prio}</td>
      <td><span class="sp ${st.c}"><span class="d ${st.d}"></span>${t.status}</span></td>
      <td style="font-size:11px;color:${t.sla.includes('⚠️')?'#D32F2F':'#388E3C'}">${t.sla}</td>
      <td style="font-size:11px;color:#616161">${t.assign}</td>
      <td>${isEV?'<span class="badge b-ev">EV Live</span>':'<span style="font-size:10px;color:#9E9E9E">local</span>'}</td>
      <td style="font-size:11px;color:#9E9E9E;white-space:nowrap">${t.date}</td>
    </tr>`;
  }).join('');
  updateBadges();
}

function updateBadges(){
  document.getElementById('b-all').textContent=allTickets.length;
  document.getElementById('b-inc').textContent=allTickets.filter(t=>t.type==='INC').length;
  document.getElementById('b-sr').textContent=allTickets.filter(t=>t.type==='SR').length;
  document.getElementById('b-chg').textContent=allTickets.filter(t=>t.type==='CHG').length;
  document.getElementById('b-pb').textContent=allTickets.filter(t=>t.type==='PB').length;
  document.getElementById('b-ev').textContent=allTickets.filter(t=>t.source==='easyvista'||t.source==='dom').length;
  document.getElementById('b-esc').textContent=allTickets.filter(t=>t.status==='Escaladé').length;
}

function setView(v,el){
  fView=v;
  document.querySelectorAll('.s-item').forEach(e=>e.classList.remove('active'));
  if(el)el.classList.add('active');
  const titles={all:'Tous les tickets',INC:'Incidents',SR:'Demandes',CHG:'Changements',PB:'Problèmes',ev:'Tickets EasyVista (Live)',esc:'Tickets escaladés'};
  document.getElementById('view-title').textContent='Backlog — '+(titles[v]||v);
  render();
}

function setF(type,val,el){
  const parent=el.parentElement;
  parent.querySelectorAll('.chip').forEach(c=>{
    if(c.onclick&&c.onclick.toString().includes(`'${type}'`))c.classList.remove('active');
  });
  el.classList.add('active');
  if(type==='st')fSt=val;else fPr=val;
  render();
}

function toggleAll(cb){
  document.querySelectorAll('#tbody input[type=checkbox]').forEach(c=>c.checked=cb.checked);
}

function openDetail(id){
  const t=allTickets.find(x=>x.id===id);
  if(!t)return;
  const tp=TYPES[t.type]||{l:t.type,c:'b-sr'};
  const st=STATUS[t.status]||{c:'s-new',d:'d-new'};
  document.getElementById('d-num').textContent=t.id;
  document.getElementById('d-body').innerHTML=`
    ${t.source==='easyvista'?'<div class="banner ev">🔵 Ce ticket est synchronisé depuis EasyVista Foncia en temps réel</div>':''}
    <div class="df"><div class="dl">Type</div><div class="dv"><span class="badge ${tp.c}">${tp.l}</span></div></div>
    <div class="df"><div class="dl">Titre</div><div class="dv" style="font-weight:600;font-size:13px">${t.title}</div></div>
    <div class="df"><div class="dl">Description</div><div class="ddesc">${t.desc}</div></div>
    <hr class="dhr">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="df"><div class="dl">Demandeur</div><div class="dv">${t.user}</div></div>
      <div class="df"><div class="dl">Catégorie</div><div class="dv">${t.cat}</div></div>
      <div class="df"><div class="dl">Priorité</div><div class="dv pc ${PC[t.prio]||''}">${t.prio}</div></div>
      <div class="df"><div class="dl">Statut</div><div class="dv"><span class="sp ${st.c}"><span class="d ${st.d}"></span>${t.status}</span></div></div>
      <div class="df"><div class="dl">Assigné à</div><div class="dv">${t.assign}</div></div>
      <div class="df"><div class="dl">SLA</div><div class="dv">${t.sla}</div></div>
    </div>
    <hr class="dhr">
    <div class="dl" style="margin-bottom:8px">Journal</div>
    ${(t.log||[]).map(l=>`<div class="tl"><div class="tl-dot"></div><div class="tl-t"><strong>${l.a}</strong> — ${l.d}<br>${l.t}</div></div>`).join('')}
  `;
  document.getElementById('detail').style.display='flex';
}
function closeDetail(){document.getElementById('detail').style.display='none';}
function openModal(){document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';}

function createTicket(){
  const tmap={'Incident':'INC','Demande de service':'SR','Changement':'CHG','Problème':'PB'};
  const type=tmap[document.getElementById('f-type').value]||'INC';
  const now=new Date();
  const date=`${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  counter++;
  allTickets.unshift({
    id:`${type}-2024-00${counter}`,type,
    title:document.getElementById('f-title').value||'Nouveau ticket',
    user:document.getElementById('f-user').value||'Inconnu',
    prio:document.getElementById('f-prio').value,
    status:'Nouveau',
    sla:document.getElementById('f-sla').value+'h',
    assign:document.getElementById('f-assign').value,
    date,cat:document.getElementById('f-cat').value,
    desc:document.getElementById('f-desc').value||'—',
    log:[{d:date,a:'Création manuelle',t:'Ticket créé dans le backlog local'}],
    source:'local'
  });
  closeModal();render();
}

// ─── Intégration Extension Chrome ─────────────────────────────────────────
function loadFromExtension(){
  const EXT_ID = 'gpoimkkkkodkaiehedoenhmdcoochgpg';
  try {
    chrome.runtime.sendMessage(EXT_ID, {type:'GET_TICKETS'}, response => {
      if(chrome.runtime.lastError || !response){
        // Fallback bridge.js postMessage
        window.postMessage({type:'EV_GET_TICKETS'},'*');
        return;
      }
      injectEVTickets(response.tickets||[], response.lastSync);
    });
  } catch(e) {
    window.postMessage({type:'EV_GET_TICKETS'},'*');
  }
}

function injectEVTickets(evTickets, lastSync){
  if(!evTickets||evTickets.length===0)return;
  // Merge : les tickets EV écrasent les locaux avec le même id
  const map={};
  allTickets.forEach(t=>map[t.id]=t);
  evTickets.forEach(t=>map[t.id]=t);
  allTickets=Object.values(map);

  // Mettre à jour le statut de sync
  const sdot=document.getElementById('sdot');
  const slabel=document.getElementById('sync-label');
  sdot.classList.remove('off');
  if(lastSync){
    const d=new Date(lastSync);
    slabel.textContent=`EV sync : ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
  } else {
    slabel.textContent=`${evTickets.length} tickets EV chargés`;
  }
  render();
}

// Écouter les messages de l'extension via window
window.addEventListener('message', e=>{
  if(e.data&&e.data.type==='EV_TICKETS_DATA'){
    injectEVTickets(e.data.tickets||[], e.data.lastSync);
  }
});

// Polling automatique si extension disponible (toutes les 10s)
// Auto-sync toutes les 10s
setInterval(loadFromExtension, 10000);
loadFromExtension();

function exportCSV(){
  const rows=[['ID','Type','Titre','Demandeur','Priorité','Statut','SLA','Assigné','Source','Date']];
  allTickets.forEach(t=>rows.push([t.id,t.type,t.title,t.user,t.prio,t.status,t.sla,t.assign,t.source||'local',t.date]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='backlog_ev_foncia.csv';a.click();
  URL.revokeObjectURL(url);
}

function showInstallHelp(){
  alert('Installation de l\'extension Chrome EV Sync :\n\n1. Ouvrez chrome://extensions\n2. Activez le "Mode développeur" (en haut à droite)\n3. Cliquez "Charger l\'extension non empaquetée"\n4. Sélectionnez le dossier "ev-extension"\n5. Ouvrez EasyVista Foncia — la synchronisation démarre automatiquement');
}

render();