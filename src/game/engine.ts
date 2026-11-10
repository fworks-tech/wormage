import {
  AIM,
  BOUNCE,
  CHARGE_SECONDS,
  DIFFICULTY,
  GRAVITY,
  PROJECTILE_GRAVITY,
  RETREAT_SECONDS,
  TEAMS,
  WATER_Y,
  WEAPONS,
  WIND_ACCEL,
  WIND_FACTOR,
  WORM,
  worldClamp,
} from './config';
import { Terrain, mulberry32 } from './terrain';
import { clampAngle, mirrorAngle, planAiShot, planAiTurn } from './ai';
import type { AiTurnPlan } from './ai';
import { configKey } from './types';
import type {
  ActionLogEntry,
  EndReason,
  GameAction,
  GameEvent,
  GameSnapshot,
  MatchConfig,
  Phase,
  Projectile,
  Team,
  WeaponId,
  Worm,
} from './types';

const WORM_NAMES = [
  ['Sarge', 'Biscuit', 'Mags'],
  ['Crank', 'Nyx', 'Dust'],
];

/** Blast damage at a distance: linear falloff, floored at 22% inside the radius. */
export function blastFalloff(distance: number, radius: number): number {
  return Math.max(0.22, 1 - distance / radius);
}

export class GameEngine {
  readonly config: MatchConfig;
  readonly terrain: Terrain;
  readonly teams: Team[];
  phase: Phase = 'aim';
  turn = 1;
  /** Fixed steps taken so far. Inputs are replayed against this counter. */
  tick = 0;
  readonly log: ActionLogEntry[] = [];
  activeTeam = 0;
  activeWormId: string | null = null;
  wind = 0;
  timeLeft: number;
  power = 0;
  charging = false;
  weapon: WeaponId = 'bazooka';
  moveDir: -1 | 0 | 1 = 0;
  events: GameEvent[] = [];
  winnerTeam: number | null = null;
  endReason: EndReason | null = null;
  hasFired = false;
  kills = [0, 0];
  elapsed = 0;
  aiThinking = false;
  retreatTimer = 0;

  private projectiles: Projectile[] = [];
  private settleTimer = 0;
  private aiTimer = 0;
  private aiPlan: AiTurnPlan | null = null;
  private aiStall = 0;
  private aiLastX = -1;
  private aiJumpAttempts = 0;
  private projectileId = 0;
  private readonly rng: () => number;
  private readonly lastWormByTeam: Record<number, string> = {};

  constructor(config: MatchConfig) {
    this.config = config;
    this.terrain = new Terrain(config.seed);
    this.rng = mulberry32(config.seed ^ 0x9e3779b9);
    this.timeLeft = config.turnSeconds;

    this.teams = TEAMS.map((team, teamIndex) => {
      const worms: Worm[] = [];
      for (let i = 0; i < config.wormsPerTeam; i += 1) {
        const x = teamIndex === 0 ? 120 + i * 95 : 1160 - i * 95;
        const y = this.terrain.groundY(x, 120, WATER_Y - 120) ?? 470;
        worms.push({
          id: `t${teamIndex}-w${i}`,
          name: WORM_NAMES[teamIndex][i % WORM_NAMES[teamIndex].length],
          teamId: teamIndex,
          x,
          y,
          vy: 0,
          vx: 0,
          hp: WORM.maxHp,
          maxHp: WORM.maxHp,
          alive: true,
          facing: teamIndex === 0 ? 1 : -1,
          aimAngle: teamIndex === 0 ? -0.55 : mirrorAngle(-0.55),
          onGround: true,
          fallDistance: 0,
          airborne: false,
        });
      }
      return {
        id: teamIndex,
        name: team.name,
        color: team.color,
        accent: team.accent,
        isAi: team.isAi,
        worms,
        ammo: {
          bazooka: WEAPONS.bazooka.ammo ?? Infinity,
          grenade: WEAPONS.grenade.ammo ?? 0,
          shotgun: WEAPONS.shotgun.ammo ?? 0,
          dynamite: WEAPONS.dynamite.ammo ?? 0,
        },
      };
    });

    this.beginTurn(true);
  }

