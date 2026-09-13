import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Player } from '@/types/quiz';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params;
    const cleanCode = (roomCode || '').toUpperCase();
    const body = await req.json();
    const player: Player = body.player;

    if (!player || !player.id || !player.nickname) {
      return NextResponse.json({ error: 'Valid player object required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-supabase')) {
      return NextResponse.json({ success: true, localOnly: true });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch existing players for the room
    const { data: roomData, error: fetchErr } = await supabase
      .from('quiz_rooms')
      .select('players, max_candidates, status')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (fetchErr || !roomData) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const existingPlayers = roomData.players || {};
    const totalCount = Object.keys(existingPlayers).length;

    // Check capacity if room is not yet joined by this player
    if (
      !existingPlayers[player.id] &&
      roomData.max_candidates &&
      totalCount >= roomData.max_candidates
    ) {
      return NextResponse.json(
        { error: `Room has reached max capacity (${roomData.max_candidates} players)` },
        { status: 403 }
      );
    }

    // Merge player while preserving existing answer records
    const existingPlayer = existingPlayers[player.id];
    const mergedPlayer: Player = {
      ...player,
      score: existingPlayer?.score ?? player.score ?? 0,
      streak: existingPlayer?.streak ?? player.streak ?? 0,
      answers: { ...(existingPlayer?.answers || {}), ...(player.answers || {}) },
      lastAnswer: existingPlayer?.lastAnswer || player.lastAnswer,
    };

    existingPlayers[player.id] = mergedPlayer;

    const { error: updateErr } = await supabase
      .from('quiz_rooms')
      .update({
        players: existingPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('room_code', cleanCode);

    if (updateErr) {
      console.warn('Failed to update players in DB:', updateErr);
      return NextResponse.json({ error: 'Failed to update player in room' }, { status: 500 });
    }

    return NextResponse.json({ success: true, player: mergedPlayer, totalPlayers: Object.keys(existingPlayers).length });
  } catch (error) {
    console.error('Error in join room API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
