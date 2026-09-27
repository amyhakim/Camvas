import { NextResponse } from 'next/server';
import { audioConfigured } from '@/backend/audio';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'showcam', planning: Boolean(process.env.GEMINI_API_KEY), optimization: Boolean(process.env.GPU_WORKER_URL), models: Boolean(process.env.SKETCHFAB_API_TOKEN), audio: audioConfigured() });
}