  get configurationKey(): string {
    return configKey(this.config);
  }

  get activeWorm(): Worm | null {
    const team = this.teams[this.activeTeam];
    return team.worms.find((w) => w.id === this.activeWormId) ?? null;
  }

  get activeAmmo(): Record<WeaponId, number> {
    return this.teams[this.activeTeam].ammo;
  }

  get projectilesInFlight(): readonly Projectile[] {
    return this.projectiles;
  }

  /** True while the shooter may still walk away after firing. */
  get retreatActive(): boolean {
    return this.retreatTimer > 0 && (this.phase === 'projectile' || this.phase === 'settle');
  }

  private beginTurn(first = false): void {
    const team = this.teams[this.activeTeam];
    const next = this.nextAliveWorm(team);
    if (!next) {
      this.finish(this.otherTeam(this.activeTeam), 'wipeout');
      return;
    }
    this.activeWormId = next.id;
    this.lastWormByTeam[team.id] = next.id;
    this.timeLeft = this.config.turnSeconds;
    this.phase = 'aim';
    this.power = 0;
    this.charging = false;
    this.weapon = 'bazooka';
    this.moveDir = 0;
    this.hasFired = false;
    this.settleTimer = 0;
    this.retreatTimer = 0;
    this.aiTimer = 0.9;
    this.aiPlan = null;
    this.aiStall = 0;
    this.aiLastX = -1;
    this.aiJumpAttempts = 0;
    this.aiThinking = team.isAi;
    const maxWind = WIND_ACCEL[this.config.wind];
    this.wind = first ? 0 : Math.round((this.rng() * 2 - 1) * maxWind);
    this.events.push({ type: 'turn', teamId: team.id, wormId: next.id });
  }

  private nextAliveWorm(team: Team): Worm | null {
    const currentIndex = team.worms.findIndex((w) => w.id === this.lastWormByTeam[team.id]);
    for (let i = 1; i <= team.worms.length; i += 1) {
      const candidate = team.worms[(currentIndex + i + team.worms.length) % team.worms.length];
      if (candidate.alive) return candidate;
    }
    return null;
  }

  private otherTeam(teamId: number): number {
    return teamId === 0 ? 1 : 0;
  }

  setMove(dir: -1 | 0 | 1): void {
    this.moveDir = dir;
  }

  aimBy(delta: number): void {
    const worm = this.activeWorm;
    if (!worm || this.phase !== 'aim') return;
    worm.aimAngle = clampAngle(worm.aimAngle + delta);
    worm.facing = Math.cos(worm.aimAngle) >= 0 ? 1 : -1;
  }

  /** Apply an input and keep it in the log for replay. */
  record(action: GameAction): void {
    this.log.push({ tick: this.tick, action });
    this.applyAction(action);
  }

  /** Same path as `record`, without logging. A replay drives the engine through here. */
  applyAction(action: GameAction): void {
    switch (action.type) {
      case 'move':
        this.setMove(action.dir);
        break;
      case 'aim':
        this.aimBy(action.delta);
        break;
      case 'jump':
        this.jump(action.dir);
        break;
      case 'weapon':
        this.selectWeapon(action.id);
        break;
      case 'startCharge':
        this.startCharge();
        break;
      case 'releaseCharge':
        this.releaseCharge();
        break;
      case 'fire':
        this.fire();
        break;
      case 'endTurn':
        this.endTurn();
        break;
    }
  }

  setAimFromPoint(x: number, y: number): void {
    const worm = this.activeWorm;
    if (!worm || this.phase !== 'aim') return;
    const angle = Math.atan2(y - (worm.y - 14), x - worm.x);
    worm.aimAngle = clampAngle(angle);
    worm.facing = Math.cos(worm.aimAngle) >= 0 ? 1 : -1;
  }

