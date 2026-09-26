import { NextResponse } from 'next/server';
import { apiError, HttpError } from '@/backend/http';
import { cancelOptimization, getOptimization } from '@/backend/worker';

type Context = { params: Promise<{ jobId: string }> };
async function id(context: Context) {
  const jobId = (await context.params).jobId;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(jobId)) throw new HttpError(400, 'Invalid optimization job ID.');
  return jobId;
}

export async function GET(_request: Request, context: Context) {
  try { return NextResponse.json(await getOptimization(await id(context))); }
  catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try { return NextResponse.json(await cancelOptimization(await id(context))); }
  catch (error) { return apiError(error); }
}
