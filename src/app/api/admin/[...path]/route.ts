import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getSchoolData } from '@/lib/data';
import { serviceClient } from '@/lib/supabase';
import { ApiError, failure, json, readJson, sameOrigin } from '@/lib/http';
import { entitySchemas } from '@/lib/validation';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(_req: Request, ctx: Context) {
  try {
    if ((await ctx.params).path.join('/') !== 'data') throw new ApiError('NOT_FOUND', 404);
    return json(await getSchoolData());
  } catch (e) {
    return failure(e);
  }
}
async function mutate(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const { db } = await requireStaff(true);
    const [entity, id, action] = (await ctx.params).path;
    if (entity === 'sessions' && id === 'finalize') {
      const { data, error } = await serviceClient().rpc('finalize_sessions');
      if (error) throw error;
      return json({ ok: true, count: data });
    }
    if (entity === 'devices' && id && action) {
      z.uuid().parse(id);
      if (action === 'sync') {
        const { data, error } = await db
          .from('devices')
          .update({ force_sync_id: randomUUID() })
          .eq('id', id)
          .select('id')
          .single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }
      if (action === 'key') {
        const { data: device, error: deviceError } = await db
          .from('devices')
          .select('id')
          .eq('id', id)
          .single();
        if (deviceError || !device) throw new ApiError('NOT_FOUND', 404);
        const key = randomBytes(32).toString('hex');
        const { error } = await serviceClient().rpc('set_device_key', {
          p_device: id,
          p_hash: createHash('sha256').update(key).digest('hex'),
        });
        if (error) throw error;
        return json({ ok: true, key });
      }
      throw new ApiError('NOT_FOUND', 404);
    }
    if (entity === 'attendance' && id) {
      z.uuid().parse(id);
      const p = z.object({ status: z.enum(['absent', 'excused']) }).parse(await readJson(req));
      const { data, error } = await serviceClient()
        .from('attendance')
        .update({ status: p.status, source: 'manual_admin' })
        .eq('id', id)
        .in('status', ['absent', 'excused'])
        .select('id')
        .single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }
    if (!(entity in entitySchemas)) throw new ApiError('NOT_FOUND', 404);
    const table = entity as keyof typeof entitySchemas;
    const p = entitySchemas[table].parse(await readJson(req));
    if (table === 'settings') {
      const { error } = await db.from(table).update(p).eq('id', 1);
      if (error) throw error;
      return json({ ok: true });
    }
    if (id) z.uuid().parse(id);
    const values: Record<string, unknown> = p;
    const q = id ? db.from(table).update(values).eq('id', id) : db.from(table).insert(values);
    const { data, error } = await q.select('id').single();
    if (error) throw error;
    return json({ ok: true, id: data.id }, id ? 200 : 201);
  } catch (e) {
    return failure(e);
  }
}
export const POST = mutate;
export const PATCH = mutate;
