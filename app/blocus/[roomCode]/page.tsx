'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Swords, 
  Bot, 
  Users, 
  Trophy, 
  Clock, 
  Sparkles, 
  Share2, 
  AlertCircle, 
  QrCode, 
  X, 
  Play, 
  Hourglass, 
  Flag, 
  Maximize, 
  Minimize, 
  ZoomIn, 
  ZoomOut, 
  Crosshair, 
  Layers, 
  HelpCircle,
  Move,
  Hand,
  PenTool,
  LocateFixed,
  Scan
} from 'lucide-react';
import { 
  BlocusGameState, 
  BlocusColor, 
  BlocusPosition, 
  createInitialBlocusState, 
  placeBlocusDot, 
  passTurn, 
  evaluateEndgameTally, 
  getBlocusAIMove, 
  posToKey, 
  keyToPos, 
  BLOCUS_GRID_PRESETS 
} from '@/lib/games/blocusEngine';
import { sound } from '@/lib/audio/soundEngine';
import { 
  BlocusRoom, 
  getBlocusRoomManager, 
  BlocusBroadcastEvent 
} from '@/lib/games/blocusRoomStore';
import { AuthService } from '@/lib/auth/authStore';

type TraceSegment = {
  from: BlocusPosition;
  to: BlocusPosition;
  color: BlocusColor;
};

function getTraceSegments(gameState: BlocusGameState): TraceSegment[] {
  const segments: TraceSegment[] = [];
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
  ];

  for (const dot of Object.values(gameState.dots)) {
    for (const { dx, dy } of directions) {
      const to = { x: dot.x + dx, y: dot.y + dy };
      const neighbor = gameState.dots[posToKey(to.x, to.y)];

      // A trace joins every adjacent dot owned by the same player. Opponent
      // dots in the other two corners do not block this connection.
      if (!neighbor || neighbor.currentOwner !== dot.currentOwner) continue;

      segments.push({ from: { x: dot.x, y: dot.y }, to, color: dot.currentOwner });
    }
  }

  return segments;
}

