import { GameRoom, GameState, Player, BroadcastEvent, Quiz } from '@/types/quiz';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

const ROOM_STORAGE_KEY = 'quizpulse_room_';
const ROOM_INDEX_KEY = 'quizpulse_room_index';

export class GameRoomManager {
  private roomCode: string;
  private channelName: string;
  private localBroadcast: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
  private listeners: Set<(event: BroadcastEvent) => void> = new Set();
  private isSupabaseSubscribed = false;
  private pendingBroadcastQueue: BroadcastEvent[] = [];

  constructor(roomCode: string) {
    this.roomCode = roomCode.toUpperCase();
    this.channelName = `room_${this.roomCode}`;

    if (typeof window !== 'undefined') {
      try {
        this.localBroadcast = new BroadcastChannel(`quizpulse_${this.channelName}`);
        this.localBroadcast.onmessage = (event) => {
          this.notifyListeners(event.data as BroadcastEvent);
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }

      const supabase = getSupabaseClient();
      if (supabase && isSupabaseConfigured) {
        this.supabaseChannel = supabase.channel(this.channelName, {
          config: { broadcast: { self: false } },
        });

        this.supabaseChannel
          .on('broadcast', { event: 'game_event' }, ({ payload }) => {
            this.notifyListeners(payload as BroadcastEvent);
          })
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'quiz_rooms', filter: `room_code=eq.${this.roomCode}` },
            (payload) => {
              const newRow = payload.new as any;
              if (newRow && newRow.room_code === this.roomCode) {
                const parsedRoom: GameRoom = {
                  id: newRow.id,
                  roomCode: newRow.room_code,
                  hostId: newRow.host_id,
                  creatorId: newRow.creator_id,
                  creatorName: newRow.creator_name,
                  quiz: newRow.quiz,
                  status: newRow.status,
                  currentQuestionIndex: newRow.current_question_index || 0,
                  questionStartedAt: newRow.question_started_at,
                  scheduledStartAt: newRow.scheduled_start_at,
                  isPublic: newRow.is_public !== false,
                  maxCandidates: newRow.max_candidates,
                  settings: newRow.settings || {
                    timePerQuestion: 15,
                    speedBonus: true,
                    streakBonus: true,
                    showExplanations: true,
                    aiCommentaryEnabled: true,
                  },
                  players: newRow.players || {},
                  lastRevealedAnswer: newRow.last_revealed_answer,
                };
                this.notifyListeners({
                  type: 'ROOM_SYNC',
                  room: parsedRoom,
                });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.isSupabaseSubscribed = true;
              // Flush any events that were queued before websocket was ready
              while (this.pendingBroadcastQueue.length > 0) {
                const queued = this.pendingBroadcastQueue.shift();
                if (queued && this.supabaseChannel) {
                  this.supabaseChannel.send({
                    type: 'broadcast',
                    event: 'game_event',
                    payload: queued,
                  });
                }
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              this.isSupabaseSubscribed = false;
            }
          });
      }
    }
  }