  startCharge(): void {
    if (this.phase !== 'aim' || this.teams[this.activeTeam].isAi || this.hasFired) return;
    this.charging = true;
    this.power = Math.max(this.power, 0);
  }

  releaseCharge(): void {
    if (!this.charging) return;
    this.charging = false;
    this.fire();
  }

  cancelCharge(): void {
    this.charging = false;
    this.power = 0;
  }

  selectWeapon(id: WeaponId): void {
    if (this.phase !== 'aim') return;
    const ammo = this.teams[this.activeTeam].ammo[id];
    if (WEAPONS[id].ammo !== null && ammo <= 0) return;
    this.weapon = id;
  }

  jump(dir: -1 | 0 | 1 = this.moveDir): void {
    const worm = this.activeWorm;
    if (!worm || !worm.alive || this.phase === 'gameover') return;
    // Airborne jumps are flips: reset the rise, keep momentum on a neutral flip.
    if (worm.onGround || dir !== 0) worm.vx = dir * WORM.jumpPush;
    worm.vy = -WORM.jumpVelocity;
    if (dir !== 0 && worm.facing !== dir) {
      worm.facing = dir;
      worm.aimAngle = mirrorAngle(worm.aimAngle);
    }
    worm.onGround = false;
    worm.fallDistance = 0;
    worm.airborne = true;
    this.events.push({ type: 'jump', x: worm.x, y: worm.y });
  }

  fire(): void {
    const worm = this.activeWorm;
    if (!worm || this.phase !== 'aim' || this.hasFired) return;
    const team = this.teams[this.activeTeam];
    const weapon = WEAPONS[this.weapon];
    if (weapon.ammo !== null && team.ammo[this.weapon] <= 0) return;

    const power = Math.max(0.12, this.power);
    const angle = worm.aimAngle;
    const speed = weapon.speedMin + (weapon.speedMax - weapon.speedMin) * power;

    if (weapon.ammo !== null) team.ammo[this.weapon] -= 1;
    this.hasFired = true;
    this.charging = false;
    this.phase = 'projectile';
    this.retreatTimer = RETREAT_SECONDS;

    if (weapon.kind === 'drop') {
      this.projectiles.push({
        id: (this.projectileId += 1),
        weapon: this.weapon,
        teamId: team.id,
        x: worm.x,
        y: worm.y - 8,
        vx: 0,
        vy: 0,
        age: 0,
        fuse: weapon.fuse,
        trailTimer: 0,
      });
    } else {
      const muzzleX = worm.x + Math.cos(angle) * 18;
      const muzzleY = worm.y - 14 + Math.sin(angle) * 18;
      this.projectiles.push({
        id: (this.projectileId += 1),
        weapon: this.weapon,
        teamId: team.id,
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        fuse: weapon.fuse,
        trailTimer: 0,
      });
      this.events.push({ type: 'fire', x: muzzleX, y: muzzleY, angle, weapon: this.weapon });
      if (this.weapon === 'shotgun') {
        this.events.push({ type: 'shotgun', x: muzzleX, y: muzzleY, angle });
      }
    }
  }

  endTurn(): void {
    if (this.phase !== 'aim' || this.charging) return;
    this.finishTurn();
  }

  surrender(): void {
    if (this.phase === 'gameover') return;
    this.finish(this.otherTeam(this.activeTeam), 'surrender');
  }

  private finishTurn(): void {
    if (this.phase === 'gameover') return;
    this.moveDir = 0;
    this.charging = false;
    this.aiThinking = false;
    this.retreatTimer = 0;
    this.projectiles = [];
    this.activeTeam = this.otherTeam(this.activeTeam);
    this.turn += 1;
    this.beginTurn();
  }

  private finish(winner: number | null, reason: EndReason): void {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    this.winnerTeam = winner;
    this.endReason = reason;
    this.charging = false;
    this.moveDir = 0;
    this.projectiles = [];
    this.events.push({ type: 'gameover', winnerTeamId: winner });
  }

