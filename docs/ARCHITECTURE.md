# EduPass — architecture

## Plan de réalisation

1. Interface française responsive et référentiels administratifs.
2. Authentification Supabase, autorisations administrateur/équipe pédagogique, schéma relationnel.
3. Traitement transactionnel des sessions, listes d’élèves figées et présences idempotentes.
4. Synchronisation versionnée et limitée aux données utiles à chaque salle.
5. Vérification PostgreSQL, validations, build et parcours navigateur.

## Séparation des responsabilités

```text
Administration → Next.js → Supabase Auth + PostgreSQL (RLS)
                              ↑
ESP32 : cache local → file persistante → API /api/device/*
        scan immédiat             X-Device-Key → empreinte SHA-256
```

Le navigateur n’obtient jamais la clé service Supabase. Les opérations administratives vérifient `auth.getUser()` et un profil actif dans `public.users`. Les comptes sans profil ne peuvent pas lire les données. Les administrateurs écrivent les référentiels, le personnel les consulte. Les RPC des appareils sont réservées au rôle serveur `service_role` ; les politiques RLS restent actives sur toutes les tables publiques et privées.

Les sessions et présences sont traitées dans des fonctions PostgreSQL transactionnelles. Les scans d’un appareil sont sérialisés par verrou transactionnel ; les contraintes uniques protègent également contre les doubles écritures. Le planning possède une vérification atomique des conflits (professeur, salle ou classe).

## Synchronisation cohérente

Chaque modification d’un référentiel incrémente une version globale et écrit un journal, dans la même transaction. Les champs de télémétrie ne changent pas cette version. Un verrou partagé sur la version assure un instantané cohérent pendant une synchronisation. La version zéro demande un téléchargement complet.

Le serveur reconstruit les données visibles par l’appareil à la version demandée et à la version actuelle. Le delta est la différence de ces deux ensembles. Un élève quittant les classes de cette salle produit une suppression ; une classe ajoutée au planning produit aussi l’ajout de ses élèves et de son professeur. Un appareil ne reçoit pas les changements des autres salles.

Le journal complet est conservé pour la première version. Cette approche privilégie la correction ; elle doit être mesurée à l’échelle réelle. Pour une grande installation, ajouter des instantanés périodiques et une rétention avec un seuil `full_sync_required`. Ne pas supprimer le journal manuellement : les reconstructions historiques en dépendent.

Le téléchargement est distinct de la confirmation. L’ESP32 écrit dans un fichier temporaire, vérifie son contenu, remplace le cache et sa version atomiquement, puis appelle `/sync/ack`. Un identifiant de demande forcée empêche une ancienne confirmation d’effacer une nouvelle demande.

## Sessions hors ligne

L’ESP32 détermine localement la leçon depuis son planning, son horloge et le fuseau de l’établissement. Il génère un `session_local_id` persistant, puis stocke les scans avec des `local_id` uniques dans une file LittleFS. Aucune réponse HTTP ne bloque le pointage.

Au retour du réseau : envoyer d’abord les ouvertures avec la version du cache réellement téléchargée ; envoyer ensuite les présences. Le serveur réutilise les informations historiques de cette version. La liste d’élèves et les UID sont figés à l’ouverture ; un changement de classe ou de carte n’invalide pas un pointage légitime déjà réalisé. L’appareil doit conserver la version utilisée par chaque session même après mise à jour du cache.

Les horodatages sont acceptés au maximum 30 jours en arrière et 5 minutes dans le futur. Les scans doivent être compris entre l’ouverture et la fin prévue du cours. Le seuil de retard (10 minutes incluses par défaut) est figé à l’ouverture. Le statut transmis par la borne n’est pas une décision autoritaire : le serveur le calcule.

Une tâche quotidienne clôture les sessions échues et produit les absences. L’administrateur peut aussi lancer cette clôture depuis Sessions. Les uploads tardifs remplacent une absence automatique, sans écraser une justification administrative. Parmi plusieurs scans, le plus ancien gagne. Les sessions annulées refusent les uploads.

## Exploitation et limites explicites

- Un projet Supabase correspond à **un établissement**. Ce schéma n’est pas multitenant.
- L’interface charge l’historique des **30 derniers jours** et pagine les lectures Supabase pour éviter la limite implicite de 1 000 lignes. Une garde à 50 000 lignes par collection signale une limite au lieu de tronquer les résultats. Pour des volumes plus importants, remplacer cet agrégat par des requêtes ciblées et des statistiques SQL.
- Le tableau de bord se rafraîchit toutes les 5 secondes lorsque l’onglet est visible.
- `pending_uploads` est le dernier nombre déclaré par l’appareil, pas une mesure en direct d’une borne hors ligne.
- Le statut en ligne est calculé depuis `last_seen_at` (< 5 minutes). Aucun heartbeat n’est nécessaire à chaque scan ; une borne connectée peut faire `/sync/check` chaque minute.
- La rétention des uploads est de 30 jours côté validation ; les historiques SQL et reçus ne sont pas purgés automatiquement.
- Les fonctions ne stockent aucun mot de passe ou jeton appareil en clair. Générer une nouvelle clé remplace l’ancienne.
- Le mode démonstration est explicitement activé et seulement disponible si Supabase n’est pas configuré. Les mutations de démonstration restent dans l’onglet ; les APIs appareil ne simulent jamais de succès.
- Les horaires affichés sont formatés côté serveur puis transmis au navigateur pour éviter les divergences entre versions de bases de fuseaux IANA.
- Une connexion Supabase réelle et un test sur le matériel ESP32 restent nécessaires avant mise en service. Les tests locaux utilisent PostgreSQL via PGlite, pas les services Auth/REST hébergés.

## Sources techniques vérifiées

- [Next.js — installation et App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase — clients SSR et vérification des sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
