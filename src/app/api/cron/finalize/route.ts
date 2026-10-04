import { timingSafeEqual } from 'node:crypto';
import { serviceClient } from '@/lib/supabase';
import { ApiError, failure, json } from '@/lib/http';
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get('authorization') ?? '';
    const expected = `Bearer ${secret}`;
    if (
      !secret ||
      auth.length !== expected.length ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    )
      throw new ApiError('UNAUTHORIZED', 401);
    const { data, error } = await serviceClient().rpc('finalize_sessions');
    if (error) throw error;
    return json({ ok: true, closed: data });
  } catch (e) {
    return failure(e);
  }
}
