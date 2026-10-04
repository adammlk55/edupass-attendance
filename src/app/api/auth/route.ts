import { z } from 'zod';
import { sessionClient, configured } from '@/lib/supabase';
import { ApiError, failure, json, readJson, sameOrigin } from '@/lib/http';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!configured()) throw new ApiError('NOT_CONFIGURED', 503);
    const body = await readJson(req);
    const db = await sessionClient();
    if (body.action === 'logout') {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      return json({ ok: true });
    }
    const p = z.object({ email: z.email(), password: z.string().min(1).max(256) }).parse(body);
    const { error } = await db.auth.signInWithPassword(p);
    if (error) throw new ApiError('INVALID_CREDENTIALS', 401);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
