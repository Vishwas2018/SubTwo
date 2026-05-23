import { NextResponse } from 'next/server';

const SENTRY_INGEST_HOST = 'https://sentry.io';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const envelope = await req.text();

  const header = envelope.split('\n')[0] ?? '';
  let dsn: string;
  try {
    dsn = (JSON.parse(header) as { dsn?: string }).dsn ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid envelope' }, { status: 400 });
  }

  if (!dsn) {
    return NextResponse.json({ error: 'Missing dsn' }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(dsn).host;
  } catch {
    return NextResponse.json({ error: 'Invalid dsn' }, { status: 400 });
  }

  if (!host.endsWith('.sentry.io')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const projectId = searchParams.get('p');
  const orgId = searchParams.get('o');
  if (!projectId || !orgId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const upstream = `${SENTRY_INGEST_HOST}/api/${projectId}/envelope/`;
  const response = await fetch(upstream, {
    method: 'POST',
    body: envelope,
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'text/plain' },
  });
}