  public subscribe(callback: (event: BroadcastEvent) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: BroadcastEvent) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Room event listener error', err);
      }
    });
  }

  public broadcast(event: BroadcastEvent) {
    this.notifyListeners(event);

    if (this.localBroadcast) {
      this.localBroadcast.postMessage(event);
    }

    if (this.supabaseChannel) {
      if (this.isSupabaseSubscribed) {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'game_event',
          payload: event,
        });
      } else {
        // Queue it until websocket subscription is ready
        this.pendingBroadcastQueue.push(event);
      }
    }
  }

  public saveRoom(room: GameRoom) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${ROOM_STORAGE_KEY}${this.roomCode}`, JSON.stringify(room));
      
      // Update global index of active rooms
      const indexStr = localStorage.getItem(ROOM_INDEX_KEY);
      const index: string[] = indexStr ? JSON.parse(indexStr) : [];
      if (!index.includes(this.roomCode)) {
        index.push(this.roomCode);
        localStorage.setItem(ROOM_INDEX_KEY, JSON.stringify(index));
      }

      // Synchronize with Supabase database for cross-device access
      this.syncWithSupabase(room);
    } catch (e) {
      console.warn('Failed to save room locally', e);
    }
  }

  public async syncWithSupabase(room: GameRoom): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return;

    try {
      // Non-destructive merge: if database has players with recent answers or new joins, merge them with local
      let mergedPlayers = { ...(room.players || {}) };
      try {
        const { data: latestDb } = await supabase
          .from('quiz_rooms')
          .select('players')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (latestDb && latestDb.players) {
          const dbPlayers = latestDb.players;
          Object.keys(dbPlayers).forEach((pid) => {
            const dbP = dbPlayers[pid];
            const localP = mergedPlayers[pid];
            if (!localP) {
              mergedPlayers[pid] = dbP;
            } else {
              const mergedAnswers: Record<number, any> = { ...(dbP.answers || {}), ...(localP.answers || {}) };
              const authoritativeScore: number = Object.values(mergedAnswers).reduce(
                (sum: number, a: any) => sum + (Number(a?.pointsEarned) || 0),
                0
              );
              mergedPlayers[pid] = {
                ...localP,
                score: authoritativeScore > 0 ? authoritativeScore : Math.max(localP.score || 0, dbP.score || 0),
                streak: Math.max(localP.streak || 0, dbP.streak || 0),
                answers: mergedAnswers,
                lastAnswer: localP.lastAnswer || dbP.lastAnswer,
              };
            }
          });
        }
      } catch {
        // Continue with local players if select fails
      }

      const { error } = await supabase
        .from('quiz_rooms')
        .upsert({
          id: room.id,
          room_code: room.roomCode,
          host_id: room.hostId,
          creator_id: room.creatorId || null,
          creator_name: room.creatorName || null,
          quiz: room.quiz,
          status: room.status,
          current_question_index: room.currentQuestionIndex,
          question_started_at: room.questionStartedAt,
          scheduled_start_at: room.scheduledStartAt,
          is_public: room.isPublic,
          max_candidates: room.maxCandidates,
          settings: room.settings,
          players: mergedPlayers,
          last_revealed_answer: room.lastRevealedAnswer,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('Supabase DB sync warning:', error);
      }
    } catch (err) {
      console.warn('Supabase DB sync catch:', err);
    }
  }

  /**
   * Adds or updates a player directly in the cloud database for instant host discovery
   */
  public async addPlayerDirectly(player: Player): Promise<void> {
    try {
      const res = await fetch(`/api/rooms/${this.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
      if (res.ok) return;
    } catch {
      // Fall back to direct Supabase client write
    }

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return;

    try {
      const { data } = await supabase
        .from('quiz_rooms')
        .select('players')
        .eq('room_code', this.roomCode)
        .maybeSingle();

      const existingPlayers = data?.players || {};
      const existing = existingPlayers[player.id];
      existingPlayers[player.id] = {
        ...player,
        score: existing?.score ?? player.score ?? 0,
        streak: existing?.streak ?? player.streak ?? 0,
        answers: { ...(existing?.answers || {}), ...(player.answers || {}) },
      };

      await supabase
        .from('quiz_rooms')
        .update({
          players: existingPlayers,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode);
    } catch (err) {
      console.warn('Direct player addition error:', err);
    }
  }

  /**
   * Guaranteed submission of an answer to cloud database via REST API with Supabase fallback
   */
  public async submitAnswerDirectly(
    playerId: string,
    questionIndex: number,
    selectedIndex: number,
    responseTimeMs: number
  ): Promise<void> {
    try {
      const res = await fetch(`/api/rooms/${this.roomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          questionIndex,
          selectedIndex,
          responseTimeMs,
        }),
      });
      if (res.ok) return;
    } catch {
      // Fallback
    }

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return;

    try {
      const { data: roomData } = await supabase
        .from('quiz_rooms')
        .select('quiz, players')
        .eq('room_code', this.roomCode)
        .maybeSingle();

      if (roomData) {
        const currentQ = roomData.quiz?.questions?.[questionIndex];
        const isCorrect = currentQ && currentQ.correctIndex === selectedIndex;
        const duration = currentQ?.timeLimit || 15;
        const timeFraction = Math.max(0, 1 - (responseTimeMs / (duration * 1000)));
        const speedBonus = Math.round(timeFraction * 500);

        const existingPlayers = roomData.players || {};
        const p = existingPlayers[playerId] || {
          id: playerId,
          nickname: 'Player',
          avatar: 'v_zap',
          score: 0,
          streak: 0,
          answers: {},
        };

        const streakBonus = isCorrect ? p.streak * 100 : 0;
        const pointsEarned = isCorrect ? ((currentQ?.points || 1000) + speedBonus + streakBonus) : 0;

        const answerRecord = {
          questionIndex,
          selectedIndex,
          isCorrect,
          responseTimeMs,
          pointsEarned,
        };

        const updatedAnswers: Record<number, any> = { ...(p.answers || {}) };
        updatedAnswers[questionIndex] = answerRecord;

        const authoritativeScore: number = Object.values(updatedAnswers).reduce(
          (sum: number, a: any) => sum + (Number(a?.pointsEarned) || 0),
          0
        );

        existingPlayers[playerId] = {
          ...p,
          score: authoritativeScore,
          streak: isCorrect ? (p.streak || 0) + 1 : 0,
          lastAnswer: answerRecord,
          answers: updatedAnswers,
        };

        await supabase
          .from('quiz_rooms')
          .update({
            players: existingPlayers,
            updated_at: new Date().toISOString(),
          })
          .eq('room_code', this.roomCode);
      }
    } catch (err) {
      console.warn('Fallback submitAnswerDirectly error:', err);
    }
  }

  public getSavedRoom(): GameRoom | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`${ROOM_STORAGE_KEY}${this.roomCode}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Asynchronously fetches the room state across devices.
   * 1. Checks local cache first.
   * 2. If missing on this device (e.g. mobile phone joining desktop host), queries Supabase DB.
   * 3. Caches locally and returns the room.
   */
  public async fetchRoomAsync(): Promise<GameRoom | null> {
    const local = this.getSavedRoom();
    if (local) return local;

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('quiz_rooms')
          .select('*')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (data && !error) {
          const room: GameRoom = {
            id: data.id,
            roomCode: data.room_code,
            hostId: data.host_id,
            creatorId: data.creator_id,
            creatorName: data.creator_name,
            quiz: data.quiz,
            status: data.status,
            currentQuestionIndex: data.current_question_index || 0,
            questionStartedAt: data.question_started_at,
            scheduledStartAt: data.scheduled_start_at,
            isPublic: data.is_public !== false,
            maxCandidates: data.max_candidates,
            settings: data.settings || {
              timePerQuestion: 15,
              speedBonus: true,
              streakBonus: true,
              showExplanations: true,
              aiCommentaryEnabled: true,
            },
            players: data.players || {},
            lastRevealedAnswer: data.last_revealed_answer,
          };

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`${ROOM_STORAGE_KEY}${this.roomCode}`, JSON.stringify(room));
            } catch (e) {
              // ignore
            }
          }
          return room;
        }
      } catch (err) {
        console.warn('Failed to fetch room from Supabase:', err);
      }
    }

    return null;
  }

  private inFlightLookup: Promise<GameRoom | null> | null = null;

  /**
   * Directly queries the latest room state from Supabase Cloud DB with in-flight deduplication.
   */
  public async lookupRoomStateAsync(): Promise<GameRoom | null> {
    if (this.inFlightLookup) {
      return this.inFlightLookup;
    }

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return null;

    this.inFlightLookup = (async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_rooms')
          .select('id, room_code, host_id, creator_id, creator_name, quiz, status, current_question_index, question_started_at, scheduled_start_at, is_public, max_candidates, settings, players, last_revealed_answer')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (data && !error) {
          return {
            id: data.id,
            roomCode: data.room_code,
            hostId: data.host_id,
            creatorId: data.creator_id,
            creatorName: data.creator_name,
            quiz: data.quiz,
            status: data.status,
            currentQuestionIndex: data.current_question_index || 0,
            questionStartedAt: data.question_started_at,
            scheduledStartAt: data.scheduled_start_at,
            isPublic: data.is_public !== false,
            maxCandidates: data.max_candidates,
            settings: data.settings || {
              timePerQuestion: 15,
              speedBonus: true,
              streakBonus: true,
              showExplanations: true,
              aiCommentaryEnabled: true,
            },
            players: data.players || {},
            lastRevealedAnswer: data.last_revealed_answer,
          };
        }
      } catch (err) {
        console.warn('Failed to direct lookup room state:', err);
      } finally {
        setTimeout(() => {
          this.inFlightLookup = null;
        }, 300);
      }
      return null;
    })();

    return this.inFlightLookup;
  }


  public cleanup() {
    if (this.localBroadcast) {
      this.localBroadcast.close();
      this.localBroadcast = null;
    }
    if (this.supabaseChannel) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.removeChannel(this.supabaseChannel);
      }
      this.supabaseChannel = null;
    }
    this.listeners.clear();
    this.isSupabaseSubscribed = false;
    this.pendingBroadcastQueue = [];
  }
}

