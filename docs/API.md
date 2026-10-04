# API ESP32 — EduPass v1

Toutes les routes utilisent HTTPS en production et le header `X-Device-Key`. La clé est générée dans **Appareils → fiche appareil → Générer une nouvelle clé**. Elle n’est affichée qu’une fois. `device_code` identifie la borne ; un code différent de celui associé à la clé est refusé. Ne pas embarquer la clé Supabase dans un ESP32.

Les requêtes POST doivent utiliser `Content-Type: application/json`. Taille maximale : 128 Kio, 100 présences par lot. Les UID sont normalisés en majuscules, et acceptent lettres, chiffres, `:`, `_`, `-`. Les identifiants locaux sont uniques par appareil et ne doivent jamais être recyclés après redémarrage.

## Vérifier les versions

`GET /api/device/sync/check?device_code=DEVICE_012&version=1042`

```json
{ "update_available": true, "server_version": 1050, "force_full_sync": false }
```

Ce contrôle actualise aussi la dernière connexion de la borne. Version numérique entière positive ou nulle. Une version supérieure à celle du serveur est refusée : la borne doit alors demander un full avec version zéro.

## Télécharger le cache complet

`GET /api/device/sync/full?device_code=DEVICE_012`

```json
{
  "version": 1050,
  "force_sync_id": null,
  "device": {
    "id": "uuid",
    "device_code": "DEVICE_012",
    "name": "Borne Salle 12",
    "room_id": "uuid",
    "active": true
  },
  "settings": {
    "id": 1,
    "school_name": "Mon établissement",
    "timezone": "Africa/Casablanca",
    "late_minutes": 10
  },
  "rooms": [],
  "teachers": [],
  "students": [],
  "classes": [],
  "subjects": [],
  "timetable": []
}
```

Les tableaux contiennent des objets avec les champs SQL correspondants. Les exemples `uuid` sont à remplacer par les vrais identifiants. Les créneaux sont hebdomadaires, `day_of_week` suit ISO : 1 lundi, 7 dimanche. Les heures `HH:mm:ss` sont locales au fuseau de l’établissement. Les horodatages API sont des instants ISO 8601 avec `Z` ou un décalage explicite.

Le full comprend uniquement les référentiels actifs utiles au planning de la salle. Remplacer tout l’ancien cache, y compris les anciennes entrées devenues inutiles. Une carte non attribuée est `null`.

## Télécharger un delta

`GET /api/device/sync/changes?device_code=DEVICE_012&since_version=1045`

```json
{
  "from_version": 1045,
  "to_version": 1050,
  "force_sync_id": null,
  "changes": [
    { "entity_type": "students", "entity_id": "uuid", "action": "delete", "payload": null }
  ]
}
```

`create` et `update` sont des upserts de `payload`, `delete` retire `entity_id`. Les types sont `device` (singleton), `settings` (singleton), `rooms`, `teachers`, `students`, `classes`, `subjects`, `timetable`. L’ordre du delta n’indique pas l’ordre des dépendances : appliquer tout le delta dans une copie, puis valider les références et remplacer atomiquement le cache. Une liste vide peut quand même avancer la version si seuls d’autres appareils étaient concernés.

Version zéro ou demande forcée : `{"full_sync_required":true,"server_version":1050}`. Faire un full dans ce cas. Le delta est une différence consolidée entre deux versions, pas le journal brut.

## Confirmer la sauvegarde locale

`POST /api/device/sync/ack`

```json
{ "device_code": "DEVICE_012", "version": 1050, "force_sync_id": null, "pending_uploads": 6 }
```

Réponse : `{"ok":true}`. Renvoyer exactement le `force_sync_id` du téléchargement (ou `null`). Seules les versions réellement délivrées à l’appareil sont acceptées. `pending_uploads` décrit les présences restant en file. Ne jamais confirmer avant que le cache et sa version soient persistés.

## Ouvrir une session enregistrée localement

`POST /api/device/session/open`

```json
{
  "device_code": "DEVICE_012",
  "teacher_card_uid": "PROF_001",
  "timestamp": "2026-10-05T07:00:02Z",
  "session_local_id": "boot-a87:lesson-0001",
  "data_version": 1050
}
```

`session_local_id` et `data_version` sont optionnels pour un client en ligne, mais nécessaires au protocole hors ligne. Conserver le corps original pour les retries. Sans `data_version`, le serveur utilise la configuration actuelle. Avec une version, celle-ci doit avoir été téléchargée par la borne.

```json
{
  "ok": true,
  "session": {
    "id": "uuid",
    "teacher_id": "uuid",
    "subject_id": "uuid",
    "class_id": "uuid",
    "room_id": "uuid",
    "device_id": "uuid",
    "timetable_id": "uuid",
    "start_time": "2026-10-05T07:00:00+00:00",
    "end_time": "2026-10-05T08:00:00+00:00",
    "opened_at": "2026-10-05T07:00:02+00:00",
    "status": "open",
    "data_version": 1050,
    "late_minutes": 10,
    "created_at": "..."
  }
}
```

