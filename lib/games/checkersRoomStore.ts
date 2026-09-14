import { BoardState, PlayerColor, createInitialCheckersBoard } from './checkersEngine';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type CheckersRoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'GAME_OVER';

export interface CheckersMovePayload {
  from: { row: number; col: number };
  to: { row: number; col: number };
  captures?: { row: number; col: number }[];
}

export interface CheckersRoom {
  id: string;
  roomCode: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  guestId: string | null;
  guestName: string | null;
  guestAvatar: string | null;
  status: CheckersRoomStatus;
  countdownStartedAt: number | null;
  scheduledStartAt: number | null;
  turnTimerSec: number;
  isTriviaClash: boolean;
  boardState: BoardState;
  currentTurn: PlayerColor;
  winner: PlayerColor | 'draw' | null;
  moveHistory: string[];
  lastMove?: CheckersMovePayload | null;
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type CheckersBroadcastEvent =
  | { type: 'CHECKERS_SYNC'; room: CheckersRoom }
  | { 
      type: 'CHECKERS_MOVE'; 
      board: BoardState; 
      nextTurn: PlayerColor; 
      lastMove?: CheckersMovePayload | null;
      mustJumpChainPos?: { row: number; col: number } | null;
      winner?: PlayerColor | 'draw' | null;
      redCaptured: number;
      blackCaptured: number;
      notation?: string;
      isCapture?: boolean;
      isKingPromotion?: boolean;
    }
  | { type: 'CHECKERS_GUEST_JOINED'; guestId: string; guestName: string; scheduledStartAt: number }
  | { type: 'CHECKERS_START_MATCH'; room: CheckersRoom }
  | { type: 'CHECKERS_REMATCH'; board: BoardState }
  | { type: 'CHECKERS_EMOJI'; emoji: string; sender: string }
  | {
      type: 'CHECKERS_FORFEIT';
      leaverId: string;
      leaverName: string;
      winnerColor: PlayerColor;
      reason: string;
    };

const CHECKERS_STORAGE_PREFIX = 'quizpulse_checkers_room_';


export class CheckersRoomManager {
  private roomCode: string;
  private channelName: string;
  private localBroadcast: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
  private listeners: Set<(event: CheckersBroadcastEvent) => void> = new Set();
  private isSupabaseSubscribed = false;
  private pendingBroadcastQueue: CheckersBroadcastEvent[] = [];
  private myPlayerId: string | null = null;
  private myPlayerName: string | null = null;
  private myRole: 'host' | 'guest' | null = null;

