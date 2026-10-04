import type { SchoolData } from './types';
export function withClock(data: Omit<SchoolData, 'clock'>): SchoolData {
  const stamps = new Set<string>([data.asOf]);
  for (const collection of [data.devices, data.sessions, data.attendance])
    for (const row of collection)
      for (const key of [
        'last_seen_at',
        'last_sync_at',
        'start_time',
        'end_time',
        'scanned_at',
        'synced_at',
        'opened_at',
      ])
        if (typeof row[key] === 'string') stamps.add(String(row[key]));
  const zone = data.settings.timezone;
  const date = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone,
  });
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  });
  const short = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: zone,
  });
  const long = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  });
  return {
    ...data,
    clock: Object.fromEntries(
      [...stamps].map((s) => [
        s,
        {
          date: date.format(new Date(s)),
          time: time.format(new Date(s)),
          shortDate: short.format(new Date(s)),
          dateTime: long.format(new Date(s)),
        },
      ]),
    ),
  };
}