export default function BlocusArenaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = ((params.roomCode as string) || 'arena').toUpperCase();
  const isSolo = searchParams.get('mode') === 'solo' || roomCode === 'ARENA';
  const isPassPlay = searchParams.get('mode') === 'pass_play';
  const isMultiplayer = !isSolo && !isPassPlay;
  const roleFromUrl = searchParams.get('role') as 'host' | 'guest' | null;

  // Solo & Pass-and-Play URL parameters
  const aiDifficulty = (searchParams.get('diff') as 'EASY' | 'MEDIUM') || 'MEDIUM';
  const soloAssignedColor = (searchParams.get('color') as BlocusColor) || 'blue';
  const urlPreset = (searchParams.get('preset') as 'a4' | 'pocket' | 'standard' | 'grand') || 'a4';
  const urlTarget = parseInt(searchParams.get('target') || (urlPreset === 'a4' ? '20' : '15'), 10);
  const urlTimer = parseInt(searchParams.get('timer') || '30', 10);
  const urlPlayerCount = parseInt(searchParams.get('players') || '2', 10) as 2 | 3;

  // Player identity
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [myPlayerName, setMyPlayerName] = useState<string>('');

  // Multiplayer room state
  const [room, setRoom] = useState<BlocusRoom | null>(null);
  const [myRole, setMyRole] = useState<'host' | 'guest'>(roleFromUrl || 'host');
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isRoomNotFound, setIsRoomNotFound] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);

  // Core Game State
  const [gameState, setGameState] = useState<BlocusGameState>(() =>
    createInitialBlocusState({
      preset: urlPreset,
      winTarget: urlTarget,
      playerCount: urlPlayerCount,
    })
  );

  // Viewport Pan & Zoom State
  const [zoom, setZoom] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tool & Touch Navigation Mode: 'draw' | 'pan'
  const [interactionMode, setInteractionMode] = useState<'draw' | 'pan'>('draw');

  // Mobile Tap / Precision Selected Target
  const [selectedPos, setSelectedPos] = useState<BlocusPosition | null>(null);

  // Placed Dot Ink Ripples
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: BlocusColor }[]>([]);

  // DOM Container & SVG Refs
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Multi-Touch Gesture Tracker
  const touchGestureRef = useRef<{
    isTwoFinger: boolean;
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    startPointer: { x: number; y: number };
    dragDistance: number;
  }>({
    isTwoFinger: false,
    initialDist: 0,
    initialZoom: 1.2,
    initialPan: { x: 0, y: 0 },
    startPointer: { x: 0, y: 0 },
    dragDistance: 0,
  });

  // Hover & Snapped Target Reticle
  const [hoveredPos, setHoveredPos] = useState<BlocusPosition | null>(null);
  const [lastNotification, setLastNotification] = useState<{ text: string; type: 'capture' | 'recapture' | 'info' } | null>(null);

  // Turn Timer
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(urlTimer);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // UI Modals & Sharing
  const [showShareModal, setShowShareModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  // Sound Mute
  const [isMuted, setIsMuted] = useState(false);
  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Fullscreen support for mobile
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFullscreen = Boolean(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
      );
      setIsFullscreen(isDocFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    sound.playSelect();
    try {
      if (!isFullscreen) {
        const elem = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
          mozRequestFullScreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
          mozCancelFullScreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed:', e);
    }
  };

  // Determine client's assigned color in multiplayer / solo
  const myAssignedColor: BlocusColor = useMemo(() => {
    if (isSolo) return soloAssignedColor;
    if (isPassPlay) return gameState.currentTurn;
    return myRole === 'host' ? 'blue' : 'red';
  }, [isSolo, isPassPlay, soloAssignedColor, myRole, gameState.currentTurn]);

  const isMyTurn = isPassPlay || (gameState.currentTurn === myAssignedColor && !gameState.winner && (!isMultiplayer || room?.status === 'PLAYING'));

  // Initialize client ID & nickname
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let pid = localStorage.getItem('blocus_player_id');
    if (!pid) {
      pid = `dot_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('blocus_player_id', pid);
    }
    setMyPlayerId(pid);

    let pname = localStorage.getItem('blocus_player_name');
    if (!pname) {
      const user = AuthService.getCurrentUser();
      pname = user?.name || `Cadet ${pid.substring(4, 8)}`;
      localStorage.setItem('blocus_player_name', pname);
    }
    setMyPlayerName(pname);
  }, []);

  // Show the short rules guide once, while leaving the help button available
  // whenever a player wants a reminder.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('blocus_tutorial_seen_v1')) {
      setShowRulesModal(true);
    }
  }, []);

  // Manager reference for multiplayer
  const managerRef = useRef<ReturnType<typeof getBlocusRoomManager> | null>(null);

  // Initialize room & subscriptions for multiplayer
  useEffect(() => {
    if (!isMultiplayer || !myPlayerId) return;

    const mgr = getBlocusRoomManager(roomCode);
    managerRef.current = mgr;

    let isMounted = true;

    async function initMultiplayer() {
      const current = await mgr.fetchRoomAsync();
      if (!isMounted) return;

      if (!current) {
        setIsRoomNotFound(true);
        return;
      }

      if (current.hostId === myPlayerId) {
        setMyRole('host');
        setRoom(current);
        setGameState(current.gameState);
        mgr.trackPresence(myPlayerId, myPlayerName || 'Host', 'host');
      } else {
        const joinRes = await mgr.joinAsGuest(myPlayerId, myPlayerName || 'Guest', 'zap');
        if (!isMounted) return;

        if (!joinRes.success) {
          if (joinRes.error === 'ROOM_FULL') {
            setIsRoomFull(true);
          } else {
            setIsRoomNotFound(true);
          }
          return;
        }

        setMyRole(joinRes.role);
        if (joinRes.room) {
          setRoom(joinRes.room);
          setGameState(joinRes.room.gameState);
        }
        mgr.trackPresence(myPlayerId, myPlayerName || 'Guest', 'guest');
      }
    }

    initMultiplayer();

    const unsubscribe = mgr.subscribe((event: BlocusBroadcastEvent) => {
      if (!isMounted) return;

      if (event.type === 'BLOCUS_SYNC') {
        setRoom(event.room);
        setGameState(event.room.gameState);
      } else if (event.type === 'BLOCUS_MOVE') {
        setGameState(event.gameState);
        triggerPlacementRipple(event.x, event.y, event.color);
        sound.playPenDot();

        if (event.isRecapture) {
          sound.playRecaptureFanfare();
          showNotification(`Fortress Recaptured! (+${event.newlyCaptured} dots)`, 'recapture');
        } else if (event.newlyCaptured > 0) {
          sound.playEnclosureComplete();
          showNotification(`Enclosure Formed! (+${event.newlyCaptured} dots)`, 'capture');
        }
      } else if (event.type === 'BLOCUS_GUEST_JOINED') {
        mgr.fetchRoomAsync().then((rm) => {
          if (rm && isMounted) setRoom(rm);
        });
      } else if (event.type === 'BLOCUS_START_MATCH') {
        setRoom(event.room);
        setGameState(event.room.gameState);
        sound.playStart();
      } else if (event.type === 'BLOCUS_REMATCH') {
        setGameState(event.gameState);
        sound.playStart();
      } else if (event.type === 'BLOCUS_EMOJI') {
        triggerEmoji(event.emoji);
      } else if (event.type === 'BLOCUS_FORFEIT') {
        setGameState((prev) => ({
          ...prev,
          winner: event.winnerColor,
          winReason: event.reason,
        }));
        sound.playGameOver();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      mgr.cleanup();
    };
  }, [roomCode, isMultiplayer, myPlayerId, myPlayerName]);

  const showNotification = (text: string, type: 'capture' | 'recapture' | 'info') => {
    setLastNotification({ text, type });
    setTimeout(() => setLastNotification(null), 3500);
  };

  // Turn Timer tick
  const activeTimerLimit = isMultiplayer ? (room?.turnTimerSec ?? 30) : urlTimer;

  useEffect(() => {
    if (activeTimerLimit === 0 || gameState.winner) return;
    if (isMultiplayer && room?.status !== 'PLAYING') return;

    setTurnTimeLeft(activeTimerLimit);
    const interval = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          handleTurnTimeout();
          return activeTimerLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.currentTurn, activeTimerLimit, gameState.winner, isMultiplayer, room?.status]);

  const handleTurnTimeout = () => {
    if (isMyTurn && !gameState.winner) {
      sound.playWrong();
      const updatedState = passTurn(gameState);
      setGameState(updatedState);
      if (isMultiplayer && managerRef.current && room) {
        managerRef.current.saveRoom({ ...room, gameState: updatedState, currentTurn: updatedState.currentTurn });
        managerRef.current.broadcast({ type: 'BLOCUS_SYNC', room: { ...room, gameState: updatedState, currentTurn: updatedState.currentTurn } });
      }
    }
  };

  // Lobby 30s Countdown ticker when 2 players in multiplayer room
  useEffect(() => {
    if (!isMultiplayer || !room || room.status !== 'STARTING') {
      setCountdownRemaining(null);
      return;
    }

    const updateCountdown = () => {
      if (!room.scheduledStartAt) return;
      const diff = Math.max(0, Math.ceil((room.scheduledStartAt - Date.now()) / 1000));
      setCountdownRemaining(diff);

      if (diff === 0 && myRole === 'host' && room.status === 'STARTING') {
        handleHostStartMatch();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [room, myRole, isMultiplayer]);

  const handleHostStartMatch = async () => {
    if (!managerRef.current) return;
    sound.playSelect();
    await managerRef.current.startMatchNow();
  };

  const triggerPlacementRipple = useCallback((x: number, y: number, color: BlocusColor) => {
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x, y, color }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 850);
  }, []);

  // Place Dot Action
  const handlePlaceDot = useCallback(
    async (x: number, y: number) => {
      if (gameState.winner) return;
      if (!isMyTurn) return;

      const result = placeBlocusDot(gameState, x, y);
      if (!result.success) {
        sound.playWrong();
        return;
      }

      sound.playPenDot();
      triggerPlacementRipple(x, y, gameState.currentTurn);
      setSelectedPos(null);

      if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
        window.navigator.vibrate(result.newCapturesCount > 0 ? [35, 50, 35] : 18);
      }

      if (result.isRecapture) {
        sound.playRecaptureFanfare();
        showNotification(`Fortress Recaptured! (+${result.newCapturesCount} dots)`, 'recapture');
      } else if (result.newCapturesCount > 0) {
        sound.playEnclosureComplete();
        showNotification(`Enclosure Formed! (+${result.newCapturesCount} dots)`, 'capture');
      }

      setGameState(result.newState);

      // Sync across multiplayer if online
      if (isMultiplayer && managerRef.current && room) {
        const updatedRoom: BlocusRoom = {
          ...room,
          gameState: result.newState,
          currentTurn: result.newState.currentTurn,
          winner: result.newState.winner,
          winReason: result.newState.winReason,
          status: result.newState.winner ? 'GAME_OVER' : 'PLAYING',
        };
        await managerRef.current.saveRoom(updatedRoom);
        managerRef.current.broadcast({
          type: 'BLOCUS_MOVE',
          x,
          y,
          color: gameState.currentTurn,
          gameState: result.newState,
          newlyCaptured: result.newCapturesCount,
          isRecapture: result.isRecapture,
        });
      }
    },
    [gameState, isMyTurn, isMultiplayer, room, triggerPlacementRipple]
  );

  // Solo AI Bot move turn
  useEffect(() => {
    if (!isSolo || gameState.winner) return;
    const oppColor: BlocusColor = soloAssignedColor === 'blue' ? 'red' : 'blue';

    if (gameState.currentTurn === oppColor) {
      setIsAiThinking(true);
      const delay = Math.floor(Math.random() * 350) + 500; // Humanized thinking pace

      const timer = setTimeout(() => {
        const aiMove = getBlocusAIMove(gameState, aiDifficulty, oppColor);
        const result = placeBlocusDot(gameState, aiMove.x, aiMove.y);

        if (result.success) {
          sound.playPenDot();
          triggerPlacementRipple(aiMove.x, aiMove.y, oppColor);
          if (result.isRecapture) {
            sound.playRecaptureFanfare();
            showNotification(`AI Recaptured a Fortress! (+${result.newCapturesCount})`, 'recapture');
          } else if (result.newCapturesCount > 0) {
            sound.playEnclosureComplete();
            showNotification(`AI Formed an Enclosure! (+${result.newCapturesCount})`, 'capture');
          }
          setGameState(result.newState);
        }
        setIsAiThinking(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [gameState, isSolo, soloAssignedColor, aiDifficulty, triggerPlacementRipple]);

  // Solo Rematch
  const handleSoloRematch = () => {
    sound.playStart();
    setGameState(
      createInitialBlocusState({
        preset: urlPreset,
        winTarget: urlTarget,
        playerCount: urlPlayerCount,
      })
    );
  };

  // Multiplayer Rematch
  const handleMultiplayerRematch = async () => {
    if (!managerRef.current || !room) return;
    sound.playStart();
    const freshState = createInitialBlocusState({
      preset: room.gridPreset,
      winTarget: room.winTarget,
      playerCount: 2,
    });

    const updatedRoom: BlocusRoom = {
      ...room,
      gameState: freshState,
      currentTurn: 'blue',
      winner: null,
      winReason: null,
      status: 'PLAYING',
    };

    await managerRef.current.saveRoom(updatedRoom);
    managerRef.current.broadcast({
      type: 'BLOCUS_REMATCH',
      gameState: freshState,
    });
    managerRef.current.broadcast({
      type: 'BLOCUS_SYNC',
      room: updatedRoom,
    });
  };

  // Forfeit Match
  const handleForfeit = async () => {
    sound.playSelect();
    setShowForfeitModal(false);

    if (isSolo || isPassPlay) {
      const opp = gameState.currentTurn === 'blue' ? 'red' : 'blue';
      setGameState((prev) => ({
        ...prev,
        winner: opp,
        winReason: 'Player surrendered the paper',
      }));
      return;
    }

    if (managerRef.current && room) {
      const oppColor: BlocusColor = myAssignedColor === 'blue' ? 'red' : 'blue';
      await managerRef.current.forfeitMatch(
        myPlayerId,
        myPlayerName || 'Player',
        oppColor,
        `${myPlayerName || 'Player'} surrendered the paper`
      );
    }
  };

  // Emojis & Sharing
  const triggerEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  };

  const sendEmoji = (emoji: string) => {
    sound.playSelect();
    triggerEmoji(emoji);
    if (isMultiplayer && managerRef.current) {
      managerRef.current.broadcast({
        type: 'BLOCUS_EMOJI',
        emoji,
        sender: myPlayerName,
      });
    }
  };

  const handleCopyPin = () => {
    sound.playSelect();
    navigator.clipboard.writeText(roomCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyLink = () => {
    sound.playSelect();
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Zoom helpers
  const handleZoom = (delta: number) => {
    sound.playSelect();
    setZoom((prev) => Math.min(3.0, Math.max(0.45, Number((prev + delta).toFixed(2)))));
  };

  const resetView = () => {
    sound.playSelect();
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Coordinate math for graph paper
  const cellSize = 32; // 32px per 5mm graph square
  const paperPadding = 48; // padding around grid intersections
  const boardWidthPx = (gameState.width - 1) * cellSize + paperPadding * 2;
  const boardHeightPx = (gameState.height - 1) * cellSize + paperPadding * 2;

  // Scroll to horizontal sections on mobile (left margin, center action, right edge)
  const scrollToSection = (target: 'left' | 'center' | 'right') => {
    sound.playSelect();
    if (!arenaContainerRef.current) return;
    const el = arenaContainerRef.current;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    let targetLeft = 0;
    if (target === 'center') targetLeft = maxScroll / 2;
    if (target === 'right') targetLeft = maxScroll;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  // Fit board to current container viewport
  const fitBoard = useCallback(() => {
    sound.playSelect();
    if (!arenaContainerRef.current) {
      setZoom(1.0);
      return;
    }
    const containerWidth = arenaContainerRef.current.clientWidth;
    const containerHeight = arenaContainerRef.current.clientHeight;
    const scaleX = (containerWidth - 32) / boardWidthPx;
    const scaleY = (containerHeight - 32) / boardHeightPx;
    const optimalZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.5);
    setZoom(Number(optimalZoom.toFixed(2)));
    if (arenaContainerRef.current) {
      arenaContainerRef.current.scrollTo({
        left: Math.max(0, (arenaContainerRef.current.scrollWidth - arenaContainerRef.current.clientWidth) / 2),
        top: Math.max(0, (arenaContainerRef.current.scrollHeight - arenaContainerRef.current.clientHeight) / 2),
        behavior: 'smooth',
      });
    }
  }, [boardWidthPx, boardHeightPx]);

  // Center viewport on the most recent move
  const focusLastMove = useCallback(() => {
    sound.playSelect();
    if (!gameState.lastMove || !arenaContainerRef.current) return;
    const moveX = paperPadding + gameState.lastMove.x * cellSize;
    const moveY = paperPadding + gameState.lastMove.y * cellSize;
    const el = arenaContainerRef.current;
    const targetX = Math.max(0, moveX * zoom - el.clientWidth / 2);
    const targetY = Math.max(0, moveY * zoom - el.clientHeight / 2);
    el.scrollTo({ left: targetX, top: targetY, behavior: 'smooth' });
  }, [gameState.lastMove, cellSize, paperPadding, zoom]);

  // Initial auto-centering on mobile / mount
  useEffect(() => {
    if (arenaContainerRef.current) {
      const el = arenaContainerRef.current;
      const targetLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      const targetTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
      el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' });
    }
  }, [boardWidthPx, boardHeightPx]);

  // Smooth mouse wheel zoom listener
  useEffect(() => {
    const el = arenaContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If ctrl key is pressed or desktop user zooms
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        setZoom((prev) => Math.min(2.5, Math.max(0.5, Number((prev * zoomFactor).toFixed(2)))));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Pointer event handlers for desktop dragging / panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (interactionMode === 'pan' || e.button === 1 || e.button === 2 || e.altKey) {
      setIsDragging(true);
      if (arenaContainerRef.current) {
        setDragStart({
          x: e.clientX + arenaContainerRef.current.scrollLeft,
          y: e.clientY + arenaContainerRef.current.scrollTop,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && arenaContainerRef.current) {
      arenaContainerRef.current.scrollLeft = dragStart.x - e.clientX;
      arenaContainerRef.current.scrollTop = dragStart.y - e.clientY;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch tracking: allows natural mobile horizontal & vertical scrolling while supporting taps
  const touchTrackRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    hasMoved: boolean;
    initialDist: number;
    initialZoom: number;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    hasMoved: false,
    initialDist: 0,
    initialZoom: 1.0,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchTrackRef.current.initialDist = dist;
      touchTrackRef.current.initialZoom = zoom;
      touchTrackRef.current.hasMoved = true;
    } else if (e.touches.length === 1) {
      touchTrackRef.current.startX = e.touches[0].clientX;
      touchTrackRef.current.startY = e.touches[0].clientY;
      touchTrackRef.current.startTime = Date.now();
      touchTrackRef.current.hasMoved = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchTrackRef.current.initialDist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchTrackRef.current.initialDist;
      const newZoom = Math.min(2.5, Math.max(0.6, Number((touchTrackRef.current.initialZoom * factor).toFixed(2))));
      setZoom(newZoom);
    } else if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchTrackRef.current.startX;
      const dy = e.touches[0].clientY - touchTrackRef.current.startY;
      if (Math.hypot(dx, dy) > 8) {
        touchTrackRef.current.hasMoved = true;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const track = touchTrackRef.current;
    // Deliberate stationary tap (< 8px movement and < 400ms duration)
    if (!track.hasMoved && Date.now() - track.startTime < 400 && svgRef.current) {
      const touch = e.changedTouches[0];
      if (touch) {
        const pos = getGridPositionFromPointer(svgRef.current, touch.clientX, touch.clientY);
        if (pos) {
          if (selectedPos && selectedPos.x === pos.x && selectedPos.y === pos.y) {
            handlePlaceDot(pos.x, pos.y);
          } else {
            sound.playClick();
            setSelectedPos(pos);
            setHoveredPos(pos);
            if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
              window.navigator.vibrate(12);
            }
          }
        }
      }
    }
  };

  const traceSegments = useMemo(
    () => getTraceSegments(gameState),
    [gameState]
  );

  const activePos = selectedPos || hoveredPos;

  const capturePreview = useMemo(() => {
    if (!activePos || !isMyTurn || gameState.dots[posToKey(activePos.x, activePos.y)]) {
      return null;
    }

    const result = placeBlocusDot(gameState, activePos.x, activePos.y);
    return result.success && result.newCapturesCount > 0 ? result : null;
  }, [gameState, activePos, isMyTurn]);

  const dismissRulesGuide = () => {
    setShowRulesModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('blocus_tutorial_seen_v1', 'true');
    }
  };

  const getGridPositionFromPointer = (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number
  ): BlocusPosition | null => {
    const rect = svg.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Convert to unzoomed SVG coordinates
    const svgX = (relativeX / rect.width) * boardWidthPx;
    const svgY = (relativeY / rect.height) * boardHeightPx;

    const gridX = Math.round((svgX - paperPadding) / cellSize);
    const gridY = Math.round((svgY - paperPadding) / cellSize);

    if (gridX >= 0 && gridX < gameState.width && gridY >= 0 && gridY < gameState.height) {
      return { x: gridX, y: gridY };
    }

    return null;
  };

  // Track cursor on the SVG board to snap the desktop hover reticle.
  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) return;
    setHoveredPos(getGridPositionFromPointer(e.currentTarget, e.clientX, e.clientY));
  };

  // Desktop click on SVG in draw mode immediately places
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging || interactionMode === 'pan') return;
    const position = getGridPositionFromPointer(e.currentTarget, e.clientX, e.clientY);
    if (position) {
      handlePlaceDot(position.x, position.y);
    }
  };

  // Pre-game waiting room in multiplayer
  const showPreGameLobby = isMultiplayer && room && (room.status === 'LOBBY' || room.status === 'STARTING');

  return (
    <main 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Floating Emojis */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((item) => (
          <div
            key={item.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-5xl animate-bounce"
            style={{ left: `${42 + Math.random() * 16}%`, animationDuration: '1.8s' }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Notification Toast */}
      {lastNotification && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-none border-2 font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-200 ${
          lastNotification.type === 'recapture'
            ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
            : 'bg-blue-600 text-white border-blue-400'
        }`}>
          <Sparkles className="w-4 h-4" />
          <span>{lastNotification.text}</span>
        </div>
      )}

      {/* TOP HUD BAR */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-4 py-2 sm:py-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <Link
          href="/blocus"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition group"
        >
          <div className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 group-hover:border-slate-700">
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </div>
          <span className="font-bold text-xs uppercase tracking-wider hidden sm:inline">Lobby</span>
        </Link>

        {/* Center Live Match Stats & Score Progress */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Blue Score Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none border-2 text-xs font-black ${
            gameState.currentTurn === 'blue' && !gameState.winner ? 'bg-blue-950/60 border-blue-500 text-blue-300 ring-1 ring-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Blue: {gameState.scores.blue}</span>
            <span className="text-[10px] opacity-70">/{gameState.winTarget}</span>
          </div>

          {/* Red Score Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none border-2 text-xs font-black ${
            gameState.currentTurn === 'red' && !gameState.winner ? 'bg-red-950/60 border-red-500 text-red-300 ring-1 ring-red-400' : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Red: {gameState.scores.red}</span>
            <span className="text-[10px] opacity-70">/{gameState.winTarget}</span>
          </div>

          {/* Turn Timer */}
          {activeTimerLimit > 0 && !gameState.winner && (
            <div className={`flex items-center gap-1 px-2 py-1 bg-slate-900 border-2 rounded-none text-xs font-mono font-bold ${
              turnTimeLeft <= 5 ? 'border-red-500 text-red-400 animate-bounce' : 'border-slate-800 text-slate-300'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{turnTimeLeft}s</span>
            </div>
          )}
        </div>

        {/* Right Tools: Mode, Zoom, Fit, Focus, Fullscreen, Mute, Forfeit */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Interaction Mode Toggle */}
          <div className="flex items-center bg-slate-900 border-2 border-slate-800 p-0.5 rounded-none mr-1">
            <button
              onClick={() => { sound.playSelect(); setInteractionMode('draw'); }}
              className={`px-2 py-1 flex items-center gap-1 text-[11px] font-bold rounded-none transition ${
                interactionMode === 'draw'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Draw / Ink Mode (Tap to place dots)"
            >
              <PenTool className="w-3 h-3" />
              <span className="hidden md:inline">Ink</span>
            </button>
            <button
              onClick={() => { sound.playSelect(); setInteractionMode('pan'); }}
              className={`px-2 py-1 flex items-center gap-1 text-[11px] font-bold rounded-none transition ${
                interactionMode === 'pan'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Pan Mode (Drag with 1 finger/mouse to navigate paper)"
            >
              <Hand className="w-3 h-3" />
              <span className="hidden md:inline">Pan</span>
            </button>
          </div>

          <button
            onClick={() => handleZoom(0.2)}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
            title="Zoom In (or Mouse Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.2)}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
            title="Zoom Out (or Mouse Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fitBoard}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
            title="Fit Entire Sheet to Screen"
          >
            <Scan className="w-3.5 h-3.5" />
          </button>
          {gameState.lastMove && (
            <button
              onClick={focusLastMove}
              className="p-1.5 rounded-none bg-slate-900 border-2 border-blue-500/50 text-blue-400 hover:text-white animate-pulse"
              title="Center on Last Move"
            >
              <LocateFixed className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={resetView}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono font-bold"
            title="Reset Pan & Zoom (1x)"
          >
            {Math.round(zoom * 100)}%
          </button>

          {isMultiplayer && (
            <button
              onClick={() => setShowShareModal(true)}
              className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
              title="Share Room PIN"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-400" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={toggleMute}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white"
            title="How to play"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowForfeitModal(true)}
            className="p-1.5 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-red-400"
            title="Surrender Paper"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* MULTIPLAYER PRE-GAME LOBBY WAITING SCREEN */}
      {showPreGameLobby && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
          <div className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-none p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase rounded-none">
              <Users className="w-3.5 h-3.5" />
              1v1 Paper Duel Lobby
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                {room.status === 'STARTING' ? 'Duelists Ready!' : 'Waiting for Opponent'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Share this PIN code with your classmate to connect across the grid paper.
              </p>
            </div>

            {/* Room Code Box */}
            <div className="p-4 bg-slate-950 border-2 border-red-500/40 rounded-none flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                  ROOM PIN CODE
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-widest">
                  {roomCode}
                </span>
              </div>
              <button
                onClick={handleCopyPin}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-none border border-red-400 flex items-center gap-1.5 transition"
              >
                {copiedPin ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPin ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Players Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 border-2 border-blue-500/40 rounded-none text-left flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-600 border border-blue-300 text-white font-black text-xs flex items-center justify-center">
                  1
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-black text-white truncate block">{room.hostName}</span>
                  <span className="text-[10px] text-blue-400">Bic Blue Pen</span>
                </div>
              </div>

              <div className={`p-3 bg-slate-950 border-2 rounded-none text-left flex items-center gap-2.5 ${
                room.guestId ? 'border-red-500/40' : 'border-slate-800 border-dashed'
              }`}>
                {room.guestId ? (
                  <>
                    <div className="w-7 h-7 rounded-full bg-red-600 border border-red-300 text-white font-black text-xs flex items-center justify-center">
                      2
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-black text-white truncate block">{room.guestName || 'Guest'}</span>
                      <span className="text-[10px] text-red-400">Bic Red Pen</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                    <Hourglass className="w-4 h-4 animate-spin text-red-400 shrink-0" />
                    <span>Awaiting Guest...</span>
                  </div>
                )}
              </div>
            </div>

            {countdownRemaining !== null && countdownRemaining > 0 && (
              <div className="p-3 bg-red-950/60 border-2 border-red-500/40 rounded-none">
                <span className="text-xs text-red-300 font-bold">
                  Match beginning in <span className="text-white text-sm font-mono font-black">{countdownRemaining}s</span>
                </span>
              </div>
            )}

            {myRole === 'host' && (
              <button
                onClick={handleHostStartMatch}
                disabled={!room.guestId}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm rounded-none border-2 border-red-400 shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{room.guestId ? 'Start Match Now' : 'Waiting for Guest...'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE PLAY ARENA - Fully scrollable A4 Mathematics Paper Desk */}
      {!showPreGameLobby && (
        <div 
          ref={arenaContainerRef}
          className={`relative z-10 flex-1 w-full overflow-x-auto overflow-y-auto overscroll-contain select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#050811] p-2 sm:p-6 ${
            interactionMode === 'pan' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
          }`}
          style={{ WebkitOverflowScrolling: 'touch' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Floating Precision Selection Action Pill (for mobile touch confirmation) */}
          {selectedPos && isMyTurn && !gameState.dots[posToKey(selectedPos.x, selectedPos.y)] && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 bg-slate-900/95 border-2 border-blue-500/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-md rounded-none animate-in fade-in slide-in-from-top-3">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-300">
                <LocateFixed className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="hidden sm:inline">Selected:</span>
                <span className="text-white font-black text-sm bg-blue-950 px-2 py-0.5 border border-blue-500/50">
                  {String.fromCharCode(65 + (selectedPos.x % 26))}{selectedPos.y + 1}
                </span>
              </div>
              <button
                onClick={() => handlePlaceDot(selectedPos.x, selectedPos.y)}
                className="px-3.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Place Ink</span>
              </button>
              <button
                onClick={() => setSelectedPos(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Full A4 Paper Centering & Scrollable Wrapper */}
          <div className="min-w-full min-h-full flex items-center justify-start sm:justify-center p-1 sm:p-2">
            <div
              className="shrink-0 transition-transform duration-75 origin-top-left sm:origin-center will-change-transform shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative rounded-sm my-auto"
              style={{
                transform: `scale(${zoom})`,
              }}
            >
            {/* AUTHENTIC MATHEMATICS NOTEBOOK GRAPH PAPER SVG CANVAS */}
            <svg
              ref={svgRef}
              width={boardWidthPx}
              height={boardHeightPx}
              viewBox={`0 0 ${boardWidthPx} ${boardHeightPx}`}
              className="bg-[#faf9f5] border-4 border-slate-700 shadow-2xl rounded-none select-none overflow-visible"
              onClick={handleSvgClick}
              onPointerMove={handleSvgPointerMove}
            >
              <defs>
                {/* 5mm Quad-Ruled Grid Pattern (16px fine sub-squares) */}
                <pattern id="mathGridSmall" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#94a3b830" strokeWidth="0.75" />
                </pattern>
                {/* Major Square Pattern (Every 32px / 2 small squares) */}
                <pattern id="mathGridMajor" width="32" height="32" patternUnits="userSpaceOnUse">
                  <rect width="32" height="32" fill="url(#mathGridSmall)" />
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#64748b45" strokeWidth="1.2" />
                </pattern>
                {/* Drop shadow filter for watercolor washes */}
                <filter id="inkGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Graph Paper Background Fill */}
              <rect width="100%" height="100%" fill="url(#mathGridMajor)" />

              {/* Binder Spiral Holes along left edge (authentic school notebook) */}
              {[0.18, 0.5, 0.82].map((ratio, idx) => (
                <g key={`binder-hole-${idx}`}>
                  <circle
                    cx="15"
                    cy={boardHeightPx * ratio}
                    r="6.5"
                    fill="#111827"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="15"
                    cy={boardHeightPx * ratio}
                    r="4.5"
                    fill="#030712"
                  />
                </g>
              ))}

              {/* French Notebook Double-Ruled Red Left Margin Line */}
              <line x1={paperPadding - 16} y1="0" x2={paperPadding - 16} y2={boardHeightPx} stroke="#ef444465" strokeWidth="1.5" />
              <line x1={paperPadding - 20} y1="0" x2={paperPadding - 20} y2={boardHeightPx} stroke="#ef444435" strokeWidth="1" />

              {/* Intersection Coordinate Crosshairs Guides (active axis tracking) */}
              {activePos && isMyTurn && !gameState.dots[posToKey(activePos.x, activePos.y)] && (
                <g className="pointer-events-none opacity-40">
                  <line
                    x1={paperPadding + activePos.x * cellSize}
                    y1={paperPadding - 10}
                    x2={paperPadding + activePos.x * cellSize}
                    y2={paperPadding + (gameState.height - 1) * cellSize}
                    stroke={gameState.currentTurn === 'blue' ? '#3b82f6' : '#ef4444'}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <line
                    x1={paperPadding - 10}
                    y1={paperPadding + activePos.y * cellSize}
                    x2={paperPadding + (gameState.width - 1) * cellSize}
                    y2={paperPadding + activePos.y * cellSize}
                    stroke={gameState.currentTurn === 'blue' ? '#3b82f6' : '#ef4444'}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                </g>
              )}

              {/* Intersection Coordinates Labels (A, B, C... and 1, 2, 3...) with dynamic highlight */}
              {Array.from({ length: gameState.width }).map((_, i) => {
                const isHighlighted = activePos?.x === i;
                const colX = paperPadding + i * cellSize;
                return (
                  <g key={`col-${i}`}>
                    {isHighlighted && (
                      <rect
                        x={colX - 8}
                        y={paperPadding - 24}
                        width="16"
                        height="13"
                        rx="2"
                        fill={gameState.currentTurn === 'blue' ? 'rgba(37, 99, 235, 0.22)' : 'rgba(239, 68, 68, 0.22)'}
                      />
                    )}
                    <text
                      x={colX}
                      y={paperPadding - 14}
                      textAnchor="middle"
                      fontSize={isHighlighted ? "11" : "10"}
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={isHighlighted ? (gameState.currentTurn === 'blue' ? '#1d4ed8' : '#dc2626') : '#64748b'}
                    >
                      {String.fromCharCode(65 + (i % 26))}
                    </text>
                  </g>
                );
              })}

              {Array.from({ length: gameState.height }).map((_, i) => {
                const isHighlighted = activePos?.y === i;
                const rowY = paperPadding + i * cellSize;
                return (
                  <g key={`row-${i}`}>
                    {isHighlighted && (
                      <rect
                        x={paperPadding - 25}
                        y={rowY - 8}
                        width="18"
                        height="13"
                        rx="2"
                        fill={gameState.currentTurn === 'blue' ? 'rgba(37, 99, 235, 0.22)' : 'rgba(239, 68, 68, 0.22)'}
                      />
                    )}
                    <text
                      x={paperPadding - 15}
                      y={rowY + 3.5}
                      textAnchor="middle"
                      fontSize={isHighlighted ? "10" : "9"}
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={isHighlighted ? (gameState.currentTurn === 'blue' ? '#1d4ed8' : '#dc2626') : '#64748b'}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}

              {/* LIVE INK TRACE: every adjacent friendly dot joined with ballpoint pen line */}
              {traceSegments.map((segment) => {
                const traceColor = segment.color === 'blue'
                  ? '#1d4ed8'
                  : segment.color === 'red'
                  ? '#dc2626'
                  : '#15803d';

                return (
                  <line
                    key={`${segment.color}-${segment.from.x},${segment.from.y}-${segment.to.x},${segment.to.y}`}
                    x1={paperPadding + segment.from.x * cellSize}
                    y1={paperPadding + segment.from.y * cellSize}
                    x2={paperPadding + segment.to.x * cellSize}
                    y2={paperPadding + segment.to.y * cellSize}
                    stroke={traceColor}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeDasharray="5 3"
                    opacity="0.65"
                    className="animate-in fade-in duration-200"
                  />
                );
              })}

              {/* CAPTURE PREVIEW: shown when placing on this spot closes an opponent-containing loop */}
              {capturePreview?.newState.enclosures
                .slice(gameState.enclosures.length)
                .map((enc) => {
                  const pointsStr = enc.polygon
                    .map(([px, py]) => `${paperPadding + px * cellSize},${paperPadding + py * cellSize}`)
                    .join(' ');
                  const previewColor = enc.owner === 'blue' ? '#2563eb' : enc.owner === 'red' ? '#ef4444' : '#16a34a';

                  return (
                    <polygon
                      key={`preview-${enc.id}`}
                      points={pointsStr}
                      fill={`${previewColor}25`}
                      stroke={previewColor}
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      strokeLinejoin="round"
                      className="pointer-events-none animate-pulse"
                    />
                  );
                })}

              {/* COMPLETED ENCLOSURE POLYGONS (WATERCOLOR INK WASH + PERIMETER BALLPOINT STROKE) */}
              {gameState.enclosures.map((enc) => {
                const pointsStr = enc.polygon
                  .map(([px, py]) => `${paperPadding + px * cellSize},${paperPadding + py * cellSize}`)
                  .join(' ');

                const isBlue = enc.owner === 'blue';
                return (
                  <g key={enc.id}>
                    {/* Translucent Watercolor Wash Interior */}
                    <polygon
                      points={pointsStr}
                      fill={isBlue ? 'rgba(29, 78, 216, 0.18)' : 'rgba(220, 38, 38, 0.18)'}
                      className="animate-in fade-in duration-300"
                    />
                    {/* Ballpoint Pen Boundary Perimeter Stroke */}
                    <polygon
                      points={pointsStr}
                      fill="none"
                      stroke={isBlue ? '#1d4ed8' : '#dc2626'}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* INTERSECTION GRID PIPS (Subtle markers at each intersection) */}
              {Array.from({ length: gameState.height }).map((_, y) =>
                Array.from({ length: gameState.width }).map((_, x) => {
                  const cx = paperPadding + x * cellSize;
                  const cy = paperPadding + y * cellSize;
                  return (
                    <circle
                      key={`pip-${x}-${y}`}
                      cx={cx}
                      cy={cy}
                      r="1.5"
                      fill="#94a3b8"
                      opacity="0.38"
                    />
                  );
                })
              )}

              {/* PLACED PERMANENT INK DOTS WITH 3D BALLPOINT SHINE */}
              {Object.values(gameState.dots).map((dot) => {
                const cx = paperPadding + dot.x * cellSize;
                const cy = paperPadding + dot.y * cellSize;
                const isCaptured = dot.enclosedBy && dot.enclosedBy !== dot.originalOwner;

                let fillColor = dot.originalOwner === 'blue' ? '#1d4ed8' : '#dc2626';
                if (dot.originalOwner === 'green') fillColor = '#15803d';

                return (
                  <g key={posToKey(dot.x, dot.y)} className="transition-all duration-200">
                    {/* Captured Halo Glow if encircled */}
                    {isCaptured && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="10.5"
                        fill={dot.enclosedBy === 'blue' ? 'rgba(29, 78, 216, 0.22)' : 'rgba(220, 38, 38, 0.22)'}
                        stroke={dot.enclosedBy === 'blue' ? '#2563eb' : '#ef4444'}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Outer soft ink diffusion bleed */}
                    <circle cx={cx} cy={cy} r="6.8" fill={fillColor} opacity="0.22" />

                    {/* Main ballpoint ink bead */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="5.5"
                      fill={fillColor}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />

                    {/* Specular 3D ballpoint roller shine highlight */}
                    <circle
                      cx={cx - 1.3}
                      cy={cy - 1.3}
                      r="1.6"
                      fill="rgba(255, 255, 255, 0.75)"
                    />
                  </g>
                );
              })}

              {/* LAST MOVE INDICATOR (Pulsing Radar Ring around previous play) */}
              {gameState.lastMove && (
                <g className="pointer-events-none">
                  <circle
                    cx={paperPadding + gameState.lastMove.x * cellSize}
                    cy={paperPadding + gameState.lastMove.y * cellSize}
                    className="animate-blocus-last-move"
                    fill="none"
                    stroke={gameState.lastMove.color === 'blue' ? '#2563eb' : '#ef4444'}
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  <circle
                    cx={paperPadding + gameState.lastMove.x * cellSize}
                    cy={paperPadding + gameState.lastMove.y * cellSize}
                    r="2.2"
                    fill={gameState.lastMove.color === 'blue' ? '#60a5fa' : '#f87171'}
                  />
                </g>
              )}

              {/* ANIMATED PLACEMENT INK RIPPLES */}
              {ripples.map((ripple) => (
                <circle
                  key={ripple.id}
                  cx={paperPadding + ripple.x * cellSize}
                  cy={paperPadding + ripple.y * cellSize}
                  className="animate-blocus-ripple pointer-events-none"
                  stroke={ripple.color === 'blue' ? '#1d4ed8' : '#dc2626'}
                  fill="none"
                />
              ))}

              {/* PRECISION TARGET RETICLE & CAPTURE OPPORTUNITY BANNER */}
              {activePos && !gameState.dots[posToKey(activePos.x, activePos.y)] && isMyTurn && (
                <g className="pointer-events-none animate-pulse">
                  {/* Outer reticle dashed target ring */}
                  <circle
                    cx={paperPadding + activePos.x * cellSize}
                    cy={paperPadding + activePos.y * cellSize}
                    r="11"
                    fill="none"
                    stroke={myAssignedColor === 'blue' ? '#2563eb' : '#ef4444'}
                    strokeWidth="1.8"
                    strokeDasharray="3 3"
                  />
                  {/* Core targeting bead */}
                  <circle
                    cx={paperPadding + activePos.x * cellSize}
                    cy={paperPadding + activePos.y * cellSize}
                    r="3.5"
                    fill={myAssignedColor === 'blue' ? 'rgba(37, 99, 235, 0.7)' : 'rgba(239, 68, 68, 0.7)'}
                  />
                  {/* Capture banner notification */}
                  {capturePreview && (
                    <g>
                      <rect
                        x={paperPadding + activePos.x * cellSize - 48}
                        y={paperPadding + activePos.y * cellSize - 32}
                        width="96"
                        height="18"
                        rx="2"
                        fill={capturePreview.isRecapture ? '#f59e0b' : (myAssignedColor === 'blue' ? '#1d4ed8' : '#dc2626')}
                      />
                      <text
                        x={paperPadding + activePos.x * cellSize}
                        y={paperPadding + activePos.y * cellSize - 19}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="sans-serif"
                        fontWeight="bold"
                        fill="#ffffff"
                      >
                        {capturePreview.isRecapture ? '👑 RECAPTURE!' : `⚡ ENCLOSE +${capturePreview.newCapturesCount}`}
                      </text>
                    </g>
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>

          {/* Mobile Horizontal Quick Navigation Pill */}
          <div className="sm:hidden fixed bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none pb-1 w-full max-w-xs px-2">
            <div className="pointer-events-auto bg-slate-900/95 border-2 border-slate-700/90 backdrop-blur-md px-2.5 py-1.5 flex items-center justify-between shadow-2xl">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">A4 Sheet:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollToSection('left')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 active:scale-95 transition"
                  title="Scroll to Left Margin"
                >
                  ◀ Left
                </button>
                <button
                  onClick={() => scrollToSection('center')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 active:scale-95 transition"
                  title="Scroll to Center Clash"
                >
                  ● Mid
                </button>
                <button
                  onClick={() => scrollToSection('right')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 active:scale-95 transition"
                  title="Scroll to Right Edge"
                >
                  Right ▶
                </button>
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROLS & ENHANCED MINI HUD */}
          <div className="w-full max-w-lg mt-2.5 flex items-center justify-between px-3 py-2 bg-slate-900/95 border-2 border-slate-800 rounded-none backdrop-blur-md shadow-xl shrink-0">
            {/* Turn Status with Color Pill */}
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                gameState.currentTurn === 'blue' ? 'bg-blue-500 shadow-sm shadow-blue-500 animate-pulse' : 'bg-red-500 shadow-sm shadow-red-500 animate-pulse'
              }`} />
              <span className="text-xs font-black uppercase text-white tracking-wide truncate max-w-[180px] sm:max-w-none">
                {gameState.winner
                  ? 'Game Finished'
                  : isMyTurn
                  ? `Your Turn (${myAssignedColor.toUpperCase()})`
                  : isSolo
                  ? 'Bot Planning...'
                  : "Opponent's Turn"}
              </span>
            </div>

            {/* Middle Quick Tool Controls */}
            <div className="flex items-center gap-1.5">
              {/* Interaction Mode Toggle */}
              <div className="flex items-center bg-slate-950 border border-slate-700 p-0.5 rounded-none">
                <button
                  onClick={() => { sound.playSelect(); setInteractionMode('draw'); }}
                  className={`px-2 py-1 flex items-center gap-1 text-[11px] font-bold rounded-none transition ${
                    interactionMode === 'draw'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ink Mode (Tap/Click to place)"
                >
                  <PenTool className="w-3 h-3" />
                  <span className="hidden sm:inline">Ink</span>
                </button>
                <button
                  onClick={() => { sound.playSelect(); setInteractionMode('pan'); }}
                  className={`px-2 py-1 flex items-center gap-1 text-[11px] font-bold rounded-none transition ${
                    interactionMode === 'pan'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Pan Mode (Drag to scroll sheet)"
                >
                  <Hand className="w-3 h-3" />
                  <span className="hidden sm:inline">Pan</span>
                </button>
              </div>

              {/* Pass Turn Button */}
              {!gameState.winner && (
                <button
                  onClick={() => {
                    sound.playClick();
                    const updated = passTurn(gameState);
                    setGameState(updated);
                    if (isMultiplayer && managerRef.current && room) {
                      managerRef.current.saveRoom({ ...room, gameState: updated });
                      managerRef.current.broadcast({ type: 'BLOCUS_SYNC', room: { ...room, gameState: updated } });
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold rounded-none transition"
                  title="Pass turn without placing a seed"
                >
                  Pass
                </button>
              )}
            </div>

            {/* Quick Reactions */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {['✏️', '🧠', '🛡️', '⚡'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  className="px-1 py-0.5 text-xs hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER VICTORY MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-blue-500/60 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-widest text-blue-400 uppercase">How Blocus Works</p>
                <h2 className="mt-1 text-xl font-black text-white">Surround. Capture. Counter.</h2>
              </div>
              <HelpCircle className="w-6 h-6 text-blue-400 shrink-0" />
            </div>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3"><span className="text-blue-400 font-black">1</span><span>Place one seed on any empty grid intersection when it is your turn.</span></li>
              <li className="flex gap-3"><span className="text-blue-400 font-black">2</span><span>Build an adjacent blue or red chain around your opponent&apos;s seeds.</span></li>
              <li className="flex gap-3"><span className="text-blue-400 font-black">3</span><span>Close the loop to capture the seeds inside. A capture earns one bonus seed.</span></li>
            </ol>
            <p className="text-xs text-slate-400 border-l-2 border-blue-500/50 pl-3">A dashed preview means your next placement will complete a capture.</p>
            <button
              onClick={dismissRulesGuide}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white font-black text-sm transition"
            >
              Start Playing
            </button>
          </div>
        </div>
      )}

      {gameState.winner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-4 border-slate-700 rounded-none p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 mx-auto rounded-none border-2 flex items-center justify-center text-white shadow-xl ${
              gameState.winner === myAssignedColor ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-bounce' : 'bg-red-500/20 border-red-500 text-red-400'
            }`}>
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {gameState.winner === 'draw'
                  ? 'Stalemate Draw!'
                  : gameState.winner === myAssignedColor
                  ? 'Victory by Enclosure!'
                  : isSolo
                  ? 'Schoolyard Bot Claimed Victory'
                  : 'Opponent Captured Paper'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {gameState.winReason || `Final Captures: Blue ${gameState.scores.blue} - Red ${gameState.scores.red}`}
              </p>
            </div>

            {/* Rematch & Lobby Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={isMultiplayer ? handleMultiplayerRematch : handleSoloRematch}
                className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-none border-2 border-blue-400 shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Rematch</span>
              </button>

              <Link
                href="/blocus"
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-sm rounded-none border-2 border-slate-600 flex items-center justify-center gap-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Lobby</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* SURRENDER MODAL */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-red-500/50 rounded-none p-6 text-center space-y-4 shadow-2xl">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-black text-white">Surrender Paper?</h3>
            <p className="text-xs text-slate-400">
              Surrendering will immediately concede victory to your opponent.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowForfeitModal(false)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-none border border-slate-600"
              >
                Keep Playing
              </button>
              <button
                onClick={handleForfeit}
                className="py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-none border border-red-400"
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-blue-500/50 rounded-none p-6 text-center space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-400" />
                Invite Classmate
              </h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-none inline-block shadow-lg mx-auto">
              <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : roomCode} size={150} level="M" />
            </div>

            <div className="p-3 bg-slate-950 border-2 border-slate-800 rounded-none flex items-center justify-between">
              <span className="font-mono font-black text-xl text-white tracking-widest">{roomCode}</span>
              <button
                onClick={handleCopyPin}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-none border border-blue-400 flex items-center gap-1"
              >
                {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPin ? 'Copied' : 'PIN'}</span>
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-none border border-slate-600 flex items-center justify-center gap-1.5"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Battle Link'}</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
