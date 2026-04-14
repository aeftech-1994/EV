# Dossier de Passation — Plateforme AEF Psalm
**Date :** 13 avril 2026  
**Préparé pour :** Claude Code (session suivante)  
**Contexte :** Migration complète de l'espace admin vers l'espace membre

---

## 1. Vue d'ensemble du projet

### Objectif
Faire de `PsalmMembre` la plateforme principale de l'équipe louange AEF, avec toutes les fonctionnalités de gestion. L'espace admin (`PsalmAdmin`) devient uniquement un environnement de développement de nouveaux modules.

### Deux applications

| App | URL | Repo local | Token localStorage |
|-----|-----|-----------|-------------------|
| **PsalmMembre** (principale) | https://psalm.a-e-f.fr | `/Users/fbm/Desktop/PsalmMembre` | `aef_user_token` |
| **PsalmAdmin** (dev uniquement) | https://admin-psalm.a-e-f.fr/admin | `/Users/fbm/Desktop/Psalm` | `aef_admin_token` |

### Stack technique (les deux apps)
- **React 18/19 + TypeScript + Vite**
- **Tailwind CSS v4** avec tokens CSS (`bg-card`, `text-foreground`, `bg-primary`, etc.)
- **React Query v5** (`@tanstack/react-query`) — `staleTime` standard = 300000ms
- **React Router v6**
- **Auth** : `useAuth()` → `hasPermission(action: string)` → gates CRUD
- **API** : `https://api-psalm.a-e-f.fr` — header `X-Session-Token: <token>`

### Déploiement PsalmMembre
```bash
cd /Users/fbm/Desktop/PsalmMembre
npm run build
bash deploy.sh
```
SSH : `bqzk4896@yellow.o2switch.net` | Clé : `/Users/fbm/.ssh/id_ed25519`

---

## 2. Architecture PsalmMembre

```
src/
  pages/           # Une page par route
  components/
    AppLayout.tsx  # Sidebar + header + mobile nav
  contexts/
    AuthContext.tsx # useAuth(), hasPermission(), user.role
    ThemeContext.tsx
  lib/
    api.ts          # Tous les appels HTTP
    equityEngine.ts # Calcul Gini / équité rotations (adapté pour format membre)
    utils.ts
```

### Système de permissions (AuthContext)
```typescript
hasPermission('planning_view')   // Voir le planning
hasPermission('planning_edit')   // Modifier le planning (= responsable_louange)
hasPermission('songs_view')      // Voir les chants
hasPermission('songs_manage')    // CRUD chants
hasPermission('members_manage')  // CRUD membres (À IMPLÉMENTER)
hasPermission('config_view')     // Voir la config
```

### Rôles importants
```
responsable_louange  → planning_edit + songs_manage + (bientôt members_manage)
pasteur              → droits lecture étendue
dirigeant            → peut diriger (pole dirigeant)
conducteur_louange   → alias de responsable_louange
choriste             → pole choriste
pianiste             → pole piano
batteur              → pole batterie
guitariste_electrique → pole guitare_elec
guitariste_acoustique → pole guitare_acou
bassiste             → pole basse
sonorisateur         → pole sonorisation
projectionniste      → pole projection
videaste             → pole video
```

---

## 3. État actuel des modules

### ✅ Modules terminés et déployés

#### PlanningGestionPage.tsx (`/planning-gestion`)
- Stats bar annuelle (Dimanches, Jeunesse, Dirigeants, Choristes, Musiciens)
- Onglets : Par mois / Vue annuelle / Statistiques / Configuration
- Sélecteur de mois avec compteurs
- Filtres colonnes (chips toggle)
- Table avec avatars initiales + noms
- Actions : Modifier + Verrouiller/Déverrouiller par ligne
- **EditModal** : filtre les membres par rôle par pôle (dirigeants → dirigeants, choristes → choristes, etc.)
- **Bouton Régénérer** : algorithme auto-génération (repos 8 sem. dirigeants, 1 sem. autres, 6 choristes, 2 sonos, 2 vidéo, alternance guitare)
- ⚠️ **MANQUE** : règles jeunesse dans Régénérer, noms complets visibles dans tableau, sous-module Config

#### MembresPage.tsx (`/membres`)
- Annuaire lecture seule pour tous les membres connectés
- Filtres par pôle, tri A→Z / Z→A / par rôle
- Vue grille / liste toggle
- Fiche modale avec email (mailto:) et téléphone (tel:)
- Stats bar : Total, Affichés, Rôles distincts
- Squelette loading animé
- ⚠️ **MANQUE** : CRUD pour responsable_louange (créer/modifier/supprimer membres)

