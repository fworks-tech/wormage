import { Application, Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { AIM, WATER_Y, WEAPONS, WORM, WORLD_H, WORLD_W, windLabel } from './config';
import { aimPoint } from './aim';
import type { GameEngine } from './engine';
import type { GameEvent, GameSnapshot, WeaponId, Worm } from './types';
import { previewFlight } from './ai';
import { TerrainPainter } from './terrain-painter';
import { paintSky } from './sky';

const FONT_DISPLAY = 'Anton, Impact, sans-serif';
const FONT_BODY = '"Space Grotesk", system-ui, sans-serif';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  shape: 'circle' | 'ring';
  growth: number;
}

interface FloatText {
  view: Text;
  vy: number;
  life: number;
}

/** Per-weapon trail look; indexed by `Projectile.weapon`. */
const PROJECTILE_TRAILS: Record<WeaponId, { color: number; size: number; life: number }> = {
  bazooka: { color: 0xffa34d, size: 2.8, life: 0.42 },
  grenade: { color: 0xb8d77e, size: 1.9, life: 0.32 },
  shotgun: { color: 0xf2d8b4, size: 1.2, life: 0.12 },
  dynamite: { color: 0xff6b5b, size: 2.2, life: 0.38 },
};

class WormView {
  readonly root = new Container();
  private readonly body = new Graphics();
  private readonly heldWeapon = new Graphics();
  private readonly bar = new Graphics();
  private readonly marker = new Graphics();
  private readonly label: Text;
  private readonly hpText: Text;
  private lastFacing = 1;
  private lastWeapon: WeaponId | null = null;
  private lastHp = -1;
  private lastActive = false;
  private bob = Math.random() * Math.PI * 2;

  constructor(worm: Worm, color: number, name: string) {
    this.body.pivot.set(0, -15);
    this.body.position.set(0, -15);
    this.root.addChild(this.body);
    this.root.addChild(this.heldWeapon);
    this.root.addChild(this.bar);
    this.root.addChild(this.marker);
    this.label = new Text({
      text: name,
      style: {
        fontFamily: FONT_BODY,
        fontSize: 11,
        fontWeight: '600',
        fill: 0xf4ead7,
        stroke: { color: 0x0d1114, width: 3 },
      },
    });
    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -46);
    this.root.addChild(this.label);

    this.hpText = new Text({
      text: '',
      style: { fontFamily: FONT_BODY, fontSize: 9, fontWeight: '700', fill: 0xf4ead7 },
    });
    this.hpText.anchor.set(0.5, 0);
    this.hpText.position.set(0, -43);
    this.root.addChild(this.hpText);