  constructor(roomCode: string) {
    this.roomCode = roomCode.toUpperCase();
    this.channelName = `checkers_live_${this.roomCode}`;

    if (typeof window !== 'undefined') {
      try {
        this.localBroadcast = new BroadcastChannel(`quizpulse_${this.channelName}`);
        this.localBroadcast.onmessage = (event) => {
          this.notifyListeners(event.data as CheckersBroadcastEvent);
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }

      const supabase = getSupabaseClient();
      if (supabase && isSupabaseConfigured) {
        this.supabaseChannel = supabase.channel(this.channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: this.roomCode },
          },
        });

        this.supabaseChannel
          .on('broadcast', { event: 'checkers_event' }, ({ payload }) => {
            this.notifyListeners(payload as CheckersBroadcastEvent);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            if (leftPresences && Array.isArray(leftPresences)) {
              leftPresences.forEach((pres: any) => {
                if (pres && pres.playerId && pres.playerId !== this.myPlayerId) {
                  const winnerColor: PlayerColor = pres.role === 'host' ? 'black' : 'red';
                  this.notifyListeners({
                    type: 'CHECKERS_FORFEIT',
                    leaverId: pres.playerId,
                    leaverName: pres.name || 'Opponent',
                    winnerColor,
                    reason: 'Opponent disconnected from the match',
                  });
                }
              });
            }
          })
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'checkers_rooms', filter: `room_code=eq.${this.roomCode}` },
            (payload) => {
              const newRow = payload.new as any;
              if (newRow && newRow.room_code === this.roomCode) {
                const room = this.parseRoomRow(newRow);
                this.saveRoomLocally(room);
                this.notifyListeners({
                  type: 'CHECKERS_SYNC',
                  room,
                });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.isSupabaseSubscribed = true;

              if (this.myPlayerId && this.supabaseChannel) {
                this.supabaseChannel.track({
                  playerId: this.myPlayerId,
                  name: this.myPlayerName || 'Player',
                  role: this.myRole || 'guest',
                  joinedAt: Date.now(),
                });
              }

              while (this.pendingBroadcastQueue.length > 0) {
                const queued = this.pendingBroadcastQueue.shift();
                if (queued && this.supabaseChannel) {
                  this.supabaseChannel.send({
                    type: 'broadcast',
                    event: 'checkers_event',
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

  public trackPresence(playerId: string, name: string, role: 'host' | 'guest') {
    this.myPlayerId = playerId;
    this.myPlayerName = name;
    this.myRole = role;

    if (this.supabaseChannel && this.isSupabaseSubscribed) {
      try {
        this.supabaseChannel.track({
          playerId,
          name,
          role,
          joinedAt: Date.now(),
        });
      } catch (e) {
        console.warn('Presence track error', e);
      }
    }
  }

  public subscribe(callback: (event: CheckersBroadcastEvent) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: CheckersBroadcastEvent) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Checkers event listener error', err);
      }
    });
  }

  public broadcast(event: CheckersBroadcastEvent) {
    this.notifyListeners(event);

    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage(event);
      } catch (e) {
        // ignore
      }
    }

    if (this.supabaseChannel) {
      if (this.isSupabaseSubscribed) {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'checkers_event',
          payload: event,
        });
      } else {
        this.pendingBroadcastQueue.push(event);
      }
    }
  }

  private parseRoomRow(data: any): CheckersRoom {
    return {
      id: data.id,
      roomCode: data.room_code,
      hostId: data.host_id,
      hostName: data.host_name || 'Host',
      hostAvatar: data.host_avatar || 'crown',
      guestId: data.guest_id || null,
      guestName: data.guest_name || null,
      guestAvatar: data.guest_avatar || null,
      status: data.status || 'LOBBY',
      countdownStartedAt: data.countdown_started_at ? Number(data.countdown_started_at) : null,
      scheduledStartAt: data.scheduled_start_at ? Number(data.scheduled_start_at) : null,
      turnTimerSec: data.turn_timer_sec ?? 30,
      isTriviaClash: data.is_trivia_clash === true,
      boardState: data.board_state || createInitialCheckersBoard(),
      currentTurn: data.current_turn || 'red',
      winner: data.winner || null,
      moveHistory: data.move_history || [],
      lastMove: data.settings?.lastMove || null,
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public saveRoomLocally(room: CheckersRoom) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${CHECKERS_STORAGE_PREFIX}${this.roomCode}`, JSON.stringify(room));
    } catch (e) {
      console.warn('Failed to save checkers room locally', e);
    }
  }

  public getSavedRoom(): CheckersRoom | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`${CHECKERS_STORAGE_PREFIX}${this.roomCode}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  public async saveRoom(room: CheckersRoom): Promise<void> {
    const local = this.getSavedRoom();
    const guestId = room.guestId || local?.guestId || null;
    const guestName = room.guestName || local?.guestName || null;
    const guestAvatar = room.guestAvatar || local?.guestAvatar || 'zap';

    const mergedRoom: CheckersRoom = {
      ...room,
      guestId,
      guestName,
      guestAvatar,
    };

    this.saveRoomLocally(mergedRoom);

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return;

    try {
      await supabase.from('checkers_rooms').upsert({
        id: mergedRoom.id,
        room_code: mergedRoom.roomCode,
        host_id: mergedRoom.hostId,
        host_name: mergedRoom.hostName,
        host_avatar: mergedRoom.hostAvatar,
        guest_id: guestId,
        guest_name: guestName,
        guest_avatar: guestAvatar,
        status: mergedRoom.status,
        countdown_started_at: mergedRoom.countdownStartedAt,
        scheduled_start_at: mergedRoom.scheduledStartAt,
        turn_timer_sec: mergedRoom.turnTimerSec,
        is_trivia_clash: mergedRoom.isTriviaClash,
        board_state: mergedRoom.boardState,
        current_turn: mergedRoom.currentTurn,
        winner: mergedRoom.winner,
        move_history: mergedRoom.moveHistory,
        settings: {
          ...(mergedRoom.settings || {}),
          lastMove: mergedRoom.lastMove || null,
        },
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to upsert checkers room to DB:', err);
    }
  }

  public async fetchRoomAsync(): Promise<CheckersRoom | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('checkers_rooms')
          .select('*')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (data && !error) {
          const room = this.parseRoomRow(data);
          this.saveRoomLocally(room);
          return room;
        }
      } catch (err) {
        console.warn('Checkers room fetch error:', err);
      }
    }

    return this.getSavedRoom();
  }

  /**
   * Attempts to join this room as a guest.
   * Handles 1v1 capacity checking, countdown initiation, and syncing.
   */
  public async joinAsGuest(
    playerId: string,
    playerName: string,
    playerAvatar: string = 'zap'
  ): Promise<{ success: boolean; role: 'host' | 'guest'; error?: string; room?: CheckersRoom }> {
    let current = await this.fetchRoomAsync();
    if (!current) {
      return { success: false, role: 'guest', error: 'ROOM_NOT_FOUND' };
    }

    // If this player is already the host
    if (current.hostId === playerId) {
      return { success: true, role: 'host', room: current };
    }

    // If this player is already the guest
    if (current.guestId === playerId) {
      return { success: true, role: 'guest', room: current };
    }

    // Check if another guest is already in the room (strictly 1v1)
    if (current.guestId && current.guestId !== playerId) {
      return { success: false, role: 'guest', error: 'ROOM_FULL', room: current };
    }

    // 2nd person joins! Start 30-second countdown immediately
    const now = Date.now();
    const scheduledStartAt = now + 30000; // 30 seconds countdown

    const updatedRoom: CheckersRoom = {
      ...current,
      guestId: playerId,
      guestName: playerName,
      guestAvatar: playerAvatar,
      status: current.status === 'LOBBY' ? 'STARTING' : current.status,
      countdownStartedAt: now,
      scheduledStartAt,
    };

    await this.saveRoom(updatedRoom);

    // Broadcast to host and all channels
    this.broadcast({
      type: 'CHECKERS_GUEST_JOINED',
      guestId: playerId,
      guestName: playerName,
      scheduledStartAt,
    });
    this.broadcast({
      type: 'CHECKERS_SYNC',
      room: updatedRoom,
    });

    return { success: true, role: 'guest', room: updatedRoom };
  }

  /**
   * Host starts match immediately, skipping remaining countdown
   */
  public async startMatchNow(): Promise<CheckersRoom | null> {
    const current = await this.fetchRoomAsync();
    if (!current) return null;

    const updatedRoom: CheckersRoom = {
      ...current,
      status: 'PLAYING',
      scheduledStartAt: null,
    };

    await this.saveRoom(updatedRoom);

    this.broadcast({
      type: 'CHECKERS_START_MATCH',
      room: updatedRoom,
    });
    this.broadcast({
      type: 'CHECKERS_SYNC',
      room: updatedRoom,
    });

    return updatedRoom;
  }

  /**
   * Forfeits match, declaring other player the winner
   */
  public async forfeitMatch(
    leaverId: string,
    leaverName: string,
    winnerColor: PlayerColor,
    reason: string = 'Opponent forfeited'
  ): Promise<CheckersRoom | null> {
    const current = await this.fetchRoomAsync();
    if (!current) return null;

    const updatedRoom: CheckersRoom = {
      ...current,
      status: 'GAME_OVER',
      winner: winnerColor,
      settings: {
        ...(current.settings || {}),
        winReason: 'forfeit',
        forfeitLeaverId: leaverId,
        forfeitLeaverName: leaverName,
        forfeitReason: reason,
      },
    };

    await this.saveRoom(updatedRoom);

    const event: CheckersBroadcastEvent = {
      type: 'CHECKERS_FORFEIT',
      leaverId,
      leaverName,
      winnerColor,
      reason,
    };

    this.broadcast(event);
    this.broadcast({
      type: 'CHECKERS_SYNC',
      room: updatedRoom,
    });

    return updatedRoom;
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

const checkersManagers: Map<string, CheckersRoomManager> = new Map();

export function getCheckersRoomManager(roomCode: string): CheckersRoomManager {
  const code = roomCode.toUpperCase();
  if (!checkersManagers.has(code)) {
    checkersManagers.set(code, new CheckersRoomManager(code));
  }
  return checkersManagers.get(code)!;
}

export function generateCheckersRoomCode(): string {
  // Generate a clean 6-character room code like CHK-7B4K
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CHK-${code}`;
}

export async function createCheckersRoom(options: {
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  turnTimerSec?: number;
  isTriviaClash?: boolean;
}): Promise<CheckersRoom> {
  const roomCode = generateCheckersRoomCode();
  const manager = getCheckersRoomManager(roomCode);

  const room: CheckersRoom = {
    id: `chk-room-${roomCode}-${Date.now()}`,
    roomCode,
    hostId: options.hostId,
    hostName: options.hostName || 'Host',
    hostAvatar: options.hostAvatar || 'crown',
    guestId: null,
    guestName: null,
    guestAvatar: null,
    status: 'LOBBY',
    countdownStartedAt: null,
    scheduledStartAt: null,
    turnTimerSec: options.turnTimerSec ?? 30,
    isTriviaClash: !!options.isTriviaClash,
    boardState: createInitialCheckersBoard(),
    currentTurn: 'red',
    winner: null,
    moveHistory: [],
    settings: {
      turnTimerSec: options.turnTimerSec ?? 30,
      isTriviaClash: !!options.isTriviaClash,
    },
    createdAt: new Date().toISOString(),
  };

  await manager.saveRoom(room);
  return room;
}
