import { useCallback, useRef, useState } from 'react';
import { GameView } from './ui/GameView';
import { MainMenu } from './ui/MainMenu';
import { NewGameMenu } from './ui/NewGameMenu';
import { ResultScreen } from './ui/ResultScreen';
import { enterDemoFullscreen } from './ui/fullscreen';
import {
  loadBindings,
  loadLastResult,
  loadPlayer,
  loadSettings,
  saveBindings,
  saveLastResult,
  saveSettings,
} from './state/storage';
import { useRegisterMatch } from './api/queries';
import type { GameSettings } from './game/types';
import type { Bindings } from './state/bindings';
import type { Screen, SessionResult } from './types';

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [bindings, setBindings] = useState<Bindings>(() => loadBindings());
  const [player] = useState(() => loadPlayer());
  const [screen, setScreen] = useState<Screen>('menu');
  const [matchKey, setMatchKey] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(() => loadLastResult<SessionResult>());
  const clientMatchId = useRef<string>('');
  const register = useRegisterMatch();

  const startMatch = useCallback(() => {
    // Start and Play Again are the user gesture the Fullscreen API requires.
    void enterDemoFullscreen();
    clientMatchId.current = newClientId();
    register.reset();
    setMatchKey((key) => key + 1);
    setScreen('game');
  }, [register]);

  const submitResult = useCallback(
    (finished: SessionResult) => {
      register.mutate({
        clientMatchId: clientMatchId.current || newClientId(),
        playerId: player.id,
        playerName: player.name,
        teamName: 'Ironclad',
        score: finished.score,
        durationSeconds: finished.durationSeconds,
        endReason: finished.endReason,
        turnSeconds: finished.config.turnSeconds,
        wind: finished.config.wind,
        difficulty: finished.config.difficulty,
        kills: finished.kills,
      });
    },
    [player.id, player.name, register],
  );

  const handleFinish = useCallback(
    (finished: SessionResult) => {
      setResult(finished);
      saveLastResult(finished);
      setScreen('result');
      submitResult(finished);
    },
    [submitResult],
  );

  const handleSaveSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleSaveBindings = useCallback((next: Bindings) => {
    setBindings(next);
    saveBindings(next);
  }, []);

  // Two static routes: /project is the informational page, everything else plays.
  if (window.location.pathname.startsWith('/project')) {
    return (
      <div className="app">
        <MainMenu
          settings={settings}
          player={player}
          lastResult={result}
          onStart={() => window.location.assign('/demo')}
          onSaveSettings={handleSaveSettings}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <NewGameMenu
          onStart={startMatch}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          bindings={bindings}
          onSaveBindings={handleSaveBindings}
        />
      )}

      {screen === 'game' && (
        <GameView
          key={matchKey}
          settings={settings}
          bindings={bindings}
          onSaveSettings={handleSaveSettings}
          onSaveBindings={handleSaveBindings}
          onFinish={handleFinish}
          onExit={() => setScreen('menu')}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          saving={register.isPending}
          saved={register.isSuccess}
          saveError={register.isError}
          onRetry={() => result && submitResult(result)}
          onPlayAgain={startMatch}
          onMenu={() => window.location.assign('/project')}
        />
      )}
    </div>
  );
}