    this.drawWorm(color, 1);
  }

  private drawWorm(color: number, facing: number): void {
    const g = this.body;
    g.clear();
    // Ground shadow keeps the silhouette readable over both grass and dirt.
    g.ellipse(0, 1, 13, 4).fill({ color: 0x000000, alpha: 0.3 });
    // Rounded silhouette with a soft highlight for a more sculpted, toy-like read.
    g.roundRect(-11, -30, 22, 31, 10).fill(color);
    g.stroke({ width: 2, color: 0x15201f, alpha: 0.85 });
    g.ellipse(-3.5, -27, 4.8, 1.6).fill({ color: 0xffffff, alpha: 0.28 });
    g.ellipse(0, -11, 7.5, 9).fill({ color: 0xffe9c9, alpha: 0.3 });
    // A team-colored belt makes identity survive even when team colors are similar.
    g.roundRect(-10.5, -15, 21, 4, 2).fill({ color, alpha: 0.92 });
    g.rect(-11.5, -29, 23, 5).fill({ color: 0x101a1c, alpha: 0.55 });
    g.roundRect(-2.5, -15, 5, 4, 1.5).fill({ color: 0xf4ead7, alpha: 0.85 });
    // Expressive eyes with small catchlights make the face readable at gameplay scale.
    g.circle(-4.4, -21, 4.4).fill(0xfdf6e6);
    g.circle(4.4, -21, 4.4).fill(0xfdf6e6);
    g.circle(-4.4 + facing * 1.5, -21, 2).fill(0x12181a);
    g.circle(4.4 + facing * 1.5, -21, 2).fill(0x12181a);
    g.circle(-5.1 + facing * 1.5, -22, 0.75).fill(0xffffff);
    g.circle(3.7 + facing * 1.5, -22, 0.75).fill(0xffffff);
    g.moveTo(-2.5, -14).lineTo(0, -13).lineTo(2.5, -14).stroke({ width: 1.2, color: 0x35231d, alpha: 0.8 });
    // Brow angle tracks facing to give the active worm a little attitude.
    g.moveTo(-7.5, -26.5).lineTo(-2.5, -25).stroke({ width: 1.4, color: 0x12181a, alpha: 0.8 });
    g.moveTo(7.5, -26.5).lineTo(2.5, -25).stroke({ width: 1.4, color: 0x12181a, alpha: 0.8 });
    this.lastFacing = facing;
  }

  sync(worm: Worm, color: number, active: boolean, canAct: boolean, dt: number, weapon: WeaponId): void {
    this.root.position.set(worm.x, worm.y);
    this.heldWeapon.position.set(0, -16);
    this.heldWeapon.rotation = worm.aimAngle;
    if (weapon !== this.lastWeapon) this.drawHeldWeapon(weapon);
    this.bob += dt * 4;
    if (worm.facing !== this.lastFacing) this.drawWorm(color, worm.facing);
    this.root.alpha = worm.alive ? 1 : 0;
    this.root.visible = worm.alive;
    this.heldWeapon.visible = worm.alive && !worm.rope;

    this.label.visible = worm.alive;
    this.hpText.visible = worm.alive;
    this.bar.visible = worm.alive;
    this.marker.visible = worm.alive && active;

    if (worm.hp !== this.lastHp || active !== this.lastActive) {
      this.lastHp = worm.hp;
      this.lastActive = active;
      this.bar.clear();
      this.bar.roundRect(-18, -38, 36, 4, 2).fill({ color: 0x0a0f10, alpha: 0.7 });
      const ratio = Math.max(0, worm.hp / worm.maxHp);
      const color = ratio > 0.55 ? 0x9ee37d : ratio > 0.25 ? 0xffcf5c : 0xff6b5b;
      this.bar.roundRect(-17, -37, 34 * ratio, 2, 1).fill(color);
      this.hpText.text = `${Math.ceil(worm.hp)}`;
      this.hpText.style.fill = ratio > 0.25 ? 0xf4ead7 : 0xff9a8f;
    }

    this.marker.clear();
    if (active) {
      const y = -58 + Math.sin(this.bob) * 3;
      this.marker.moveTo(-6, y).lineTo(6, y).lineTo(0, y + 8).closePath().fill(0xffe08a);
      this.marker.stroke({ width: 1.5, color: 0x1a1410, alpha: 0.8 });
    }

    if (canAct) {
      this.root.scale.set(1 + Math.sin(this.bob * 1.4) * 0.01, 1 + Math.cos(this.bob * 1.4) * 0.01);
    } else {
      this.root.scale.set(1);
    }
  }

  private drawHeldWeapon(weapon: WeaponId): void {
    const g = this.heldWeapon;
    g.clear();
    // All sprites point along +X; the Graphics container follows the worm's aim angle.
    switch (weapon) {
      case 'bazooka':
        g.roundRect(2, -3.5, 18, 7, 2.2).fill(0x4b5b50);
        g.stroke({ width: 1.2, color: 0x101815, alpha: 0.95 });
        g.roundRect(5, -2.4, 12, 1.5, 0.7).fill({ color: 0xa9b99a, alpha: 0.8 });
        g.roundRect(17, -4.5, 3.5, 9, 1).fill(0xd9caa7);
        g.roundRect(19.5, -3.2, 2.5, 6.4, 1).fill(0x25312c);
        g.roundRect(7, 2.5, 3.5, 5, 1).fill(0x283630);
        g.circle(21, 0, 1.4).fill(0xffc46c);
        break;
      case 'shotgun':
        g.roundRect(1, -3, 7, 6, 1.5).fill(0x805633);
        g.roundRect(6, -4.2, 14, 2.4, 1).fill(0x394844);
        g.roundRect(6, 1.8, 14, 2.4, 1).fill(0x394844);
        g.roundRect(17, -4.6, 3, 9.2, 1).fill(0xd4b777);
        g.roundRect(7, 2, 3, 4.5, 1).fill(0x503b28);
        g.circle(20, -3, 0.8).fill(0xffe4ac);
        g.circle(20, 3, 0.8).fill(0xffe4ac);
        break;
      case 'grenade':
        g.roundRect(1, -2.5, 6, 5, 2).fill(0xd7b48a);
        g.circle(12, 0, 5).fill(0x6f8a52);
        g.stroke({ width: 1.2, color: 0x192117 });
        g.moveTo(8, -2).lineTo(16, -2).stroke({ width: 1, color: 0xaec884, alpha: 0.8 });
        g.moveTo(8, 2).lineTo(16, 2).stroke({ width: 1, color: 0xaec884, alpha: 0.8 });
        g.rect(10.5, -7, 3, 2.5).fill(0xc9b183);
        g.moveTo(13, -6).lineTo(16, -7).stroke({ width: 1.1, color: 0xffd166 });
        break;
      case 'dynamite':
        g.roundRect(3, -4, 6, 9, 2).fill(0xa94c34);
        g.roundRect(9, -5, 6, 10, 2).fill(0xcf6a49);
        g.roundRect(15, -4, 5, 9, 2).fill(0xb4553a);
        g.roundRect(2, -1.4, 18, 2.8, 1).fill(0xd9c9a8);
        g.moveTo(12, -5).lineTo(13, -8).lineTo(15, -9).stroke({ width: 1.2, color: 0xe8ad68 });
        g.circle(15, -9, 1.6).fill({ color: 0xffd166, alpha: 0.95 });
        break;
      default:
        // A new WeaponId must be drawn here, not silently become dynamite.
        weapon satisfies never;
    }
    this.lastWeapon = weapon;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

export class ArenaRenderer {
  readonly app: Application;
  private readonly engine: GameEngine;
  private readonly root = new Container();
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly wormLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly aimLayer = new Container();
  private readonly overlay = new Container();

  readonly terrainPainter: TerrainPainter;
  private readonly terrainSprite: Sprite;
  private readonly water = new Graphics();
  private readonly aim = new Graphics();
  private readonly rope = new Graphics();
  private readonly fx = new Graphics();
  private readonly clouds: Container[] = [];
  private readonly wormViews = new Map<string, WormView>();
  private readonly particles: Particle[] = [];
  private readonly texts: FloatText[] = [];
  private projectileGfx = new Map<number, Graphics>();

  private time = 0;
  private shake = 0;
  private baseScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private lastSnapshot: GameSnapshot | null = null;

  private constructor(app: Application, engine: GameEngine) {
    this.app = app;
    this.engine = engine;

    app.stage.addChild(this.root);
    this.root.addChild(this.world);
    this.world.addChild(this.terrainLayer, this.projectileLayer, this.wormLayer, this.fxLayer, this.aimLayer);
    this.root.addChild(this.overlay);

    const sky = this.buildSky();
    this.terrainLayer.addChild(sky);
    this.terrainLayer.addChild(this.water);

    this.terrainPainter = new TerrainPainter(engine.terrain);
    this.terrainSprite = new Sprite(Texture.from(this.terrainPainter.canvas));
    this.terrainLayer.addChild(this.terrainSprite);
    engine.terrain.onCarve = (x, y, radius) => {
      this.terrainPainter.carve(x, y, radius);
      this.terrainSprite.texture.source.update();
    };

    this.fxLayer.addChild(this.fx);
    this.aimLayer.addChild(this.aim);
    this.aimLayer.addChild(this.rope);

    for (const team of engine.teams) {
      for (const worm of team.worms) {
        const view = new WormView(worm, team.color, worm.name);
        this.wormViews.set(worm.id, view);
        this.wormLayer.addChild(view.root);
      }
    }

    this.buildVignette();
    this.resize();
    app.renderer.on('resize', () => this.resize());
  }

  static async create(host: HTMLElement, engine: GameEngine): Promise<ArenaRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: 'webgl',
    });
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.touchAction = 'none';
    return new ArenaRenderer(app, engine);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  private buildSky(): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_W;
    canvas.height = WORLD_H;
    const ctx = canvas.getContext('2d');
    if (ctx) paintSky(ctx);
    const texture = Texture.from(canvas);
    return new Sprite(texture);
  }

  private buildVignette(): void {
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_W;
    canvas.height = WORLD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createRadialGradient(
      WORLD_W / 2,
      WORLD_H / 2,
      WORLD_H * 0.35,
      WORLD_W / 2,
      WORLD_H / 2,
      WORLD_H * 0.92,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(2,6,8,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const sprite = new Sprite(Texture.from(canvas));
    sprite.alpha = 0.9;
    this.overlay.addChild(sprite);

    for (let i = 0; i < 5; i += 1) {
      const cloud = new Graphics();
      const w = 90 + i * 26;
      cloud
        .ellipse(0, 0, w * 0.5, 13 + i * 1.6)
        .fill({ color: i % 2 ? 0x2c4650 : 0x1d333c, alpha: 0.5 });
      cloud.position.set(140 + i * 230, 110 + (i % 3) * 46);
      cloud.alpha = 0.55;
      this.clouds.push(cloud);
      this.overlay.addChild(cloud);
    }
  }

  private resize(): void {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / WORLD_W, height / WORLD_H);
    this.baseScale = scale;
    this.offsetX = (width - WORLD_W * scale) / 2;
    this.offsetY = (height - WORLD_H * scale) / 2;
    this.root.scale.set(scale);
    this.root.position.set(this.offsetX, this.offsetY);
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.app.screen.width / rect.width;
    const scaleY = this.app.screen.height / rect.height;
    const localX = (clientX - rect.left) * scaleX;
    const localY = (clientY - rect.top) * scaleY;
    return {
      x: (localX - this.offsetX) / this.baseScale,
      y: (localY - this.offsetY) / this.baseScale,
    };
  }

  handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'fire': {
        this.burst(event.x, event.y, 12, 0xffd166, 200, 'circle', 0.45);
        this.burst(event.x, event.y, 6, 0xfff3c4, 260, 'circle', 0.3);
        this.shake = Math.max(this.shake, 2.5);
        break;
      }
      case 'shotgun': {
        for (let i = 0; i < 10; i += 1) {
          const spread = (Math.random() - 0.5) * 0.12;
          this.particles.push({
            x: event.x,
            y: event.y,
            vx: Math.cos(event.angle + spread) * (500 + Math.random() * 400),
            vy: Math.sin(event.angle + spread) * (500 + Math.random() * 400),
            life: 0.22,
            maxLife: 0.22,
            size: 1.6,
            color: 0xffe3b0,
            gravity: 0,
            shape: 'circle',
            growth: 0,
          });
        }
        break;
      }
      case 'impact': {
        this.burst(event.x, event.y, 6, 0xffc98a, 150, 'circle', 0.3);
        break;
      }
      case 'explosion': {
        this.explode(event.x, event.y, event.radius);
        break;
      }
      case 'hurt': {
        this.addText(event.x, event.y, `-${event.amount}`, 0xff8f7a);
        break;
      }
      case 'death': {
        this.burst(event.x, event.y - 14, 26, event.color, 240, 'circle', 0.9);
        this.burst(event.x, event.y - 14, 12, 0x2a2320, 90, 'circle', 1.2);
        this.addText(event.x, event.y - 40, 'ELIMINATED', 0xffe08a, 14);
        break;
      }
      case 'splash': {
        this.splash(event.x, event.y);
        break;
      }
      case 'bounce': {
        this.burst(event.x, event.y, 3, 0xbba06f, 80, 'circle', 0.25);
        break;
      }
      case 'jump': {
        this.burst(event.x, event.y, 5, 0xbba06f, 60, 'circle', 0.3);
        break;
      }
      case 'rope': {
        this.burst(event.x, event.y, 5, 0xbba06f, 60, 'circle', 0.3);
        break;
      }
      default:
        break;
    }
  }

  private burst(
    x: number,
    y: number,
    count: number,
    color: number,
    speed: number,
    shape: 'circle' | 'ring',
    life: number,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 40,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        size: 1.5 + Math.random() * 3,
        color,
        gravity: 260,
        shape,
        growth: 0,
      });
    }
  }

  private explode(x: number, y: number, radius: number): void {
    this.shake = Math.max(this.shake, Math.min(16, 5 + radius * 0.12));
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: radius * 0.4,
      color: 0xfff1c4,
      gravity: 0,
      shape: 'ring',
      growth: radius * 2.4,
    });
    this.burst(x, y, 26, 0xffb347, 380, 'circle', 0.6);
    this.burst(x, y, 14, 0xfff0b8, 260, 'circle', 0.35);
    this.burst(x, y, 16, 0x6b4a2f, 300, 'circle', 0.9);
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 30 - 30,
        life: 0.8 + Math.random() * 0.7,
        maxLife: 1.4,
        size: radius * 0.16 + Math.random() * radius * 0.15,
        color: 0x2c3230,
        gravity: -26,
        shape: 'circle',
        growth: 18,
      });
    }
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 14; i += 1) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: -120 - Math.random() * 160,
        life: 0.8,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
        color: 0x8fd7d7,
        gravity: 520,
        shape: 'circle',
        growth: 0,
      });
    }
  }

  private addText(x: number, y: number, value: string, color: number, size = 15): void {
    const view = new Text({
      text: value,
      style: {
        fontFamily: FONT_DISPLAY,
        fontSize: size,
        fill: color,
        stroke: { color: 0x0b0f10, width: 4 },
      },
    });
    view.anchor.set(0.5, 1);
    view.position.set(x, y);
    this.fxLayer.addChild(view);
    this.texts.push({ view, vy: -46, life: 1 });
  }

  render(dt: number, paused: boolean): void {
    this.time += dt;
    const snapshot = this.engine.snapshot();
    this.lastSnapshot = snapshot;

    for (const team of this.engine.teams) {
      for (const worm of team.worms) {
        const view = this.wormViews.get(worm.id);
        if (!view) continue;
        const active = worm.id === snapshot.activeWormId && !paused;
        const canAct = active && snapshot.phase === 'aim' && !team.isAi;
        const heldWeapon = worm.id === snapshot.activeWormId ? snapshot.weapon : 'bazooka';
        view.sync(worm, team.color, active, canAct, paused ? 0 : dt, heldWeapon);
      }
    }

    // projectiles
    const alive = new Set<number>();
    for (const p of this.engine.projectilesInFlight) {
      alive.add(p.id);
      let g = this.projectileGfx.get(p.id);
      if (!g) {
        g = this.drawProjectile(p.weapon);
        this.projectileGfx.set(p.id, g);
        this.projectileLayer.addChild(g);
      }
      g.position.set(p.x, p.y);
      g.rotation = Math.atan2(p.vy, p.vx);
      if (p.fuse !== null) {
        const blink = p.age > p.fuse - 0.9 ? 1 + Math.sin(this.time * 30) * 0.12 : 1;
        g.scale.set(blink);
      }
      if (Math.random() < 0.55) {
        const trail = PROJECTILE_TRAILS[p.weapon];
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 26,
          vy: (Math.random() - 0.5) * 20 - 14,
          life: trail.life,
          maxLife: 0.45,
          size: trail.size,
          color: trail.color,
          gravity: -14,
          shape: 'circle',
          growth: 3,
        });
      }
    }
    for (const [id, g] of this.projectileGfx) {
      if (!alive.has(id)) {
        g.destroy();
        this.projectileGfx.delete(id);
      }
    }

    this.drawRope(paused);
    this.drawAim(snapshot, dt, paused);
    this.drawFx(dt, paused);
    this.drawWater();
    this.animateClouds(dt, paused);

    if (!paused && this.shake > 0.1) {
      this.shake *= Math.pow(0.001, dt);
    } else if (paused) {
      this.shake = 0;
    }
    const shake = paused ? 0 : this.shake;
    this.world.position.set(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake,
    );
  }

  private drawProjectile(weapon: WeaponId): Graphics {
    const g = new Graphics();
    if (weapon === 'bazooka') {
      g.roundRect(-7, -3, 14, 6, 3).fill(0xe9e2cf);
      g.moveTo(7, 0).lineTo(2, -4).lineTo(2, 4).closePath().fill(0xff6b5b);
      g.moveTo(-7, 0).lineTo(-12, -3).lineTo(-12, 3).closePath().fill(0xffb347);
      g.circle(-11, 0, 3).fill({ color: 0xffd166, alpha: 0.65 });
    } else if (weapon === 'grenade') {
      g.circle(0, 0, 5).fill(0x6d8f4f);
      g.circle(-1.6, -1.6, 1.6).fill(0xa9c97f);
      g.rect(-1.5, -8, 3, 3).fill(0xd8d2c0);
    } else if (weapon === 'shotgun') {
      g.roundRect(-9, -1.4, 18, 2.8, 1.4).fill(0xfff0c2);
    } else {
      g.roundRect(-3.5, -9, 7, 18, 2).fill(0xb03a2f);
      g.rect(-3.5, -4, 7, 4).fill(0xf4ead7);
      g.circle(0, -12, 2.5).fill({ color: 0xffd166, alpha: 0.9 });
    }
    return g;
  }

  private drawRope(paused: boolean): void {
    this.rope.clear();
    if (paused) return;
    for (const team of this.engine.teams) {
      for (const worm of team.worms) {
        if (!worm.rope) continue;
        this.rope
          .moveTo(worm.x, worm.y - 14)
          .lineTo(worm.rope.anchorX, worm.rope.anchorY)
          .stroke({ width: 2, color: 0xe8d6b0, alpha: 0.9 });
        this.rope.circle(worm.rope.anchorX, worm.rope.anchorY, 3).fill(0xffe08a);
      }
    }
  }

  private drawAim(snapshot: GameSnapshot, dt: number, paused: boolean): void {
    this.aim.clear();
    const activeWorm = this.engine.activeWorm;
    if (!activeWorm || snapshot.phase !== 'aim' || paused) return;
    if (activeWorm.rope) return;
    // The CPU keeps its reticle hidden while walking; the aim animation is the tell.
    if (this.engine.teams[snapshot.activeTeam].isAi && !this.engine.aiAiming) return;
    const weapon = WEAPONS[snapshot.weapon];
    const power = Math.max(0.14, snapshot.power);
    const angle = activeWorm.aimAngle;

    const muzzleX = activeWorm.x + Math.cos(angle) * 18;
    const muzzleY = activeWorm.y - 14 + Math.sin(angle) * 18;
    this.aim
      .moveTo(activeWorm.x, activeWorm.y - 14)
      .lineTo(muzzleX, muzzleY)
      .stroke({ width: 2, color: 0xffe08a, alpha: 0.85 });

    if (weapon.kind === 'drop') return;

    const preview = previewFlight(this.engine.terrain, muzzleX, muzzleY, angle, power, weapon.id, this.engine.wind);
    for (const [index, point] of preview.entries()) {
      const t = (index + 1) / preview.length;
      this.aim.circle(point.x, point.y, 1.6).fill({ color: 0xffe08a, alpha: 0.32 + t * 0.4 });
    }

    // The aim bound: every reticle sits on or inside this circle.
    this.aim
      .circle(activeWorm.x, activeWorm.y - 14, AIM.radius)
      .stroke({ width: 1, color: 0xffe08a, alpha: 0.14 });

    const point = aimPoint(this.engine.terrain, activeWorm.x, activeWorm.y, angle);
    this.aim.circle(point.x, point.y, 9 + Math.sin(this.time * 5) * 1.2).stroke({
      width: 2,
      color: 0xffe08a,
      alpha: 0.85,
    });
    this.aim
      .moveTo(point.x - 14, point.y)
      .lineTo(point.x - 5, point.y)
      .moveTo(point.x + 5, point.y)
      .lineTo(point.x + 14, point.y)
      .moveTo(point.x, point.y - 14)
      .lineTo(point.x, point.y - 5)
      .moveTo(point.x, point.y + 5)
      .lineTo(point.x, point.y + 14)
      .stroke({ width: 2, color: 0xffe08a, alpha: 0.7 });

    // power arc under the worm; moveTo first so it never joins the reticle path
    if (snapshot.power > 0.01) {
      const arc = Math.PI * 0.9;
      const start = Math.PI * 0.55;
      const radius = 22;
      this.aim
        .moveTo(activeWorm.x + Math.cos(start) * radius, activeWorm.y - 2 + Math.sin(start) * radius)
        .arc(activeWorm.x, activeWorm.y - 2, radius, start, start + arc * snapshot.power)
        .stroke({ width: 3, color: snapshot.power > 0.85 ? 0xff6b5b : 0x9ee37d, alpha: 0.9 });
    }
  }

  private drawFx(dt: number, paused: boolean): void {
    const g = this.fx;
    g.clear();
    if (!paused) {
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.growth * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        if (p.shape === 'ring') {
          g.circle(p.x, p.y, p.size).stroke({ width: 3, color: p.color, alpha: alpha * 0.8 });
        } else {
          g.circle(p.x, p.y, Math.max(0.4, p.size)).fill({ color: p.color, alpha: alpha * 0.92 });
        }
      }

      for (let i = this.texts.length - 1; i >= 0; i -= 1) {
        const t = this.texts[i];
        t.life -= dt * 0.85;
        t.view.y += t.vy * dt;
        t.vy *= 0.94;
        t.view.alpha = Math.max(0, Math.min(1, t.life));
        if (t.life <= 0) {
          t.view.destroy();
          this.texts.splice(i, 1);
        }
      }
    } else {
      // keep rendering current particles without integrating
      for (const p of this.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        if (p.shape === 'ring') {
          g.circle(p.x, p.y, p.size).stroke({ width: 3, color: p.color, alpha: alpha * 0.8 });
        } else {
          g.circle(p.x, p.y, Math.max(0.4, p.size)).fill({ color: p.color, alpha: alpha * 0.92 });
        }
      }
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  private drawWater(): void {
    this.water.clear();
    this.water.rect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y).fill({ color: 0x0a1c22, alpha: 0.55 });
    for (let i = 0; i < 4; i += 1) {
      const y = WATER_Y + 5 + i * 10;
      this.water
        .moveTo(0, y)
        .lineTo(WORLD_W, y)
        .stroke({ width: 1, color: i % 2 ? 0x8fd7d7 : 0xe8ad68, alpha: 0.12 });
    }
    const phase = this.time * 0.8;
    this.water
      .moveTo(0, WATER_Y + 2)
      .lineTo(WORLD_W, WATER_Y + 2)
      .stroke({ width: 2, color: 0x9fd8d0, alpha: 0.2 + Math.sin(phase) * 0.04 });
  }

  private animateClouds(dt: number, paused: boolean): void {
    if (paused) return;
    for (const cloud of this.clouds) {
      cloud.x += dt * (6 + cloud.y * 0.01);
      if (cloud.x > WORLD_W + 160) cloud.x = -160;
    }
  }

  get windText(): string {
    return this.lastSnapshot ? windLabel(this.lastSnapshot.wind) : '';
  }

  destroy(): void {
    this.engine.terrain.onCarve = null;
    for (const view of this.wormViews.values()) view.destroy();
    this.wormViews.clear();
    this.app.ticker.stop();
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}

export type ArenaHandle = { renderer: ArenaRenderer; ticker: Ticker };
