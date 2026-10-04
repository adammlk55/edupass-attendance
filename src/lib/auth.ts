import 'server-only';
import { createHash } from 'node:crypto';
import { configured, sessionClient, serviceClient } from './supabase';
import { ApiError } from './http';
export async function requireStaff(admin = false) {
  if (!configured()) throw new ApiError('NOT_CONFIGURED', 503);
  const db = await sessionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new ApiError('UNAUTHENTICATED', 401);
  const { data: profile, error: profileError } = await db
    .from('users')
    .select('full_name,role,active')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.active || (admin && profile.role !== 'admin'))
    throw new ApiError('FORBIDDEN', 403);
  return { db, user, profile };
}
export async function requireDevice(req: Request, code: string) {
  const key = req.headers.get('x-device-key');
  if (!key || key.length < 32 || key.length > 256) throw new ApiError('UNAUTHORIZED_DEVICE', 401);
  const db = serviceClient();
  const { data, error } = await db.rpc('device_auth', {
    p_code: code,
    p_hash: createHash('sha256').update(key).digest('hex'),
  });
  if (error) throw error;
  if (!data) throw new ApiError('UNAUTHORIZED_DEVICE', 401);
  return { db, deviceId: data as string };
}