const roomManagers: Map<string, GameRoomManager> = new Map();

export function getRoomManager(roomCode: string): GameRoomManager {
  const code = roomCode.toUpperCase();
  if (!roomManagers.has(code)) {
    roomManagers.set(code, new GameRoomManager(code));
  }
  return roomManagers.get(code)!;
}

export function createInitialRoom(
  roomCode: string,
  quiz: Quiz,
  hostId: string,
  scheduledStartAt?: number | null,
  creatorId?: string,
  creatorName?: string,
  maxCandidates?: number | null,
  timePerQuestion?: number
): GameRoom {
  const chosenTime = timePerQuestion && timePerQuestion > 0
    ? timePerQuestion
    : (quiz?.questions?.[0]?.timeLimit || 15);

  const normalizedQuiz: Quiz = {
    ...quiz,
    questions: (quiz?.questions || []).map((q) => ({
      ...q,
      timeLimit: q.timeLimit && q.timeLimit > 0 ? q.timeLimit : chosenTime,
    })),
  };

  return {
    id: `room-${roomCode}-${Date.now()}`,
    roomCode: roomCode.toUpperCase(),
    hostId,
    creatorId,
    creatorName,
    quiz: normalizedQuiz,
    status: 'LOBBY',
    currentQuestionIndex: 0,
    questionStartedAt: null,
    scheduledStartAt: scheduledStartAt || null,
    isPublic: true,
    maxCandidates: maxCandidates || null,
    settings: {
      timePerQuestion: chosenTime,
      speedBonus: true,
      streakBonus: true,
      showExplanations: true,
      aiCommentaryEnabled: true,
      maxCandidates: maxCandidates || null,
    },
    players: {},
  };
}

