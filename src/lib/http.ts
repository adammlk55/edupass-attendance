import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function readJson(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new ApiError('JSON_REQUIRED', 415);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError('INVALID_JSON');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new ApiError('PAYLOAD_TOO_LARGE', 413);
    }
    chunks.push(value);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError('INVALID_JSON');
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        ok: false,
        error: 'VALIDATION_ERROR',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400,
    );
  if (error instanceof ApiError) return json({ ok: false, error: error.code }, error.status);
  const msg =
    error instanceof Error ? error.message : ((error as { message?: string })?.message ?? '');
  const known = [
    'TIMETABLE_CONFLICT',
    'INACTIVE_REFERENCE',
    'LOCAL_ID_CONFLICT',
    'INVALID_TIMESTAMP',
    'INVALID_VERSION',
    'SYNC_NOT_DELIVERED',
    'INVALID_MODE',
    'DEVICE_NOT_FOUND',
    'TEACHER_NOT_FOUND',
    'NO_SCHEDULED_LESSON',
    'SESSION_NOT_FOUND',
    'SESSION_CANCELLED',
    'STUDENT_NOT_IN_CLASS',
    'NOT_CONFIGURED',
  ];
  if (known.includes(msg))
    return json(
      { ok: false, error: msg },
      msg === 'NOT_CONFIGURED' ? 503 : msg.includes('CONFLICT') ? 409 : 422,
    );
  const code = (error as { code?: string })?.code;
  if (code === '23505') return json({ ok: false, error: 'DUPLICATE_VALUE' }, 409);
  if (code === '23503') return json({ ok: false, error: 'REFERENCE_IN_USE' }, 409);
  if (code === '23514' || code === '22007' || code === '22008')
    return json({ ok: false, error: 'INVALID_VALUE' }, 422);
  console.error('EduPass request failed', { code: code ?? 'INTERNAL_ERROR' });
  return json({ ok: false, error: 'INTERNAL_ERROR' }, 500);
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin !== new URL(req.url).origin) throw new ApiError('INVALID_ORIGIN', 403);
}
