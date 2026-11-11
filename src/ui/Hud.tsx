import { useEffect, useRef } from 'react';
import { RETREAT_SECONDS, WEAPONS, WEAPON_ORDER, windLabel, windTier } from '../game/config';
import type { GameSnapshot, WeaponId } from '../game/types';
import { WeaponIcon } from './WeaponIcon';

interface HudProps {
  snapshot: GameSnapshot;
  paused: boolean;
  onMove: (dir: -1 | 0 | 1) => void;
  onAim: (dir: -1 | 1) => void;
  onAimStop: () => void;
  onJump: () => void;
  onRope: () => void;
  onReel: (dir: -1 | 0 | 1) => void;
  onChargeStart: () => void;
  onChargeEnd: () => void;
  onChargeCancel: () => void;
  onSelectWeapon: (weapon: WeaponId) => void;
  onEndTurn: () => void;
  onPause: () => void;
}

function useHoldRepeat(callback: () => void, active: boolean) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => saved.current(), 90);
    return () => window.clearInterval(id);
  }, [active]);
}

export function Hud({
  snapshot,
  paused,
  onMove,
  onAim,
  onAimStop,
  onJump,
  onRope,
  onReel,
  onChargeStart,
  onChargeEnd,
  onChargeCancel,
  onSelectWeapon,
  onEndTurn,
  onPause,
}: HudProps) {
  const holdAimUp = useRef(false);
  const holdAimDown = useRef(false);
  const firePointer = useRef<number | null>(null);

  const playerTurn = snapshot.activeTeam === 0 && snapshot.phase === 'aim' && !paused;
  const canSteer = snapshot.activeTeam === 0 && !paused && (snapshot.phase === 'aim' || snapshot.retreatLeft > 0);
  const ropeAttached = snapshot.ropeAttached;
  const canAim = playerTurn && !ropeAttached;
  const canReel = canSteer && ropeAttached;
  const canJump =
    snapshot.activeTeam === 0 && snapshot.phase !== 'gameover' && !paused && (snapshot.activeOnGround || ropeAttached);
  const canRope = canSteer;
  const myTeam = snapshot.teams[0];
  const enemy = snapshot.teams[1];
  const weapon = WEAPONS[snapshot.weapon];
  const ammo = myTeam?.ammo[snapshot.weapon] ?? 0;
  const timeRatio = snapshot.timeLeft / Math.max(1, snapshot.turnSeconds);
  const activeWorm = snapshot.teams[snapshot.activeTeam]?.worms.find((w) => w.active);
  const fuseLeft = snapshot.fuseLeft === null ? null : Math.max(0, snapshot.fuseLeft);
  const inFlight = snapshot.phase !== 'aim';
  const wind = windTier(snapshot.wind);
  const countdown = inFlight
    ? fuseLeft !== null
      ? fuseLeft.toFixed(1)
      : String(Math.ceil(snapshot.retreatLeft))
    : String(Math.ceil(snapshot.timeLeft));
  const countdownRatio = inFlight
    ? fuseLeft !== null
      ? Math.min(1, fuseLeft / (weapon.fuse ?? RETREAT_SECONDS))
      : Math.min(1, snapshot.retreatLeft / RETREAT_SECONDS)
    : timeRatio;
  const phaseLabel = inFlight ? (fuseLeft !== null ? 'Fuse' : 'Retreat') : activeWorm?.name ?? '';

  useHoldRepeat(() => onAim(1), canAim && holdAimUp.current);
  useHoldRepeat(() => onAim(-1), canAim && holdAimDown.current);

  // A pad held across a pause or turn handoff must not restart on the next aim phase.
  useEffect(() => {
    if (!canAim) {
      holdAimUp.current = false;
      holdAimDown.current = false;
    }
  }, [canAim]);

  const disarm = () => {
    onMove(0);
    onAimStop();
    onReel(0);
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="team-panel" data-testid="team-panel-0">
          <div className="team-head">
            <span className="team-dot" style={{ background: myTeam?.accent }} aria-hidden />
            <span className="team-name">{myTeam?.name}</span>
            <span className="team-hp" data-testid="team-0-hp">
              {myTeam?.hp}
            </span>
          </div>
          <div className="team-bar">
            <div
              className="team-bar-fill"
              style={{ width: `${((myTeam?.hp ?? 0) / (myTeam?.maxHp || 1)) * 100}%`, background: myTeam?.accent }}
            />
          </div>
          <div className="worm-pips">
            {myTeam?.worms.map((w) => (
              <span
                key={w.id}
                className={`pip ${w.alive ? '' : 'pip-dead'} ${w.active ? 'pip-active' : ''}`}
                title={`${w.name}: ${w.hp} HP`}
                style={{ borderColor: myTeam.accent, background: w.alive ? `${myTeam.accent}33` : 'transparent' }}
              >
                {w.alive ? w.name.slice(0, 1) : '×'}
              </span>
            ))}
          </div>
        </div>

        <div className="turn-block">
          <div className={`timer ${countdownRatio < 0.25 ? 'timer-low' : ''}`} data-testid="hud-timer">
            {countdown}
          </div>
          <div className="turn-meta">
            <span>Turn {snapshot.turn}</span>
            <span className="turn-worm">{phaseLabel}</span>
          </div>
          <div className="timer-bar">
            <div
              className="timer-fill"
              data-testid="hud-timer-fill"
              style={{ width: `${Math.max(0, countdownRatio) * 100}%` }}
            />
          </div>
          <div
            className={`wind-gauge wind-${wind}${snapshot.wind < 0 ? ' wind-left' : ''}`}
            data-testid="hud-wind"
            role="img"
            aria-label={`Wind: ${windLabel(snapshot.wind)}`}
            title={`Wind: ${windLabel(snapshot.wind)}`}
          >
            <svg className="wind-art" viewBox="0 0 88 25" aria-hidden="true" focusable="false">
              {wind !== 'calm' && (
                <path className="wind-ribbon wind-ribbon-back" d="M7 8 C20 3 27 13 39 8 S59 4 66 8" />
              )}
              <path className="wind-ribbon wind-ribbon-main" d="M4 15 C18 10 25 20 38 15 S58 11 69 15" />
              {(wind === 'gust' || wind === 'gale') && (
                <path className="wind-ribbon wind-ribbon-low" d="M10 21 C22 17 29 24 40 21 S56 18 63 21" />
              )}
              <path className="wind-arrow" d="M65 10 L76 15 L65 20 L68 15 Z" />
              <circle className="wind-spark" cx="14" cy="15" r="1.3" />
            </svg>
          </div>
        </div>

        <div className="enemy-block">
          <div className="team-panel team-panel-enemy" data-testid="team-panel-1">
            <div className="team-head">
              <span className="team-dot" style={{ background: enemy?.accent }} aria-hidden />
              <span className="team-name">{enemy?.name}</span>
              <span className="team-hp" data-testid="team-1-hp">
                {enemy?.hp}
              </span>
            </div>
            <div className="team-bar">
              <div
                className="team-bar-fill"
                style={{ width: `${((enemy?.hp ?? 0) / (enemy?.maxHp || 1)) * 100}%`, background: enemy?.accent }}
              />
            </div>
            <div className="worm-pips">
              {enemy?.worms.map((w) => (
                <span
                  key={w.id}
                  className={`pip ${w.alive ? '' : 'pip-dead'} ${w.active ? 'pip-active' : ''}`}
                  title={`${w.name}: ${w.hp} HP`}
                  style={{ borderColor: enemy.accent, background: w.alive ? `${enemy.accent}33` : 'transparent' }}
                >
                  {w.alive ? w.name.slice(0, 1) : '×'}
                </span>
              ))}
            </div>
          </div>
          <button className="ghost-btn pause-btn" type="button" onClick={onPause} data-testid="btn-pause">
            Pause
          </button>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="move-cluster">
          <button
            type="button"
            className="pad-btn"
            aria-label="Walk left"
            data-testid="btn-left"
            disabled={!canSteer}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onMove(-1);
            }}
            onPointerUp={disarm}
            onPointerLeave={disarm}
            onPointerCancel={disarm}
          >
            ◀
          </button>
          <div className="aim-cluster">
            <button
              type="button"
              className="pad-btn pad-btn-small"
              aria-label="Aim up"
              disabled={!canAim && !canReel}
              onPointerDown={() => {
                if (ropeAttached) {
                  onReel(-1);
                  return;
                }
                holdAimUp.current = true;
                onAim(1);
              }}
              onPointerUp={() => {
                holdAimUp.current = false;
                onReel(0);
              }}
              onPointerLeave={() => {
                holdAimUp.current = false;
                onReel(0);
              }}
              onPointerCancel={() => {
                holdAimUp.current = false;
                onReel(0);
              }}
            >
              ▲
            </button>
            <button
              type="button"
              className="pad-btn pad-btn-small"
              aria-label="Aim down"
              disabled={!canAim && !canReel}
              onPointerDown={() => {
                if (ropeAttached) {
                  onReel(1);
                  return;
                }
                holdAimDown.current = true;
                onAim(-1);
              }}
              onPointerUp={() => {
                holdAimDown.current = false;
                onReel(0);
              }}
              onPointerLeave={() => {
                holdAimDown.current = false;
                onReel(0);
              }}
              onPointerCancel={() => {
                holdAimDown.current = false;
                onReel(0);
              }}
            >
              ▼
            </button>
          </div>
          <button
            type="button"
            className="pad-btn"
            aria-label="Walk right"
            data-testid="btn-right"
            disabled={!canSteer}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onMove(1);
            }}
            onPointerUp={disarm}
            onPointerLeave={disarm}
            onPointerCancel={disarm}
          >
            ▶
          </button>
          <button
            type="button"
            className="pad-btn jump-btn"
            onClick={onJump}
            disabled={!canJump}
            data-testid="btn-jump"
          >
            {ropeAttached ? 'Let go' : 'Jump'}
          </button>
        </div>

        <div className="weapon-dock" role="group" aria-label="Weapons and rope">
          {WEAPON_ORDER.map((id) => {
            const def = WEAPONS[id];
            const count = myTeam?.ammo[id] ?? 0;
            const out = def.ammo !== null && count <= 0;
            return (
              <button
                key={id}
                type="button"
                className={`weapon-card ${snapshot.weapon === id ? 'weapon-active' : ''}`}
                onClick={() => onSelectWeapon(id)}
                disabled={!playerTurn || out || ropeAttached}
                data-testid={`weapon-${id}`}
                title={def.blurb}
              >
                <WeaponIcon id={id} />
                <span className="weapon-name">{def.name}</span>
                <span className="weapon-ammo">{def.ammo === null ? '∞' : count}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`weapon-card rope-card ${ropeAttached ? 'weapon-active' : ''}`}
            onClick={onRope}
            disabled={!canRope || snapshot.charging}
            aria-pressed={ropeAttached}
            data-testid="btn-rope"
            title="Anchor to the aimed terrain; A/D swing, W/S reel, J lets go"
          >
            <WeaponIcon id="rope" />
            <span className="weapon-name">Rope</span>
            <span className="weapon-ammo">∞</span>
          </button>
        </div>

        <div className="action-cluster">
          <div className="power-wrap">
            <div className="power-label">
              <span>{snapshot.charging ? 'CHARGING' : 'POWER'}</span>
              <span>{Math.round(snapshot.power * 100)}%</span>
            </div>
            <div className="power-track">
              <div
                className={`power-fill ${snapshot.power > 0.85 ? 'power-hot' : ''}`}
                style={{ width: `${snapshot.power * 100}%` }}
              />
            </div>
            <div className="weapon-hint">{weapon.name} · {ammo === Infinity ? '∞' : ammo} rounds</div>
          </div>
          <button
            type="button"
            className="fire-btn"
            data-testid="btn-fire"
            disabled={!playerTurn || ropeAttached}
            onPointerDown={(e) => {
              if (firePointer.current !== null) return;
              firePointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              onChargeStart();
            }}
            onPointerUp={(e) => {
              if (firePointer.current !== e.pointerId) return;
              firePointer.current = null;
              onChargeEnd();
            }}
            onPointerCancel={(e) => {
              if (firePointer.current !== e.pointerId) return;
              firePointer.current = null;
              onChargeCancel();
            }}
          >
            FIRE
            <small>{snapshot.charging ? `${Math.round(snapshot.power * 100)}%` : 'hold'}</small>
          </button>
          <button
            type="button"
            className="ghost-btn end-turn"
            onClick={onEndTurn}
            disabled={!playerTurn || snapshot.charging}
            data-testid="btn-end-turn"
          >
            End turn
          </button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {snapshot.phase === 'aim'
          ? `${snapshot.teams[snapshot.activeTeam]?.name} turn, ${snapshot.activeWormName}, ${Math.ceil(
              snapshot.timeLeft,
            )} seconds left`
          : ''}
      </div>
      {snapshot.aiThinking && <div className="ai-banner">Rustbelt is ranging the shot…</div>}
      {paused && <div className="sr-only">Game paused</div>}
    </div>
  );
}
