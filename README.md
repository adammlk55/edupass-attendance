# EduPass

Application de gestion des présences scolaires en français, conçue pour des bornes ESP32 **offline-first**. Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL et Auth. Un projet Supabase dédié par établissement.

## Démarrage local

Node.js 22+ et pnpm sont nécessaires.

```sh
pnpm install --frozen-lockfile
```

Copiez `.env.example` vers `.env.local`. Pour explorer l’interface sans compte Supabase :

```dotenv
EDUPASS_DEMO_MODE=true
```

Laissez les variables Supabase vides en démonstration, puis lancez :

```sh
pnpm dev
```

Ouvrez [EduPass local](http://localhost:3000). Le mode démonstration est visible dans l’interface ; les changements restent en mémoire jusqu’au rechargement. Les données d’exemple sont isolées dans `src/lib/demo.ts`, et aucune API appareil n’écrit de fausses présences. La date de démonstration est le 5 octobre 2026.

**Aucun compte Supabase existant n’a été modifié.** La connexion est prévue pour votre nouveau compte/projet.

## Connecter votre nouveau projet Supabase

1. Créez un **nouveau projet dédié à EduPass** depuis votre nouveau compte. Ce schéma doit être installé dans une base neuve.
2. Ouvrez le SQL Editor. Exécutez le fichier `supabase/migrations/20261004151303_edupass_initial.sql`. `supabase/schema.sql` est une copie lisible de la même migration : ne pas exécuter les deux.
3. Facultatif : exécutez `supabase/seed.sql` pour créer Ahmed, Yassine, Salma, 2BAC STE, Mathématiques, Salle 12, DEVICE_012 et le cours du lundi 08:00–09:00. Le seed ne crée **ni compte ni clé secrète** et s’exécute une seule fois.
4. Dans Authentication → Users, créez votre compte administrateur avec e-mail et mot de passe. Désactivez les inscriptions publiques pour cet outil interne.
5. Copiez l’UUID du compte et ajoutez son profil avec le SQL suivant, en remplaçant l’UUID :

```sql
insert into public.users(id,full_name,role)
values ('UUID_DU_COMPTE_AUTH','Administration','admin');
```

Pour un accès en lecture, créez un autre compte Auth et utilisez `role='staff'`. L’interface ne permet pas de s’accorder soi-même un rôle. Un utilisateur Auth sans profil actif n’accède pas aux données scolaires.

6. Dans les réglages API/Connect de Supabase, récupérez l’URL, la clé publishable et la clé serveur `service_role` (ou secret serveur compatible). Configurez `.env.local` :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLISHABLE
SUPABASE_SERVICE_ROLE_KEY=VOTRE_CLE_SERVEUR
EDUPASS_DEMO_MODE=false
CRON_SECRET=UNE_VALEUR_ALEATOIRE_D_AU_MOINS_32_CARACTERES
```

La clé serveur ne doit jamais être préfixée par `NEXT_PUBLIC_`, publiée dans Git, placée dans le navigateur ou dans un firmware ESP32. `.env.local` est ignoré par Git.

7. Activez **Integrations → Cron** dans Supabase, puis exécutez `supabase/schedule.sql`. Il clôture les cours échus et génère les absences **chaque minute**. Contrôlez son premier résultat dans l’historique Cron. Cette étape est nécessaire pour le suivi automatique dès la fin du cours. [Documentation Supabase Cron](https://supabase.com/docs/guides/cron).
8. Redémarrez `pnpm dev`, connectez-vous à `/login`, puis réglez le nom, le fuseau horaire et le seuil de retard dans **Paramètres**.
9. Dans Appareils, ouvrez la borne et générez sa clé. Copiez-la immédiatement dans sa configuration privée ; seule son empreinte SHA-256 est conservée dans la base.

Le SQL inclut les droits Data API, les politiques RLS, les index et les contraintes. Aucun ajout au schéma `private` dans les schémas exposés de Supabase n’est nécessaire. Gardez ce schéma non exposé.

## Premier test avec l’ESP32 ou le simulateur

Créez un planning couvrant l’instant choisi et assurez-vous que les deux cartes sont affectées à la bonne classe. Les dates d’octobre 2026 dans la documentation sont des exemples ; adaptez-les si elles ne sont pas dans la fenêtre autorisée des 30 jours.

Exemple PowerShell :

```powershell
$env:EDUPASS_URL = 'http://localhost:3000'
$env:DEVICE_CODE = 'DEVICE_012'
$env:DEVICE_KEY = 'CLE_GENEREE_DANS_LA_FICHE_APPAREIL'
$env:SCAN_TIMESTAMP = '2026-10-05T07:00:02Z'
node scripts/device-smoke.mjs
```

Le script télécharge le cache, confirme sa réception, ouvre une session, transmet un pointage, puis répète le même lot et vérifie que la présence n’est pas dupliquée. En firmware, **persist­er** le cache avant de confirmer ; le script de test le conserve seulement en mémoire. Les pointages apparaissent sur le tableau de bord sous cinq secondes.

L’ESP32 doit gérer les scans localement, persister les identifiants et les événements dans LittleFS, et synchroniser en arrière-plan. Il doit d’abord envoyer les sessions puis leurs présences. Les détails du protocole, des retries, des suppressions du delta et des erreurs sont dans [docs/API.md](docs/API.md).

## Pages et fonctionnalités

- Tableau de bord : effectifs, présences, absences, cours, dernières arrivées et état des bornes.
- Élèves et professeurs : recherche, création/modification, désactivation et affectation de cartes NFC.
- Classes : listes d’élèves, emploi du temps et statistiques ; matières et salles : référentiels éditables.
- Emploi du temps hebdomadaire : prévention des conflits de salle, professeur et classe.
- Appareils : détail, clé d’accès, dernière connexion, version et demande de synchronisation.
- Présences et absences : filtres, export CSV et justification administrative.
- Sessions : suivi et clôture manuelle des cours échus ; synchronisation : état des versions et des files.
- Paramètres : nom de l’établissement, fuseau horaire, seuil de retard.

Les suppressions usuelles sont des désactivations pour préserver les historiques. Les mises à jour de données scolaires alimentent automatiquement le journal versionné.

## Vérifier et construire

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Les tests PostgreSQL utilisent PGlite et exécutent le schéma réel. Ils vérifient les clés, les autorisations, les conflits de planning, les instantanés, les mouvements d’élèves, les scans tardifs, les doublons et les confirmations de sync. Aucun Docker ni accès à un compte Supabase n’est requis.

Les vérifications locales ne remplacent pas le test de connexion Auth/REST sur votre nouveau projet ni le test matériel ESP32. Consultez [docs/VERIFICATION.md](docs/VERIFICATION.md) pour les résultats et limites.

## Déployer sur Vercel

1. Placez le projet dans votre dépôt Git, puis importez-le dans Vercel (preset Next.js).
2. Configurez les cinq variables ci-dessus pour l’environnement voulu ; `EDUPASS_DEMO_MODE=false` en production. Build : `pnpm build` ; installation : `pnpm install --frozen-lockfile`.
3. Dans Supabase Auth, réglez Site URL sur votre domaine HTTPS et les URL autorisées selon vos environnements. Les comptes utilisent le login par mot de passe.
4. Conservez le cron Supabase chaque minute. `vercel.json` contient en complément une clôture de secours quotidienne à 19:00 UTC, protégée par `CRON_SECRET`. Le niveau gratuit Vercel n’autorise pas un cron à la minute ; le cron de la base évite cette dépendance. [Limites Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
5. Lancez le script de test contre le domaine déployé, vérifiez les autorisations staff/admin et les headers de sécurité, puis configurez ce domaine HTTPS dans l’ESP32 avec vérification du certificat.

Aucun déploiement ni projet distant n’est créé automatiquement par ce dépôt.

## Structure

```text
src/app/                 Routes web, auth, admin, appareils et cron
src/components/          Interface française et formulaires
src/lib/                 Clients Supabase, autorisations, Zod et modèles
supabase/migrations/     Migration initiale
supabase/seed.sql         Données facultatives
supabase/schedule.sql     Clôture automatique à la minute
scripts/device-smoke.mjs  Test du protocole depuis un ordinateur
tests/                   Vérifications de validation et PostgreSQL
docs/API.md              Contrat ESP32 et exemples
docs/ARCHITECTURE.md      Décisions, invariants et limites
```

Le périmètre initial ne comprend pas le firmware final, les parents, les notifications, la facturation ni une application mobile. L’historique affiché couvre 30 jours ; la base conserve toutes les données. Pour un très grand établissement, prévoir agrégations SQL, pagination par écran et mesures de charge avant exploitation.