Les libellés sont déjà disponibles dans le cache local ; le serveur renvoie les identifiants et les instants complets. Une même leçon de la journée est réutilisée si le professeur repointe. Un même identifiant local avec un contenu différent produit `LOCAL_ID_CONFLICT`.

## Envoyer un pointage

`POST /api/device/attendance`

```json
{
  "device_code": "DEVICE_012",
  "session_id": "uuid",
  "student_card_uid": "CARD_001",
  "scanned_at": "2026-10-05T07:04:15Z",
  "source": "nfc"
}
```

Utiliser **un seul** de `session_id` et `session_local_id`. `local_id` est conseillé en ligne et obligatoire dans un lot. Sources : `nfc` ou `mobile_ble` (support du protocole, aucune application mobile incluse). Les interventions administratives ne sont pas acceptées sur cette API.

```json
{
  "ok": true,
  "attendance_id": "uuid",
  "student": { "id": "uuid", "name": "Yassine El Mansouri", "massar_code": "M13562489" },
  "status": "present"
}
```

Le serveur utilise le roster figé, calcule le retard depuis le début prévu (10 minutes incluses = présent) et empêche les doublons par session/élève. Une justification manuelle ne peut pas être écrasée par un scan. Les uploads d’une session fermée sont acceptés si l’instant de scan était valide.

## Envoyer un lot hors ligne

`POST /api/device/attendance/bulk`

```json
{
  "device_code": "DEVICE_012",
  "records": [
    {
      "local_id": "boot-a87:scan-0001",
      "session_local_id": "boot-a87:lesson-0001",
      "student_card_uid": "CARD_001",
      "scanned_at": "2026-10-05T07:04:15Z",
      "source": "nfc"
    },
    {
      "local_id": "boot-a87:scan-0002",
      "session_local_id": "boot-a87:lesson-0001",
      "student_card_uid": "CARD_002",
      "scanned_at": "2026-10-05T07:12:00Z",
      "source": "nfc"
    }
  ]
}
```

Le résultat contient `ok` et `results[]`, chaque résultat incluant `local_id` et soit la réponse de présence soit `{"ok":false,"error":"CODE"}`. HTTP **200** si tout réussit, **207** pour des résultats partiels. Chaque record est une transaction indépendante. Retirer de la file uniquement les enregistrements dont `ok=true`. Conserver les échecs avec leur raison ; ne pas perdre tout le lot. Un retry identique renvoie le reçu enregistré avec `duplicate=true`. Le même `local_id` pour un autre contenu est refusé. Les doublons ne créent pas de lignes supplémentaires.

## Erreurs

Format stable : `{"ok":false,"error":"CODE"}`. La validation ajoute une liste `details` (chemin, message).

| HTTP      | Codes principaux                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | `INVALID_JSON`, `VALIDATION_ERROR`                                                                                                                                         |
| 401       | `UNAUTHORIZED_DEVICE`                                                                                                                                                      |
| 404       | `NOT_FOUND`                                                                                                                                                                |
| 409       | `LOCAL_ID_CONFLICT`, `DUPLICATE_VALUE`, `TIMETABLE_CONFLICT`                                                                                                               |
| 413 / 415 | `PAYLOAD_TOO_LARGE` / `JSON_REQUIRED`                                                                                                                                      |
| 422       | `INVALID_TIMESTAMP`, `INVALID_VERSION`, `SYNC_NOT_DELIVERED`, `NO_SCHEDULED_LESSON`, `TEACHER_NOT_FOUND`, `SESSION_NOT_FOUND`, `STUDENT_NOT_IN_CLASS`, `SESSION_CANCELLED` |
| 503       | `NOT_CONFIGURED`                                                                                                                                                           |
| 500       | `INTERNAL_ERROR`                                                                                                                                                           |

Retry sur timeout/5xx avec délai exponentiel et jitter, par exemple 1, 2, 4, 8…60 secondes. Les erreurs 4xx exigent une correction ou une réconciliation administrative. Une borne ne doit jamais bloquer les scans pendant ce retry.

## Routes web et ordonnanceur

- `GET /api/admin/data` : données de l’établissement, connexion staff requise ; 30 jours pour sessions/présences.
- `POST /api/admin/{students|teachers|classes|subjects|rooms|devices|timetable}[/{id}]` : créer ou mettre à jour avec un corps complet validé, rôle admin requis. Désactiver avec `active:false` pour conserver l’historique.
- `POST /api/admin/settings`, `POST /api/admin/devices/{id}/sync`, `POST /api/admin/devices/{id}/key`.
- `POST /api/admin/attendance/{id}` : `{"status":"excused"}` ou `{"status":"absent"}` pour une absence existante.
- `POST /api/admin/sessions/finalize` : clôture des cours échus.
- `GET /api/cron/finalize` : `Authorization: Bearer <CRON_SECRET>` ; aucune authentification appareil acceptée ici.

Les mutations web requièrent aussi un `Origin` identique au site. Les RPC PostgreSQL ne sont pas appelables directement par un client anonyme ou authentifié.
