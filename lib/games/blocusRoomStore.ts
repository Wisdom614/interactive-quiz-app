import { BlocusGameState, BlocusColor, createInitialBlocusState } from './blocusEngine';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type BlocusRoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'GAME_OVER';

export interface BlocusRoom {
  id: string;
  roomCode: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  guestId: string | null;
  guestName: string | null;
  guestAvatar: string | null;
  status: BlocusRoomStatus;
  countdownStartedAt: number | null;
  scheduledStartAt: number | null;
  turnTimerSec: number;
  winTarget: number;
  gridPreset: 'a4' | 'pocket' | 'standard' | 'grand';
  gameState: BlocusGameState;
  currentTurn: BlocusColor;
  winner: BlocusColor | 'draw' | null;
  winReason: string | null;
  moveHistory: string[];
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type BlocusBroadcastEvent =
  | { type: 'BLOCUS_SYNC'; room: BlocusRoom }
  | {
      type: 'BLOCUS_MOVE';
      x: number;
      y: number;
      color: BlocusColor;
      gameState: BlocusGameState;
      newlyCaptured: number;
      isRecapture: boolean;
    }
  | { type: 'BLOCUS_GUEST_JOINED'; guestId: string; guestName: string; scheduledStartAt: number }
  | { type: 'BLOCUS_START_MATCH'; room: BlocusRoom }
  | { type: 'BLOCUS_REMATCH'; gameState: BlocusGameState }
  | { type: 'BLOCUS_EMOJI'; emoji: string; sender: string }
  | {
      type: 'BLOCUS_FORFEIT';
      leaverId: string;
      leaverName: string;
      winnerColor: BlocusColor;
      reason: string;
    };

const BLOCUS_STORAGE_PREFIX = 'quizpulse_blocus_room_';

export class BlocusRoomManager {
  private roomCode: string;
  private channelName: string;
  private localBroadcast: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
  private listeners: Set<(event: BlocusBroadcastEvent) => void> = new Set();
  private isSupabaseSubscribed = false;
  private pendingBroadcastQueue: BlocusBroadcastEvent[] = [];
  private myPlayerId: string | null = null;
  private myPlayerName: string | null = null;
  private myRole: 'host' | 'guest' | null = null;

  constructor(roomCode: string) {
    this.roomCode = roomCode.toUpperCase();
    this.channelName = `blocus_live_${this.roomCode}`;

    if (typeof window !== 'undefined') {
      try {
        this.localBroadcast = new BroadcastChannel(`quizpulse_${this.channelName}`);
        this.localBroadcast.onmessage = (event) => {
          this.notifyListeners(event.data as BlocusBroadcastEvent);
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
          .on('broadcast', { event: 'blocus_event' }, ({ payload }) => {
            this.notifyListeners(payload as BlocusBroadcastEvent);
          })
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'blocus_rooms', filter: `room_code=eq.${this.roomCode}` },
            (payload) => {
              const newRow = payload.new as any;
              if (newRow && newRow.room_code === this.roomCode) {
                const room = this.parseRoomRow(newRow);
                this.saveRoomLocally(room);
                this.notifyListeners({
                  type: 'BLOCUS_SYNC',
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
                    event: 'blocus_event',
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

  public subscribe(callback: (event: BlocusBroadcastEvent) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: BlocusBroadcastEvent) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Blocus event listener error', err);
      }
    });
  }

  public broadcast(event: BlocusBroadcastEvent) {
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
          event: 'blocus_event',
          payload: event,
        });
      } else {
        this.pendingBroadcastQueue.push(event);
      }
    }
  }

  private parseRoomRow(data: any): BlocusRoom {
    const gridPreset = data.grid_preset || 'standard';
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
      winTarget: data.win_target ?? 15,
      gridPreset,
      gameState: data.game_state || createInitialBlocusState({ preset: gridPreset }),
      currentTurn: data.current_turn || 'blue',
      winner: data.winner || null,
      winReason: data.win_reason || null,
      moveHistory: data.move_history || [],
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public saveRoomLocally(room: BlocusRoom) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${BLOCUS_STORAGE_PREFIX}${this.roomCode}`, JSON.stringify(room));
    } catch (e) {
      console.warn('Failed to save blocus room locally', e);
    }
  }

  public getSavedRoom(): BlocusRoom | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`${BLOCUS_STORAGE_PREFIX}${this.roomCode}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  public async saveRoom(room: BlocusRoom): Promise<void> {
    const local = this.getSavedRoom();
    const guestId = room.guestId || local?.guestId || null;
    const guestName = room.guestName || local?.guestName || null;
    const guestAvatar = room.guestAvatar || local?.guestAvatar || 'zap';

    const mergedRoom: BlocusRoom = {
      ...room,
      guestId,
      guestName,
      guestAvatar,
    };

    this.saveRoomLocally(mergedRoom);

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured) return;

    try {
      await supabase.from('blocus_rooms').upsert({
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
        win_target: mergedRoom.winTarget,
        grid_preset: mergedRoom.gridPreset,
        game_state: mergedRoom.gameState,
        current_turn: mergedRoom.currentTurn,
        winner: mergedRoom.winner,
        win_reason: mergedRoom.winReason,
        move_history: mergedRoom.moveHistory,
        settings: mergedRoom.settings || {},
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to upsert blocus room to DB:', err);
    }
  }

  public async fetchRoomAsync(): Promise<BlocusRoom | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('blocus_rooms')
          .select('*')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (data && !error) {
          const room = this.parseRoomRow(data);
          this.saveRoomLocally(room);
          return room;
        }
      } catch (err) {
        console.warn('Blocus room fetch error:', err);
      }
    }