// Global Discovery: Get all active / pending scheduled rooms
export function getAllPendingRooms(): GameRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const indexStr = localStorage.getItem(ROOM_INDEX_KEY);
    const codes: string[] = indexStr ? JSON.parse(indexStr) : [];
    const rooms: GameRoom[] = [];

    codes.forEach((code) => {
      const r = getRoomManager(code).getSavedRoom();
      if (r && r.status === 'LOBBY' && (r.isPublic !== false)) {
        rooms.push(r);
      }
    });

    // Sort by scheduledStartAt ascending (earliest first)
    return rooms.sort((a, b) => {
      if (!a.scheduledStartAt) return 1;
      if (!b.scheduledStartAt) return -1;
      return a.scheduledStartAt - b.scheduledStartAt;
    });
  } catch (e) {
    return [];
  }
}

// Creator History: Get all rooms created by a specific creator
export function getRoomsByCreator(creatorId: string): GameRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const indexStr = localStorage.getItem(ROOM_INDEX_KEY);
    const codes: string[] = indexStr ? JSON.parse(indexStr) : [];
    const rooms: GameRoom[] = [];

    codes.forEach((code) => {
      const r = getRoomManager(code).getSavedRoom();
      if (r && (r.creatorId === creatorId || r.hostId === creatorId)) {
        rooms.push(r);
      }
    });

    return rooms.reverse();
  } catch (e) {
    return [];
  }
}

