// ============================================================================
// App — Root Component with Online + Local routing
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import type { GameConfig, RoomInfo, PlayerPosition, SerializableGameState } from '@shared/types';
import { preloadAssets } from './utils/preloadAssets';
import { Home } from './pages/Home';
import { LocalGame } from './pages/LocalGame';
import { OnlineMenu } from './pages/OnlineMenu';
import { Lobby } from './pages/Lobby';
import { OnlineGame } from './pages/OnlineGame';
import { About } from './pages/About';
import { FAQ } from './pages/FAQ';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SessionProvider } from './contexts/SessionContext';
import { SocketProvider } from './contexts/SocketContext';

type AppPage =
  | 'home'
  | 'local-game'
  | 'online-menu'
  | 'lobby'
  | 'online-game'
  | 'about'
  | 'faq';

export default function App() {
  // Preload all game images in background on first visit
  useEffect(() => { preloadAssets(); }, []);

  const [page, setPage] = useState<AppPage>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/join/')) return 'online-menu';
    if (path === '/about') return 'about';
    if (path === '/faq') return 'faq';
    return 'home';
  });

  // Sync state with browser history for About/FAQ
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/about') setPage('about');
      else if (path === '/faq') setPage('faq');
      else if (path === '/') setPage('home');
      else if (path.startsWith('/join/')) setPage('online-menu');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((newPage: AppPage, path: string = '/') => {
    setPage(newPage);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

  // Online state
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [myPosition, setMyPosition] = useState<PlayerPosition | null>(null);
  const [onlineGameState, setOnlineGameState] = useState<SerializableGameState | null>(null);

  // Extract initial room code from URL if joining
  const [rejoinCode, setRejoinCode] = useState<string | null>(null);
  
  const initialRoomCode = (() => {
    if (rejoinCode) return rejoinCode;
    const path = window.location.pathname;
    if (path.startsWith('/join/')) {
      return path.split('/join/')[1]?.toUpperCase().trim() || '';
    }
    return '';
  })();

  // ── Local Game ──
  const handleStartLocalGame = useCallback(
    (config: GameConfig, names: Record<string, string>) => {
      setGameConfig(config);
      setPlayerNames(names);
      setPage('local-game');
    },
    [],
  );

  const handleExitLocal = useCallback(() => {
    setGameConfig(null);
    setPlayerNames({});
    setPage('home');
    window.history.replaceState(null, '', '/');
  }, []);

  // ── Online ──
  const handleGoOnline = useCallback(() => {
    setPage('online-menu');
  }, []);

  const handleBackToHome = useCallback(() => {
    navigateTo('home', '/');
  }, [navigateTo]);

  const handleRoomJoined = useCallback((room: RoomInfo, position: PlayerPosition) => {
    setCurrentRoom(room);
    setMyPosition(position);
    // Save to localStorage so Home can show "Rejoin" if user navigates away
    localStorage.setItem('activeRoom', JSON.stringify({ code: room.roomCode, position }));
    setPage('lobby');
  }, []);

  const handleLobbyLeave = useCallback(() => {
    setCurrentRoom(null);
    setMyPosition(null);
    setPage('online-menu');
  }, []);

  const handleGameStart = useCallback((state: SerializableGameState) => {
    setOnlineGameState(state);
    setPage('online-game');
  }, []);

  const handleExitOnline = useCallback(() => {
    setOnlineGameState(null);
    setCurrentRoom(null);
    setMyPosition(null);
    localStorage.removeItem('activeRoom');
    setPage('home');
    window.history.replaceState(null, '', '/');
  }, []);

  return (
    <ThemeProvider>
      <SessionProvider>
        {/* Only wrap with SocketProvider when we're in online pages */}
        {page === 'home' || page === 'local-game' || page === 'about' || page === 'faq' ? (
          <>
            {page === 'about' ? (
              <About onBack={handleBackToHome} />
            ) : page === 'faq' ? (
              <FAQ onBack={handleBackToHome} />
            ) : page === 'local-game' && gameConfig ? (
              <GameProvider key={Date.now()} config={gameConfig} playerNames={playerNames}>
                <LocalGame onExit={handleExitLocal} />
              </GameProvider>
            ) : (
              <Home
                onStartGame={handleStartLocalGame}
                onPlayOnline={handleGoOnline}
                onViewAbout={() => navigateTo('about', '/about')}
                onViewFAQ={() => navigateTo('faq', '/faq')}
                onRejoinRoom={(code: string) => {
                  setRejoinCode(code);
                  setPage('online-menu');
                }}
                activeRoomCode={localStorage.getItem('activeRoom') ? JSON.parse(localStorage.getItem('activeRoom')!).code : null}
              />
            )}
          </>
        ) : (
          <SocketProvider>
            {page === 'online-menu' && (
              <OnlineMenu
                onRoomJoined={handleRoomJoined}
                onGameRejoined={(room, position, gameState) => {
                  setCurrentRoom(room);
                  setMyPosition(position);
                  setOnlineGameState(gameState);
                  localStorage.setItem('activeRoom', JSON.stringify({ code: room.roomCode, position }));
                  setPage('online-game');
                }}
                onBack={handleBackToHome}
                initialRoomCode={initialRoomCode}
              />
            )}
            {page === 'lobby' && currentRoom && myPosition && (
              <Lobby
                room={currentRoom}
                myPosition={myPosition}
                onGameStart={handleGameStart}
                onLeave={handleLobbyLeave}
              />
            )}
            {page === 'online-game' && onlineGameState && myPosition && (
              <OnlineGame
                initialState={onlineGameState}
                myPosition={myPosition}
                onExit={handleExitOnline}
              />
            )}
          </SocketProvider>
        )}
      </SessionProvider>
    </ThemeProvider>
  );
}
