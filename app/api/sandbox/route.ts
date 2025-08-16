import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Sandbox route is disabled in this build. Use /api/create-ai-sandbox and related endpoints instead.'
  }, { status: 501 });
}