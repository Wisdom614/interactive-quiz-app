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
          .subscribe();
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
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event,
      });
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

      // Asynchronously synchronize with Supabase DB if configured
      const supabase = getSupabaseClient();
      if (supabase && isSupabaseConfigured) {
        Promise.resolve(
          supabase
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
              players: room.players,
              last_revealed_answer: room.lastRevealedAnswer,
              updated_at: new Date().toISOString(),
            })
        )
          .then((result) => {
            if (result && 'error' in result && result.error) {
              console.warn('Supabase DB sync warning:', result.error);
            }
          })
          .catch((err: unknown) => {
            console.warn('Supabase DB sync catch:', err);
          });
      }
    } catch (e) {
      console.warn('Failed to save room', e);
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
  maxCandidates?: number | null
): GameRoom {
  return {
    id: `room-${roomCode}-${Date.now()}`,
    roomCode: roomCode.toUpperCase(),
    hostId,
    creatorId,
    creatorName,
    quiz,
    status: 'LOBBY',
    currentQuestionIndex: 0,
    questionStartedAt: null,
    scheduledStartAt: scheduledStartAt || null,
    isPublic: true,
    maxCandidates: maxCandidates || null,
    settings: {
      timePerQuestion: 15,
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

// Accurate PIN State Tracker
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
