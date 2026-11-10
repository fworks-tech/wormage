import { useEffect, useRef } from 'react';
import { RETREAT_SECONDS, WEAPONS, WEAPON_ORDER, windLabel } from '../game/config';
import type { GameSnapshot, WeaponId } from '../game/types';

interface HudProps {
  snapshot: GameSnapshot;
  paused: boolean;
  onMove: (dir: -1 | 0 | 1) => void;
  onAim: (dir: -1 | 1) => void;
  onAimStop: () => void;
  onJump: () => void;
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
  const canAim = snapshot.activeTeam === 0 && snapshot.phase === 'aim' && !paused;
  const canJump = snapshot.activeTeam === 0 && snapshot.phase !== 'gameover' && !paused;
  const myTeam = snapshot.teams[0];
  const enemy = snapshot.teams[1];
  const weapon = WEAPONS[snapshot.weapon];
  const ammo = myTeam?.ammo[snapshot.weapon] ?? 0;
  const timeRatio = snapshot.timeLeft / Math.max(1, snapshot.turnSeconds);
  const activeWorm = snapshot.teams[snapshot.activeTeam]?.worms.find((w) => w.active);
  const fuseLeft = snapshot.fuseLeft === null ? null : Math.max(0, snapshot.fuseLeft);
  const inFlight = snapshot.phase !== 'aim';
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

  const disarm = () => {
    onMove(0);
    onAimStop();
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
          <div className="wind" data-testid="hud-wind" title="Wind pushes projectiles sideways">
            <span className="wind-label">WIND</span>
            <span className={`wind-arrow ${snapshot.wind < 0 ? 'flip' : ''}`}>
              {snapshot.wind >= 0 ? '➜' : '➜'}
            </span>
            <span className="wind-value">{windLabel(snapshot.wind)}</span>
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
              disabled={!playerTurn}
              onPointerDown={() => {
                holdAimUp.current = true;
                onAim(1);
              }}
              onPointerUp={() => {
                holdAimUp.current = false;
              }}
              onPointerLeave={() => {
                holdAimUp.current = false;
              }}
              onPointerCancel={() => {
                holdAimUp.current = false;
              }}
            >
              ▲
            </button>
            <button
              type="button"
              className="pad-btn pad-btn-small"
              aria-label="Aim down"
              disabled={!playerTurn}
              onPointerDown={() => {
                holdAimDown.current = true;
                onAim(-1);
              }}
              onPointerUp={() => {
                holdAimDown.current = false;
              }}
              onPointerLeave={() => {
                holdAimDown.current = false;
              }}
              onPointerCancel={() => {
                holdAimDown.current = false;
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
            {snapshot.activeOnGround ? 'Jump' : 'Flip'}
          </button>
        </div>

        <div className="weapon-dock" role="group" aria-label="Weapons">
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
                disabled={!playerTurn || out}
                data-testid={`weapon-${id}`}
                title={def.blurb}
              >
                <span className="weapon-glyph">{def.glyph}</span>
                <span className="weapon-name">{def.name}</span>
                <span className="weapon-ammo">{def.ammo === null ? '∞' : count}</span>
              </button>
            );
          })}
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
            disabled={!playerTurn}
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
