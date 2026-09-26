import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'showcam', planning: Boolean(process.env.GEMINI_API_KEY), optimization: Boolean(process.env.GPU_WORKER_URL) });
}
