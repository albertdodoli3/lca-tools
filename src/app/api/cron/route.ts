import { NextResponse } from 'next/server';
import { runJobs } from '@/lib/jobs';
import { safeEqual } from '@/lib/crypto';

/** Per uno scheduler esterno: GET /api/cron con header "Authorization: Bearer <CRON_SECRET>". */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  return NextResponse.json(await runJobs());
}
