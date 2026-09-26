import { NextResponse } from 'next/server';
import { parseOptimizationRequest } from '@/backend/contracts';
import { apiError, readJson } from '@/backend/http';
import { createOptimization } from '@/backend/worker';

export async function POST(request: Request) {
  try { return NextResponse.json(await createOptimization(parseOptimizationRequest(await readJson(request))), { status: 202 }); }
  catch (error) { return apiError(error); }
}
