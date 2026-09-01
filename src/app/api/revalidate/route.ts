import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { secret?: string };
  if (body.secret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  revalidatePath('/[locale]', 'page');
  return NextResponse.json({ revalidated: true });
}
