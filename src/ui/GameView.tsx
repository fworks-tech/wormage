import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { ArenaRenderer } from '../game/renderer';
import { SoundKit } from '../game/audio';
import { AIM } from '../game/config';
import type { GameSettings, GameSnapshot, WeaponId } from '../game/types';
import type { SessionResult } from '../types';
import { Hud } from './Hud';

interface GameViewProps {
  settings: GameSettings;
  onFinish: (result: SessionResult) => void;
  onExit: () => void;
}

/**
 * Owns the match: simulation, renderer, input and pause rules live here.
 * React only sees throttled snapshots (~10 Hz), never a render per frame.
 */
export function GameView({ settings, onFinish, onExit }: GameViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const soundRef = useRef<SoundKit | null>(null);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastUiPush = useRef(0);
  const dragRef = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({
    active: false,
    moved: false,
    x: 0,
    y: 0,
  });

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `?seed=123` makes terrain and AI jitter reproducible for E2E runs.
  const seedRef = useRef(
    (() => {
      const raw = Number(new URLSearchParams(window.location.search).get('seed'));
      return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : Math.floor(Math.random() * 1_000_000_000);
    })(),
  );

  const setPause = useCallback((value: boolean) => {
    if (finishedRef.current) return;
    pausedRef.current = value;
    setPaused(value);
    if (engineRef.current) {
      engineRef.current.moveDir = 0;
      // A release under the pause card must not fire the held shot.
      if (value) engineRef.current.cancelCharge();
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    const engine = new GameEngine({
      turnSeconds: settings.turnSeconds,
      wind: settings.wind,
      difficulty: settings.difficulty,
      seed: seedRef.current,
      wormsPerTeam: 3,
    });
    engineRef.current = engine;
    // E2E instrumentation: lets Playwright observe the authoritative simulation
    // state instead of scraping pixels. Read-only by convention.
    if (typeof window !== 'undefined') {
      (window as unknown as { __WORMAGE__?: unknown }).__WORMAGE__ = {
        engine,
        snapshot: () => engine.snapshot(),
        version: '1.0.0',
      };
    }
    const sound = new SoundKit(settings.sound);
    soundRef.current = sound;

    const onResult = () => {
      if (finishedRef.current || disposed) return;
      finishedRef.current = true;
      const result: SessionResult = {
        winnerTeam: engine.winnerTeam,
        playerTeam: 0,
        playerWon: engine.winnerTeam === 0,
        score: engine.scoreFor(0),
        durationSeconds: Math.round(engine.elapsed),
        endReason: engine.endReason ?? 'wipeout',
        kills: engine.kills[0],
        config: {
          turnSeconds: settings.turnSeconds,
          wind: settings.wind,
          difficulty: settings.difficulty,
          seed: seedRef.current,
        },
        recordedAt: new Date().toISOString(),
      };
      window.setTimeout(() => {
        if (!disposed) onFinish(result);
      }, 1500);
    };

    const tick = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const dt = Math.min(0.08, renderer.app.ticker.deltaMS / 1000);
      const isPaused = pausedRef.current;

      if (!isPaused) {
        // The AI drives its own worm; player input only steers on human turns.
        if (!engine.teams[engine.activeTeam].isAi) {
          if (engine.phase === 'aim' || engine.retreatActive) {
            if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) engine.setMove(-1);
            else if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) engine.setMove(1);
            else engine.setMove(0);

            if (engine.phase === 'aim') {
              if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) engine.aimBy(AIM.rate * dt);
              if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) engine.aimBy(-AIM.rate * dt);
            }
          } else {
            engine.setMove(0);
          }
        }

        engine.update(dt);

        for (const event of engine.events.splice(0)) {
          renderer.handleEvent(event);
          switch (event.type) {
            case 'fire':
              sound.play('fire');
              break;
            case 'explosion':
              sound.play('boom');
              break;
            case 'hurt':
              sound.play('hurt');
              break;
            case 'death':
              sound.play('death');
              break;
            case 'splash':
              sound.play('splash');
              break;
            case 'bounce':
              sound.play('bounce');
              break;
            case 'jump':
              sound.play('jump');
              break;
            case 'turn':
              sound.play('turn');
              break;
            case 'gameover':
              sound.play(engine.winnerTeam === 0 ? 'victory' : 'death');
              break;
            default:
              break;
          }
        }

        if (engine.phase === 'gameover') onResult();
      }

      renderer.render(dt, isPaused);

      const next = engine.snapshot();
      snapshotRef.current = next;
      // UI sync at ~10 Hz: React never renders per frame.
      const now = performance.now();
      if (now - lastUiPush.current > 100) {
        lastUiPush.current = now;
        setSnapshot(next);
      }
    };

    const attach = async () => {
      try {
        const renderer = await ArenaRenderer.create(host, engine);
        if (disposed) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        renderer.app.ticker.add(tick);
        setReady(true);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'Renderer failed to start');
      }
    };
    void attach();

    const pauseAuto = () => setPause(true);
    const onVisibility = () => {
      if (document.hidden) pauseAuto();
    };
    window.addEventListener('blur', pauseAuto);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      window.removeEventListener('blur', pauseAuto);
      document.removeEventListener('visibilitychange', onVisibility);
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.app.ticker.remove(tick);
        renderer.destroy();
      }
      rendererRef.current = null;
      engineRef.current = null;
      delete (window as unknown as { __WORMAGE__?: unknown }).__WORMAGE__;
      soundRef.current = null;
    };
    // The match runs from a settings snapshot taken at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setPause(!pausedRef.current);
        return;
      }
      if (pausedRef.current) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          setPause(false);
        }
        return;
      }
      const engine = engineRef.current;
      const snap = snapshotRef.current;
      if (!engine || !snap || finishedRef.current) return;

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowRight':
        case 'KeyD':
        case 'ArrowUp':
        case 'KeyW':
        case 'ArrowDown':
        case 'KeyS':
          keysRef.current.add(e.code);
          break;
        case 'Space':
          keysRef.current.add(e.code);
          if (!e.repeat && snap.activeTeam === 0) engine.startCharge();
          break;
        case 'KeyJ':
          engine.jump();
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4': {
          const map: Record<string, WeaponId> = {
            Digit1: 'bazooka',
            Digit2: 'grenade',
            Digit3: 'shotgun',
            Digit4: 'dynamite',
          };
          engine.selectWeapon(map[e.code]);
          break;
        }
        case 'KeyE':
          if (snap.activeTeam === 0) engine.endTurn();
          break;
        default:
          break;
      }
    };

    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      if (e.code === 'Space' && engineRef.current) engineRef.current.releaseCharge();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setPause]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !ready) return;
    const canvas = renderer.canvas;

    const localPoint = (e: PointerEvent) => renderer.toWorld(e.clientX, e.clientY);

    const onDown = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine || pausedRef.current || finishedRef.current) return;
      const snap = engine.snapshot();
      if (snap.phase !== 'aim' || snap.activeTeam !== 0) return;
      const point = localPoint(e);
      engine.setAimFromPoint(point.x, point.y);
      dragRef.current = { active: true, moved: false, x: point.x, y: point.y };
      canvas.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine || !dragRef.current.active) return;
      const point = localPoint(e);
      const worm = engine.activeWorm;
      if (!worm) return;
      dragRef.current.moved = true;
      engine.setAimFromPoint(point.x, point.y);
      if (!engine.charging) {
        const distance = Math.hypot(point.x - worm.x, point.y - (worm.y - 14));
        engine.power = Math.min(1, Math.max(0.12, distance / 340));
      }
    };

    const onUp = () => {
      const engine = engineRef.current;
      const wasActive = dragRef.current.active;
      dragRef.current.active = false;
      if (!engine || !wasActive) return;
      if (dragRef.current.moved) engine.fire();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('contextmenu', noMenu);
    };
  }, [ready]);

  const engine = engineRef.current;

  return (
    <div className="game-shell">
      <div ref={hostRef} className="arena-host" data-testid="arena" aria-label="Battle arena" role="img" />

      {!ready && !error && (
        <div className="loading-overlay">
          <div className="loader" />
          <p>Digging trenches…</p>
        </div>
      )}
      {error && (
        <div className="loading-overlay">
          <p className="error-text">The arena could not start: {error}</p>
          <button type="button" className="primary-btn" onClick={onExit}>
            Back to menu
          </button>
        </div>
      )}

      {snapshot && ready && (
        <Hud
          snapshot={snapshot}
          paused={paused}
          onMove={(dir) => engineRef.current?.setMove(dir)}
          onAim={(dir) => engineRef.current?.aimBy(dir * 0.06)}
          onAimStop={() => undefined}
          onJump={() => engineRef.current?.jump()}
          onChargeStart={() => engineRef.current?.startCharge()}
          onChargeEnd={() => engineRef.current?.releaseCharge()}
          onSelectWeapon={(weapon) => engineRef.current?.selectWeapon(weapon)}
          onEndTurn={() => engineRef.current?.endTurn()}
          onPause={() => setPause(true)}
        />
      )}

      {paused && (
        <div className="overlay pause-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
          <div className="overlay-card">
            <p className="eyebrow">Truce</p>
            <h2>Paused</h2>
            <p className="muted">The clock, wind and fuses are frozen until you resume.</p>
            <div className="overlay-actions">
              <button type="button" className="primary-btn" onClick={() => setPause(false)} data-testid="btn-resume">
                Resume
              </button>
              <button type="button" className="ghost-btn" onClick={onExit}>
                Quit to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {ready && (
        <p className="control-strip">
          A/D walk · W/S aim · Space hold to fire · J jump · 1-4 weapons · E end turn · P pause — or drag from the
          worm to aim and release to fire.
        </p>
      )}
    </div>
  );
}