#### RotationsPage.tsx (`/rotations`)
- Gated par `planning_edit`
- Utilise `computeEquityReport()` de `equityEngine.ts`
- Filtres : Année/Semestre/Trimestre
- 4 onglets : Vue d'ensemble / Par membre / Par poste / Alertes & conseils
- Score d'équité, coefficient Gini, bar charts par pôle

#### ChantsPage.tsx (`/chants`)
- CRUD complet gated par `songs_manage`
- Filtre par tonalité (chips colorées), par dossier
- Recherche titre/auteur/tonalité/tag
- Upload partition PDF
- Panel détail avec liens YouTube/audio/partition
- SongFormModal : titre, auteur, tonalité, dossier, tags, liens

#### AppLayout.tsx (navigation)
- Sidebar : Mon planning masqué pour `planning_edit` (ils ont Gestion Planning)
- Mobile nav : admin → Planning=/planning-gestion + Rotations | membres → Planning=/mon-planning + Dispo
- ⚠️ **MANQUE** : retirer le lien "Espace admin" en bas à gauche de la sidebar

#### api.ts (extensions récentes)
Fonctions ajoutées lors de cette session :
```typescript
getMembers()           // Liste membres actifs
createSong(data)       // CRUD chants
updateSong(id, data)
deleteSong(id)
uploadPartition(songId, file)
getSpecialEvents()     // CRUD événements
createSpecialEvent(data)
updateSpecialEvent(id, data)
deleteSpecialEvent(id)
saveRunsheet(sundayId, items)
publishRunsheet(sundayId, published)
updateRunsheetStartTime(sundayId, startTime)
```

#### equityEngine.ts (nouveau — adapté pour format membre)
**IMPORTANT :** Différence avec l'admin :
- Admin : champs plats (`s.dirigeant` = string nom, `s.choristes` = string CSV)
- Membre : imbriqué (`s.dir_first`/`s.dir_last`, `s.assignments[pole][{user_id, first_name}]`)

---

### ⚠️ Modules partiellement portés

#### EvenementsPage.tsx (`/evenements`)
- **Actuel (membre)** : liste simple lecture seule, pas de calendrier, pas de CRUD
- **Admin a** : calendrier mensuel complet, CRUD événements spéciaux (titre, date début/fin, type, description, lieu), vue liste + vue calendrier, indicateurs sur les dimanches du planning
- **À faire** : dupliquer le module admin complet, gater le CRUD par `planning_edit`
- **Référence** : `/Users/fbm/Desktop/Psalm/src/pages/EvenementsPage.tsx` (500 lignes)

#### ConducteurPage.tsx (`/conducteur`)
- **Actuel** : lecture seule, affichage du runsheet du prochain dimanche
- **Admin a** : éditeur drag-drop des items, ajout/suppression items, publish/unpublish, heure de début
- **À faire** : rendre éditable pour `planning_edit`, utiliser `saveRunsheet()`, `publishRunsheet()`, `updateRunsheetStartTime()`

---

### ❌ Modules non encore portés

#### Sous-module Configuration du Planning
- **Admin a** (`/cultes` → onglet Config) : liste membres expérimentés (toggle par membre), liste dirigeants jeunesse (configurable)
- **À créer** dans PlanningGestionPage.tsx onglet "Configuration"
- Actuellement : `ConfigView` est juste un placeholder vide

#### Programme du culte (wizard)
- **Admin a** (`/programme`) : wizard pour construire le programme (chants, lectures, prières, annonces)
- **Pas du tout commencé** dans l'espace membre

---

## 4. Tâches prioritaires (ordre de priorité)

### 🔴 Critique — à faire en premier

#### T1 — Règles jeunesse dans l'algorithme Régénérer
**Fichier** : `PsalmMembre/src/pages/PlanningGestionPage.tsx`  
**Fonction** : `generateMonthAssignments()` (ligne ~290 environ)  
**Règles à implémenter** :
```
- 2ème dimanche du mois (jours 8 à 14) → CULTE JEUNESSE
  → Seuls les dirigeants jeunesse peuvent diriger
  → Dirigeants jeunesse = liste configurable (voir ConfigView)
  
- 1er dimanche (jours 1–7), 3ème (15–21), 4ème (22–28), 5ème (29+) → CULTE NORMAL
  → Les dirigeants jeunesse sont EXCLUS ces dimanches
```
**Référence admin** : `/Users/fbm/Desktop/Psalm/src/lib/planningGenerator.ts` lignes 22-40 et 246-255  
**Constante** : `YOUTH_DIRECTORS` = liste de noms hardcodée dans l'admin → à rendre configurable via ConfigView

