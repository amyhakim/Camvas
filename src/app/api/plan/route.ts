import { NextResponse } from 'next/server';
import { parsePlanShotRequest } from '@/backend/contracts';
import { apiError, readJson } from '@/backend/http';
import { planShot } from '@/backend/gemini';

export async function POST(request: Request) {
  try { return NextResponse.json(await planShot(parsePlanShotRequest(await readJson(request)))); }
  catch (error) { return apiError(error); }
}