    return this.getSavedRoom();
  }

  /**
   * Attempts to join this room as a guest.
   * Strictly 1v1 capacity checking, countdown initiation, and syncing.
   */
  public async joinAsGuest(
    playerId: string,
    playerName: string,
    playerAvatar: string = 'zap'
  ): Promise<{ success: boolean; role: 'host' | 'guest'; error?: string; room?: BlocusRoom }> {
    let current = await this.fetchRoomAsync();
    if (!current) {
      return { success: false, role: 'guest', error: 'ROOM_NOT_FOUND' };
    }

    // Host already in room
    if (current.hostId === playerId) {
      return { success: true, role: 'host', room: current };
    }

    // Guest already in room
    if (current.guestId === playerId) {
      return { success: true, role: 'guest', room: current };
    }

    // 1v1 capacity check
    if (current.guestId && current.guestId !== playerId) {
      return { success: false, role: 'guest', error: 'ROOM_FULL', room: current };
    }

    // 2nd person joins: Start 30-second countdown immediately
    const now = Date.now();
    const scheduledStartAt = now + 30000;

    const updatedRoom: BlocusRoom = {
      ...current,
      guestId: playerId,
      guestName: playerName,
      guestAvatar: playerAvatar,
      status: current.status === 'LOBBY' ? 'STARTING' : current.status,
      countdownStartedAt: now,
      scheduledStartAt,
    };

    await this.saveRoom(updatedRoom);

    this.broadcast({
      type: 'BLOCUS_GUEST_JOINED',
      guestId: playerId,
      guestName: playerName,
      scheduledStartAt,
    });
    this.broadcast({
      type: 'BLOCUS_SYNC',
      room: updatedRoom,
    });

    return { success: true, role: 'guest', room: updatedRoom };
  }

  /**
   * Host starts match immediately
   */
  public async startMatchNow(): Promise<BlocusRoom | null> {
    const current = await this.fetchRoomAsync();
    if (!current) return null;

    const updatedRoom: BlocusRoom = {
      ...current,
      status: 'PLAYING',
      scheduledStartAt: null,
      winner: null,
      winReason: null,
    };

    await this.saveRoom(updatedRoom);

    this.broadcast({
      type: 'BLOCUS_START_MATCH',
      room: updatedRoom,
    });
    this.broadcast({
      type: 'BLOCUS_SYNC',
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
    winnerColor: BlocusColor,
    reason: string = 'Opponent surrendered paper'
  ): Promise<BlocusRoom | null> {
    const current = await this.fetchRoomAsync();
    if (!current) return null;

    const updatedRoom: BlocusRoom = {
      ...current,
      status: 'GAME_OVER',
      winner: winnerColor,
      winReason: reason,
      settings: {
        ...(current.settings || {}),
        winReason: 'forfeit',
        forfeitLeaverId: leaverId,
        forfeitLeaverName: leaverName,
        forfeitReason: reason,
      },
    };

    await this.saveRoom(updatedRoom);

    const event: BlocusBroadcastEvent = {
      type: 'BLOCUS_FORFEIT',
      leaverId,
      leaverName,
      winnerColor,
      reason,
    };

    this.broadcast(event);
    this.broadcast({
      type: 'BLOCUS_SYNC',
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

    // A client may leave the arena and return without reloading the page.
    // Remove this closed manager from the cache so the next visit creates a
    // fresh BroadcastChannel and Supabase Realtime subscription.
    blocusManagers.delete(this.roomCode);
  }
}

const blocusManagers: Map<string, BlocusRoomManager> = new Map();

export function getBlocusRoomManager(roomCode: string): BlocusRoomManager {
  const code = roomCode.toUpperCase();
  if (!blocusManagers.has(code)) {
    blocusManagers.set(code, new BlocusRoomManager(code));
  }
  return blocusManagers.get(code)!;
}

export function generateBlocusRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DOT-${code}`;
}

export async function createBlocusRoom(options: {
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  turnTimerSec?: number;
  winTarget?: number;
  gridPreset?: 'a4' | 'pocket' | 'standard' | 'grand';
}): Promise<BlocusRoom> {
  const roomCode = generateBlocusRoomCode();
  const manager = getBlocusRoomManager(roomCode);

  const preset = options.gridPreset || 'a4';
  const target = options.winTarget || (preset === 'pocket' ? 8 : preset === 'standard' ? 15 : preset === 'a4' ? 20 : 25);

  const initialGameState = createInitialBlocusState({
    preset,
    winTarget: target,
    playerCount: 2,
  });

  const room: BlocusRoom = {
    id: `dot-room-${roomCode}-${Date.now()}`,
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
    winTarget: target,
    gridPreset: preset,
    gameState: initialGameState,
    currentTurn: 'blue',
    winner: null,
    winReason: null,
    moveHistory: [],
    settings: {
      turnTimerSec: options.turnTimerSec ?? 30,
      winTarget: target,
      gridPreset: preset,
    },
    createdAt: new Date().toISOString(),
  };

  await manager.saveRoom(room);
  return room;
}