#### T2 — Noms complets visibles dans le tableau planning
**Fichier** : `PsalmMembre/src/pages/PlanningGestionPage.tsx`  
**Problème** : cellules trop petites, avatars initiales illisibles  
**Solution** : augmenter padding cellules + afficher prénom + nom (pas juste initiales + prénom court)

#### T3 — Retirer le lien "Espace admin" de la sidebar
**Fichier** : `PsalmMembre/src/components/AppLayout.tsx`  
**Ligne** : ~210-218 (bloc avec `hasRole(role, ['responsable_louange', 'pasteur', 'dev'])`)  
Supprimer entièrement ce bloc `<a href="https://admin-psalm.a-e-f.fr/admin/cultes" ...>`

---

### 🟠 Important — prochaine session

#### T4 — Membres CRUD pour responsable_louange
**Fichier** : `PsalmMembre/src/pages/MembresPage.tsx`  
**Gate** : `hasPermission('members_manage')` (à ajouter dans AuthContext / permissions API)  
**Formulaire** : prénom, nom, email, téléphone, rôles (multi-select), actif/inactif  
**API** : vérifier si `members.php?action=create/update/delete` existe (sinon à créer côté PHP)  
**Bonus** : historique des services dans la fiche membre (requête planning filtré par user_id)

#### T5 — Module Événements complet
**Fichier à créer** : `PsalmMembre/src/pages/EvenementsPage.tsx` (réécriture complète)  
**Référence** : `/Users/fbm/Desktop/Psalm/src/pages/EvenementsPage.tsx`  
**Différences d'adaptation** :
- Admin utilise `useEffect` + `useState` direct → membre doit utiliser React Query
- Admin utilise `framer-motion` → ne pas ajouter cette dépendance (absente dans PsalmMembre)
- CRUD gated par `hasPermission('planning_edit')`
**Fonctionnalités** : calendrier mensuel, liste, création/édition/suppression événements spéciaux, types colorés

#### T6 — Sous-module Configuration Planning
**Fichier** : `PsalmMembre/src/pages/PlanningGestionPage.tsx`  
**Composant** : remplacer `ConfigView` (actuellement placeholder) par :
- Section "Membres expérimentés" : liste de tous les choristes avec toggle expérimenté/non
- Section "Dirigeants Jeunesse" : liste des dirigeants avec toggle "peut diriger le culte jeunesse"
- Stockage : idéalement via API (`members.php?action=update` avec champ `is_experienced` / `is_youth_director`), sinon localStorage partagé

---

### 🟡 Amélioration — sessions suivantes

#### T7 — Régénérer avancé
- **Mode partiel** : ne pas écraser les dimanches déjà assignés manuellement
- **Aperçu avant sauvegarde** : modal diff "avant/après" par dimanche
- **Score d'équité prévu** : afficher le Gini calculé avant d'appliquer
- **Respect membres indisponibles** : intégrer les absences déclarées dans l'algo

#### T8 — Tableau planning amélioré
Options proposées à l'utilisateur (choisir) :
- **Option A** : cellules plus hautes + prénom+nom complet (quick win)
- **Option B** : vue "cartes par dimanche" (chaque dimanche = carte expandable avec tous les noms)
- **Option C** : vue "roster/swimlanes" (lignes = personnes, colonnes = dimanches)
- **Option D** : drag & drop inter-dimanches pour réassigner

#### T9 — ConducteurPage éditable
**Fichier** : `PsalmMembre/src/pages/ConducteurPage.tsx`  
**Gate** : `planning_edit`  
**APIs disponibles** : `saveRunsheet()`, `publishRunsheet()`, `updateRunsheetStartTime()` (dans api.ts)  
**Fonctionnalités** : réordonner items drag-drop, ajouter/supprimer items, publier/dépublier

#### T10 — Programme du culte
**Référence** : `/Users/fbm/Desktop/Psalm/src/pages/ProgrammePage.tsx`  
Wizard de construction du programme de culte (chants + lectures + prières + annonces)

---