  private hurt(worm: Worm, amount: number, sourceX: number, sourceY: number, sourceTeam: number | null): void {
    if (!worm.alive || amount <= 0) return;
    worm.hp = Math.max(0, worm.hp - amount);
    this.events.push({ type: 'hurt', x: worm.x, y: worm.y - 26, amount: Math.round(amount) });
    const dx = worm.x - sourceX;
    worm.x = worldClamp(worm.x + Math.sign(dx) * Math.min(14, amount * 0.18), 12, 1268);
    worm.vy = Math.min(worm.vy, -Math.min(260, amount * 2.2));
    worm.onGround = false;
    worm.airborne = true;
    worm.fallDistance = 0;
    if (worm.hp <= 0) {
      worm.alive = false;
      this.events.push({ type: 'death', x: worm.x, y: worm.y, color: this.teams[worm.teamId].color });
      if (sourceTeam !== null && sourceTeam !== worm.teamId) this.kills[sourceTeam] += 1;
      this.checkWipeout();
    }
  }

  private checkWipeout(): void {
    for (const team of this.teams) {
      if (!team.worms.some((w) => w.alive)) {
        this.finish(this.otherTeam(team.id), 'wipeout');
        return;
      }
    }
  }

  private explode(x: number, y: number, weapon: WeaponId, sourceTeam: number | null): void {
    const def = WEAPONS[weapon];
    this.terrain.carve(x, y, def.terrainRadius);
    this.events.push({ type: 'explosion', x, y, radius: def.radius });
    for (const team of this.teams) {
      for (const worm of team.worms) {
        if (!worm.alive) continue;
        const dx = worm.x - x;
        const dy = worm.y - 13 - y;
        const distance = Math.hypot(dx, dy);
        if (distance > def.radius + WORM.radius) continue;
        this.hurt(worm, def.damage * blastFalloff(distance, def.radius + WORM.radius), x, y, sourceTeam);
      }
    }
  }