export type RoomLookupResult = 
  | { status: 'NOT_FOUND'; message: string }
  | { status: 'ROOM_FULL'; maxCandidates: number; room: GameRoom }
  | { status: 'LOBBY'; room: GameRoom }
  | { status: 'IN_PROGRESS'; currentQuestion: number; totalQuestions: number; room: GameRoom }
  | { status: 'GAME_OVER'; room: GameRoom };

/**
 * Cross-Device Asynchronous Room State Tracker.
 * Checks local cache first, then Supabase cloud database if user is on a separate device.
 */
export async function lookupRoomStateAsync(roomCode: string): Promise<RoomLookupResult> {
  const code = (roomCode || '').trim().toUpperCase();
  if (!code || code.length < 4) {
    return {
      status: 'NOT_FOUND',
      message: 'Please enter a valid 6-character PIN code.',
    };
  }

  const manager = getRoomManager(code);
  let room = manager.getSavedRoom();

  if (!room) {
    room = await manager.fetchRoomAsync();
  }

  if (!room) {
    return {
      status: 'NOT_FOUND',
      message: `No active quiz found with PIN #${code}. Please check the screen or ask your host.`,
    };
  }

  if (room.status === 'GAME_OVER') {
    return {
      status: 'GAME_OVER',
      room,
    };
  }

  const currentCount = Object.keys(room.players || {}).length;
  if (room.maxCandidates && currentCount >= room.maxCandidates && room.status === 'LOBBY') {
    return {
      status: 'ROOM_FULL',
      maxCandidates: room.maxCandidates,
      room,
    };
  }

  if (room.status === 'QUESTION' || room.status === 'ANSWER_REVEAL' || room.status === 'LEADERBOARD') {
    return {
      status: 'IN_PROGRESS',
      currentQuestion: (room.currentQuestionIndex ?? 0) + 1,
      totalQuestions: room.quiz?.questions?.length || 1,
      room,
    };
  }

  return {
    status: 'LOBBY',
    room,
  };
}

// Synchronous wrapper
export function lookupRoomState(roomCode: string): RoomLookupResult {
  const code = (roomCode || '').trim().toUpperCase();
  if (!code || code.length < 4) {
    return {
      status: 'NOT_FOUND',
      message: 'Please enter a valid 6-character PIN code.',
    };
  }

  const room = getRoomManager(code).getSavedRoom();
  if (!room) {
    return {
      status: 'NOT_FOUND',
      message: `No active quiz found with PIN #${code}. Please check the screen or ask your host.`,
    };
  }

  if (room.status === 'GAME_OVER') {
    return { status: 'GAME_OVER', room };
  }

  const currentCount = Object.keys(room.players || {}).length;
  if (room.maxCandidates && currentCount >= room.maxCandidates && room.status === 'LOBBY') {
    return { status: 'ROOM_FULL', maxCandidates: room.maxCandidates, room };
  }

  if (room.status === 'QUESTION' || room.status === 'ANSWER_REVEAL' || room.status === 'LEADERBOARD') {
    return {
      status: 'IN_PROGRESS',
      currentQuestion: (room.currentQuestionIndex ?? 0) + 1,
      totalQuestions: room.quiz?.questions?.length || 1,
      room,
    };
  }

  return { status: 'LOBBY', room };
}