## 5. Données techniques importantes

### Format des données planning (⚠️ différence admin vs membre)

**Admin** (format plat) :
```json
{
  "id": "123",
  "date": "2026-04-06",
  "dirigeant": "Jean Dupont",
  "choristes": "Marie Martin, Paul Durand, ...",
  "piano": "Sophie Bernard",
  "is_jeunesse": true
}
```

**Membre** (format imbriqué) :
```json
{
  "id": "123",
  "date": "2026-04-06",
  "dir_first": "Jean",
  "dir_last": "Dupont",
  "dirigeant_id": "42",
  "is_jeunesse": true,
  "assignments": {
    "choriste": [{"user_id": "5", "first_name": "Marie", "last_name": "Martin", "confirmed": false}],
    "piano":    [{"user_id": "8", "first_name": "Sophie", "last_name": "Bernard", "confirmed": false}]
  }
}
```

### `assignSunday()` — payload pour modifier un dimanche
```typescript
assignSunday(sundayId: string, {
  dirigeant_id?: string | null,
  note?: string | null,
  poles: {
    choriste:     string[],  // user_ids
    piano:        string[],
    batterie:     string[],
    guitare_elec: string[],
    guitare_acou: string[],
    basse:        string[],
    sonorisation: string[],
    projection:   string[],
    video:        string[],
  }
})
```

### Pôles → Rôles requis (POLE_ROLES dans PlanningGestionPage)
```typescript
choriste:     ['choriste']
piano:        ['pianiste']
batterie:     ['batteur']
guitare_elec: ['guitariste_electrique']
guitare_acou: ['guitariste_acoustique']
basse:        ['bassiste']
sonorisation: ['sonorisateur']
projection:   ['projectionniste']
video:        ['videaste']
```

### isSecondSunday (règle jeunesse)
```typescript
// Un dimanche est "2ème dimanche du mois" si son jour tombe entre 8 et 14
const isSecondSunday = (dateStr: string) => {
  const day = new Date(dateStr).getDate();
  return day >= 8 && day <= 14;
};
```

---

## 6. Fichiers clés à lire avant de modifier

| Fichier | Pourquoi |
|---------|----------|
| `PsalmMembre/src/lib/api.ts` | Toutes les fonctions API disponibles — vérifier avant d'en ajouter |
| `PsalmMembre/src/contexts/AuthContext.tsx` | Liste des permissions disponibles — modifier si nouvelle permission nécessaire |
| `PsalmMembre/src/components/AppLayout.tsx` | Navigation sidebar + mobile — modifier pour ajouter des routes |
| `PsalmMembre/src/App.tsx` | Routes — ajouter `<Route>` ici pour chaque nouvelle page |
| `Psalm/src/pages/EvenementsPage.tsx` | Référence admin pour le module Événements à porter |
| `Psalm/src/lib/planningGenerator.ts` | Algorithme admin de référence (règles jeunesse, expérimentés) |

---

## 7. Checklist de fin de session

Avant chaque déploiement :
```bash
cd /Users/fbm/Desktop/PsalmMembre
npm run build        # Doit compiler sans erreur TypeScript
bash deploy.sh       # Upload vers o2switch
```
Vérifier sur https://psalm.a-e-f.fr/ après déploiement.

---

## 8. Résumé visuel de l'état des modules

```
MODULE                  MEMBRE          ADMIN (référence)
─────────────────────────────────────────────────────────
Tableau de bord         ✅ complet       ✅
Mon planning            ✅ complet       N/A
Absences                ✅ complet       N/A
Disponibilités          ✅ complet       N/A
Membres                 🟡 lecture seule  ✅ CRUD complet
  └─ CRUD admin         ❌ À faire       ✅
Événements              🟡 liste basique ✅ calendrier CRUD
Bibliothèque chants     ✅ CRUD complet  ✅
Gestion planning        🟡 partiel       ✅
  └─ Table visible      ❌ noms tronqués ✅ noms lisibles
  └─ Régénérer          🟡 sans jeunesse ✅ avec jeunesse
  └─ Configuration      ❌ placeholder   ✅ expérimentés+jss
Rotations & équité      ✅ complet       ✅
Conducteur              🟡 lecture seule ✅ éditable
Programme culte         ❌ non démarré   ✅
─────────────────────────────────────────────────────────
Lien "Espace admin"     ⚠️ À retirer    N/A
```

---

*Document généré le 13 avril 2026 — Session Claude Code*
