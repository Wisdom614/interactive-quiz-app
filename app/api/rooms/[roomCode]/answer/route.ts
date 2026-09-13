import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Player, PlayerAnswerRecord } from '@/types/quiz';

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

    const {
      playerId,
      questionIndex,
      selectedIndex,
      responseTimeMs,
    }: {
      playerId: string;
      questionIndex: number;
      selectedIndex: number;
      responseTimeMs: number;
    } = body;

    if (!playerId || questionIndex === undefined || selectedIndex === undefined) {
      return NextResponse.json({ error: 'Missing answer submission parameters' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-supabase')) {
      return NextResponse.json({ success: true, localOnly: true });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch the room to verify question and compute authoritative score
    const { data: roomData, error: fetchErr } = await supabase
      .from('quiz_rooms')
      .select('quiz, players, current_question_index, status')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (fetchErr || !roomData) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const currentQ = roomData.quiz?.questions?.[questionIndex];
    if (!currentQ) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const isCorrect = selectedIndex === currentQ.correctIndex;
    const duration = currentQ.timeLimit || 15;
    const timeFraction = Math.max(0, 1 - (responseTimeMs / (duration * 1000)));
    const speedBonus = Math.round(timeFraction * 500);

    const existingPlayers = roomData.players || {};
    const player: Player = existingPlayers[playerId] || {
      id: playerId,
      nickname: 'Player',
      avatar: 'v_zap',
      score: 0,
      streak: 0,
      answers: {},
    };

    const streakBonus = isCorrect ? player.streak * 100 : 0;
    const pointsEarned = isCorrect ? ((currentQ.points || 1000) + speedBonus + streakBonus) : 0;

    const answerRecord: PlayerAnswerRecord = {
      questionIndex,
      selectedIndex,
      isCorrect,
      responseTimeMs,
      pointsEarned,
    };

    const updatedAnswers = { ...(player.answers || {}) };
    updatedAnswers[questionIndex] = answerRecord;

    const updatedPlayer: Player = {
      ...player,
      score: player.score + pointsEarned,
      streak: isCorrect ? player.streak + 1 : 0,
      lastAnswer: answerRecord,
      answers: updatedAnswers,
    };

    existingPlayers[playerId] = updatedPlayer;

    const { error: updateErr } = await supabase
      .from('quiz_rooms')
      .update({
        players: existingPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('room_code', cleanCode);

    if (updateErr) {
      console.warn('Failed to update answer in DB:', updateErr);
      return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    }

    // Check if all players have answered
    const totalPlayers = Object.keys(existingPlayers).length;
    const answeredCount = Object.values(existingPlayers).filter(
      (p: any) => p.lastAnswer?.questionIndex === questionIndex
    ).length;

    return NextResponse.json({
      success: true,
      answer: answerRecord,
      player: updatedPlayer,
      allAnswered: totalPlayers > 0 && answeredCount >= totalPlayers,
      answeredCount,
      totalPlayers,
    });
  } catch (error) {
    console.error('Error in answer submission API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
