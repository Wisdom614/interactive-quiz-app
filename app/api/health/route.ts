import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';

  const hasSupabaseUrl = Boolean(supabaseUrl && !supabaseUrl.includes('your-project'));
  const hasSupabaseKey = Boolean(supabaseAnonKey && !supabaseAnonKey.includes('your-anon-key'));
  const hasGrokKey = Boolean(xaiKey && !xaiKey.includes('your-api-key') && !xaiKey.includes('your-xai-key'));

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configuration: {
      supabase: {
        configured: hasSupabaseUrl && hasSupabaseKey,
        hasUrl: hasSupabaseUrl,
        hasAnonKey: hasSupabaseKey,
        urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'not set',
      },
      grokAI: {
        configured: hasGrokKey,
        keyPresent: Boolean(xaiKey),
        keyPrefix: xaiKey ? xaiKey.substring(0, 6) + '...' : 'not set',
      },
    },
    message: !hasGrokKey || !hasSupabaseUrl
      ? 'Some environment variables are missing in .env. Please add them and restart the dev server.'
      : 'All environment variables detected successfully.',
  });
}
