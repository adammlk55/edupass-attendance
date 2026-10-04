# Vérification locale — 4 octobre 2026

## Résultats

| Vérification                | Résultat                                                    |
| --------------------------- | ----------------------------------------------------------- |
| TypeScript strict           | Réussite                                                    |
| Build de production Next.js | Réussite                                                    |
| Suite PostgreSQL et Zod     | 15 tests, réussite                                          |
| Suite HTTP appareil         | 5 tests, réussite                                           |
| Dashboard desktop           | Contenu et graphiques affichés                              |
| Dashboard mobile            | Menu fonctionnel ; aucune largeur débordante mesurée        |
| Création élève              | Élève ajouté et retrouvé par recherche Massar               |
| Modification élève          | Changement de classe et désactivation visibles              |
| Planning                    | Création chevauchant un cours refusée avec message français |
| Demande de sync             | Indicateur « Synchronisation demandée », bouton en attente  |

## Ce qui est réellement testé

La suite PostgreSQL charge le schéma et le seed réels dans PGlite. Elle vérifie les RPC, les contraintes, le cloisonnement des clés, les autorisations des rôles, les listes de présence historiques, les mouvements de classe, les seuils de retard, les justifications, les retries et les confirmations de sync. Elle ne dépend d’aucun compte distant.

La suite HTTP lance un serveur Next.js de production sur un port local temporaire et appelle ses **vraies routes HTTP** avec `fetch`. Le client Supabase utilise un adaptateur HTTP de test qui transmet les RPC au même schéma PostgreSQL. Ainsi le transport PostgREST hébergé est émulé, mais les handlers, leur authentification appareil, les validations et les fonctions SQL sont exécutés. Les lots partiels produisent HTTP 207 ; un retry ne crée qu’une présence.

```sh
pnpm test
pnpm build
pnpm test:api
```

La suite HTTP nécessite le build récent et l’absence de vraies clés Supabase dans les variables du **build** utilisé. Elle fournit ses propres variables locales au processus isolé. Exécutez-la en checkout de test sans `.env.local` contenant des clés réelles ; les variables publiques Next.js peuvent être intégrées au build.

Les parcours navigateur ont été réalisés sur des données explicitement fictives, sans écriture dans un établissement réel. Une erreur d’hydratation due à des données de fuseau différentes entre Node et le navigateur a été corrigée en transmettant les formats horaires du serveur.

## À vérifier après connexion du nouveau projet

Le propriétaire a demandé de ne pas modifier son compte Supabase existant. Ces vérifications distantes n’ont donc pas été effectuées :

1. Connexion/déconnexion réelle Supabase Auth, compte admin, staff et compte sans profil.
2. Exécution de la migration sur le nouveau projet, vérification des advisors et droits Data API.
3. Fonctionnement du job Supabase Cron dans l’environnement hébergé.
4. Test complet ESP32/Wokwi : cache persistant, coupure Wi-Fi, reprise, batterie/alimentation et horloge.
5. Déploiement Vercel, HTTPS, limites réseau et charge au volume réel de l’établissement.

L’application est livrée localement avec ces étapes documentées ; elle n’est pas déployée ni présentée comme validée sur du matériel réel.