  private stepWorm(worm: Worm, dt: number): void {
    if (!worm.alive) return;
    const isActive = worm.id === this.activeWormId;
    const canWalk =
      isActive &&
      worm.onGround &&
      (this.phase === 'aim' || this.retreatActive) &&
      this.moveDir !== 0 &&
      !this.charging;

    if (canWalk) {
      const dir = this.moveDir;
      worm.vx = 0;
      const nx = worldClamp(worm.x + dir * WORM.walkSpeed * dt, 12, 1268);
      const bodyBlocked = this.terrain.isSolid(nx, worm.y - 12);
      const ahead = this.terrain.groundY(nx, worm.y - 18, 42);
      const slope = ahead === null ? null : ahead - worm.y;
      if (!bodyBlocked && (slope === null || slope <= 14)) {
        worm.x = nx;
        if (worm.facing !== dir) {
          worm.facing = dir as 1 | -1;
          worm.aimAngle = mirrorAngle(worm.aimAngle);
        }
        if (ahead !== null) {
          worm.y = ahead;
          worm.vy = 0;
          worm.onGround = true;
          worm.airborne = false;
          worm.fallDistance = 0;
        } else {
          worm.onGround = false;
        }
      }
    }

    if (!worm.onGround) {
      worm.vy += GRAVITY * dt;
      const dy = worm.vy * dt;
      const dx = worm.vx * dt;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dy), Math.abs(dx)) / 5));
      for (let i = 0; i < steps; i += 1) {
        if (worm.vx !== 0) {
          const nextX = worldClamp(worm.x + dx / steps, 12, 1268);
          if (nextX === 12 || nextX === 1268 || this.terrain.isSolid(nextX, worm.y - 12)) {
            worm.vx = 0;
          } else {
            worm.x = nextX;
          }
        }
        const nextY = worm.y + dy / steps;
        const hit = this.terrain.isSolid(worm.x, nextY);
        if (hit) {
          const landing = this.terrain.groundY(worm.x, nextY - Math.abs(dy / steps) - 6, 18);
          worm.y = landing ?? Math.floor(nextY / 4) * 4;
          worm.vy = 0;
          worm.vx = 0;
          worm.onGround = true;
          worm.airborne = false;
          this.applyFallDamage(worm);
          break;
        }
        const stepDelta = dy / steps;
        worm.y = nextY;
        // Unlimited flips must not carry the worm out of the top of the world.
        if (worm.y < 0) {
          worm.y = 0;
          worm.vy = 0;
        }
        if (stepDelta > 0) worm.fallDistance += stepDelta;
        if (worm.y > WATER_Y) {
          worm.y = WATER_Y;
          worm.hp = 0;
          worm.alive = false;
          this.events.push({ type: 'splash', x: worm.x, y: WATER_Y });
          this.checkWipeout();
          return;
        }
      }
    } else {
      const ground = this.terrain.groundY(worm.x, worm.y - 6, 24);
      if (ground === null) {
        worm.onGround = false;
        worm.vy = 0;
        worm.vx = 0;
        worm.fallDistance = 0;
      } else {
        worm.y = ground;
      }
    }
  }

  private applyFallDamage(worm: Worm): void {
    const drop = worm.fallDistance;
    worm.fallDistance = 0;
    if (drop > WORM.fallSafePx) {
      const amount = (drop - WORM.fallSafePx) * WORM.fallDamagePerPx;
      if (amount < 1) return;
      worm.hp = Math.max(0, worm.hp - amount);
      this.events.push({ type: 'hurt', x: worm.x, y: worm.y - 26, amount: Math.round(amount) });
      if (worm.hp <= 0 && worm.alive) {
        worm.alive = false;
        this.events.push({ type: 'death', x: worm.x, y: worm.y, color: this.teams[worm.teamId].color });
        this.checkWipeout();
      }
    }
  }

  private chunksFor(speed: number): number {
    return Math.max(1, Math.ceil((speed * (1 / 60)) / 5));
  }

  private stepProjectiles(dt: number): void {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      const def = WEAPONS[p.weapon];
      const drops = def.kind === 'drop';
      p.age += dt;
      p.trailTimer += dt;

      if (p.fuse !== null && p.age >= p.fuse) {
        this.explode(p.x, p.y, p.weapon, p.teamId);
        continue;
      }

      p.vy += PROJECTILE_GRAVITY * def.gravityScale * dt;
      p.vx += this.wind * def.windScale * WIND_FACTOR * dt;

      const speed = Math.hypot(p.vx, p.vy);
      const steps = this.chunksFor(speed);
      const sdt = dt / steps;
      let consumed = false;

      for (let i = 0; i < steps; i += 1) {
        const nx = p.x + p.vx * sdt;
        const ny = p.y + p.vy * sdt;

        const victim = drops
          ? undefined
          : this.teams
              .flatMap((team) => team.worms)
              .find(
                (w) =>
                  w.alive &&
                  !(w.id === this.activeWormId && p.age < 0.14) &&
                  Math.hypot(w.x - nx, w.y - 13 - ny) < 14 + WORM.radius * 0.4,
              );
        if (victim) {
          if (p.weapon === 'shotgun') {
            this.hurt(victim, def.damage, p.x, p.y, p.teamId);
            this.events.push({ type: 'impact', x: nx, y: ny });
            consumed = true;
            break;
          }
          this.explode(nx, ny, p.weapon, p.teamId);
          consumed = true;
          break;
        }

        if (this.terrain.isSolid(nx, ny)) {
          if (drops) {
            // A thrown charge rests where it lands; only the fuse sets it off.
            p.vx = 0;
            p.vy = 0;
            break;
          }
          if (def.bounces) {
            const hitX = this.terrain.isSolid(nx, p.y);
            const hitY = this.terrain.isSolid(p.x, ny);
            if (hitX) p.vx = -p.vx * BOUNCE.x;
            if (hitY) p.vy = -p.vy * BOUNCE.y;
            if (!hitX && !hitY) {
              p.vx = -p.vx * BOUNCE.x;
              p.vy = -p.vy * BOUNCE.y;
            }
            p.x += p.vx * sdt;
            p.y += p.vy * sdt;
            if (p.age > 0.1) this.events.push({ type: 'bounce', x: p.x, y: p.y });
          } else {
            this.explode(nx, ny, p.weapon, p.teamId);
            consumed = true;
            break;
          }
        }

        p.x = nx;
        p.y = ny;

        if (p.x < -60 || p.x > 1340 || p.y > WATER_Y) {
          this.events.push({ type: 'splash', x: Math.max(0, Math.min(1280, p.x)), y: WATER_Y });
          consumed = true;
          break;
        }
        if (p.y > 760) {
          consumed = true;
          break;
        }
        const life = def.life;
        if (life !== null && p.age >= life) {
          consumed = true;
          break;
        }
      }

      if (!consumed) survivors.push(p);
    }
    // finish() clears the list when an explosion ends the match mid-step.
    this.projectiles = this.phase === 'gameover' ? [] : survivors;
  }

  private nearestEnemy(worm: Worm): Worm | null {
    const targets = this.teams[this.otherTeam(worm.teamId)].worms.filter((w) => w.alive);
    return (
      targets.sort(
        (a, b) => Math.hypot(a.x - worm.x, a.y - worm.y) - Math.hypot(b.x - worm.x, b.y - worm.y),
      )[0] ?? null
    );
  }

  private aimAt(angle: number, power: number): void {
    const worm = this.activeWorm;
    if (!worm) return;
    worm.aimAngle = clampAngle(angle);
    worm.facing = Math.cos(worm.aimAngle) >= 0 ? 1 : -1;
    this.power = power;
  }

  /**
   * The AI walks to its firing spot, fires the planned weapon, then keeps
   * walking to its retreat spot while the post-fire window is open.
   */
  private updateAi(dt: number): void {
    const worm = this.activeWorm;
    if (!worm) return;

    if (this.retreatActive) {
      const dx = this.aiPlan ? this.aiPlan.retreatX - worm.x : 0;
      this.moveDir = Math.abs(dx) <= 6 ? 0 : dx > 0 ? 1 : -1;
      return;
    }

    if (this.phase !== 'aim' || this.hasFired) return;

    if (!this.aiPlan) {
      this.aiTimer -= dt;
      if (this.aiTimer > 0) return;

      const worms = this.teams.flatMap((team) =>
        team.worms.filter((w) => w.alive).map((w) => ({ id: w.id, teamId: w.teamId, x: w.x, y: w.y })),
      );
      this.aiPlan = planAiTurn({
        terrain: this.terrain,
        worm: { id: worm.id, teamId: worm.teamId, x: worm.x, y: worm.y },
        worms,
        ammo: { ...this.teams[this.activeTeam].ammo },
        wind: this.wind,
        timeLeft: this.timeLeft,
        difficulty: DIFFICULTY[this.config.difficulty],
        rng: this.rng,
      });
      this.aiLastX = worm.x;
      this.aiStall = 0;

      if (!this.aiPlan) {
        this.aiThinking = false;
        this.finishTurn();
        return;
      }
    }

    const plan = this.aiPlan;
    const distance = plan.fireX - worm.x;
    if (Math.abs(distance) > 6) {
      this.moveDir = distance > 0 ? 1 : -1;
      if (Math.abs(worm.x - this.aiLastX) < 0.5) this.aiStall += dt;
      else {
        this.aiStall = 0;
        this.aiLastX = worm.x;
      }
      // Blocked or out of turn time: take the best bazooka shot from here.
      if (this.aiStall < 1.5 && this.timeLeft > 0.5) return;

      // Two blocked-walk jumps per AI turn, then fall back to a shot so it can act.
      if (this.aiStall >= 1.5 && this.aiJumpAttempts < 2 && worm.onGround) {
        this.aiJumpAttempts += 1;
        this.jump(this.moveDir);
        this.aiStall = 0;
        this.aiLastX = worm.x;
        return;
      }

      this.moveDir = 0;
      const target = this.nearestEnemy(worm);
      if (target) {
        const bodies = this.teams.flatMap((team) =>
          team.worms.filter((w) => w.alive && w.id !== worm.id).map((w) => ({ x: w.x, y: w.y })),
        );
        const shot = planAiShot(
          this.terrain,
          worm.x,
          worm.y,
          target.x,
          target.y - 10,
          this.wind,
          DIFFICULTY[this.config.difficulty],
          this.rng,
          bodies,
        );
        this.weapon = 'bazooka';
        this.aimAt(shot.angle, shot.power);
      }
      this.aiThinking = false;
      this.fire();
      return;
    }

    this.moveDir = 0;
    this.weapon = plan.weapon;
    this.aimAt(plan.angle, plan.power);
    this.aiThinking = false;
    this.fire();
  }

  update(dt: number): void {
    if (this.phase === 'gameover') return;
    this.tick += 1;
    this.elapsed += dt;

    if (this.charging) {
      this.power = Math.min(1, this.power + dt / CHARGE_SECONDS);
    }

    if (this.retreatActive) {
      this.retreatTimer = Math.max(0, this.retreatTimer - dt);
      if (this.retreatTimer === 0) this.moveDir = 0;
    }

    if (this.teams[this.activeTeam].isAi) this.updateAi(dt);

    for (const t of this.teams) for (const w of t.worms) this.stepWorm(w, dt);

    if (this.phase === 'projectile') {
      this.stepProjectiles(dt);
      // stepProjectiles can finish the match; do not overwrite gameover with settle.
      if (this.projectiles.length === 0 && this.phase === 'projectile') {
        this.phase = 'settle';
        this.settleTimer = 0.85;
      }
    } else if (this.phase === 'settle') {
      this.settleTimer -= dt;
      if (this.settleTimer <= 0 && this.retreatTimer <= 0) this.finishTurn();
    } else if (this.phase === 'aim') {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) this.finishTurn();
    }
  }

  snapshot(): GameSnapshot {
    const active = this.activeWorm;
    const teams = this.teams.map((team) => {
      const hp = team.worms.reduce((sum, w) => sum + (w.alive ? w.hp : 0), 0);
      return {
        id: team.id,
        name: team.name,
        accent: team.accent,
        isAi: team.isAi,
        hp: Math.round(hp),
        maxHp: team.worms.length * WORM.maxHp,
        ammo: { ...team.ammo },
        worms: team.worms.map((w) => ({
          id: w.id,
          name: w.name,
          hp: Math.round(w.hp),
          maxHp: w.maxHp,
          alive: w.alive,
          active: w.id === this.activeWormId,
          x: w.x,
          y: w.y,
        })),
      };
    });
    return {
      phase: this.phase,
      turn: this.turn,
      timeLeft: this.timeLeft,
      turnSeconds: this.config.turnSeconds,
      wind: this.wind,
      windLabel: '',
      activeTeam: this.activeTeam,
      activeWormId: this.activeWormId,
      activeWormName: active?.name ?? '',
      aimAngle: active?.aimAngle ?? 0,
      power: this.power,
      charging: this.charging,
      weapon: this.weapon,
      teams,
      winnerTeam: this.winnerTeam,
      aiThinking: this.aiThinking,
      retreatLeft: this.retreatActive ? this.retreatTimer : 0,
      activeOnGround: active?.onGround ?? true,
      fuseLeft: this.projectiles.reduce<number | null>((soonest, p) => {
        if (p.fuse === null) return soonest;
        const left = Math.max(0, p.fuse - p.age);
        return soonest === null ? left : Math.min(soonest, left);
      }, null),
    };
  }

  scoreFor(teamId: number): number {
    const team = this.teams[teamId];
    const survivors = team.worms.reduce((sum, w) => sum + (w.alive ? w.hp : 0), 0);
    const bonus = this.winnerTeam === teamId ? 150 : 0;
    const timeBonus = this.winnerTeam === teamId ? Math.max(0, Math.round(420 - this.elapsed)) : 0;
    return Math.round(this.kills[teamId] * 100 + survivors + bonus + timeBonus);
  }
}
