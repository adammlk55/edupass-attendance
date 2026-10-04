import { z } from 'zod';
import { requireDevice } from '@/lib/auth';
import { ApiError, json, failure, readJson } from '@/lib/http';
import {
  deviceCode,
  version,
  openSessionSchema,
  singleAttendanceSchema,
  bulkSchema,
} from '@/lib/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const path = (await ctx.params).path.join('/');
    if (!['sync/check', 'sync/full', 'sync/changes'].includes(path))
      throw new ApiError('NOT_FOUND', 404);
    const query = new URL(req.url).searchParams;
    const code = deviceCode.parse(query.get('device_code'));
    const v = version.parse(query.get(path === 'sync/changes' ? 'since_version' : 'version') ?? 0);
    const { db, deviceId } = await requireDevice(req, code);
    const { data, error } = await db.rpc('device_sync', {
      p_device: deviceId,
      p_mode: path.split('/')[1],
      p_version: v,
    });
    if (error) throw error;
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    const path = (await ctx.params).path.join('/');
    const body = await readJson(req);
    const code = deviceCode.parse(body.device_code);
    const { db, deviceId } = await requireDevice(req, code);
    if (path === 'session/open') {
      const p = openSessionSchema.parse(body);
      const { data, error } = await db.rpc('device_open_session', {
        p_device: deviceId,
        p_card: p.teacher_card_uid,
        p_timestamp: p.timestamp,
        p_local_id: p.session_local_id ?? null,
        p_version: p.data_version ?? null,
      });
      if (error) throw error;
      return json(data);
    }
    if (path === 'attendance') {
      const { device_code: _, ...p } = singleAttendanceSchema.parse(body);
      void _;
      const { data, error } = await db.rpc('device_attendance', {
        p_device: deviceId,
        p_record: p,
      });
      if (error) throw error;
      return json(data);
    }
    if (path === 'attendance/bulk') {
      const p = bulkSchema.parse(body);
      const results = [];
      for (const record of p.records) {
        const { data, error } = await db.rpc('device_attendance', {
          p_device: deviceId,
          p_record: record,
        });
        if (error) {
          const response = failure(error);
          results.push({ local_id: record.local_id, ...(await response.json()) });
        } else results.push({ local_id: record.local_id, ...data });
      }
      return json(
        { ok: results.every((r) => r.ok), results },
        results.every((r) => r.ok) ? 200 : 207,
      );
    }
    if (path === 'sync/ack') {
      const p = z
        .object({
          version,
          force_sync_id: z.uuid().nullable().default(null),
          pending_uploads: z.number().int().min(0).max(1000000).default(0),
        })
        .parse(body);
      const { data, error } = await db.rpc('device_sync', {
        p_device: deviceId,
        p_mode: 'ack',
        p_version: p.version,
        p_force: p.force_sync_id,
        p_pending: p.pending_uploads,
      });
      if (error) throw error;
      return json(data);
    }
    throw new ApiError('NOT_FOUND', 404);
  } catch (e) {
    return failure(e);
  }
}
