import { useEffect, useRef } from 'react';
import { WORLD_H, WORLD_W } from '../game/config';
import { paintCloudBands, paintSky } from '../game/sky';
import { Terrain } from '../game/terrain';
import { TerrainPainter } from '../game/terrain-painter';

const SCENE_MS = 2000;

/**
 * Decorative arena behind the /demo dialog: sky plus a generated island, no
 * worms or HUD. Two canvases crossfade so the backdrop changes every 2 s.
 * `data-scene` carries the current terrain seed for tests.
 */
export function MenuBackdrop() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layersRef = useRef<Array<HTMLCanvasElement | null>>([null, null]);

  useEffect(() => {
    const host = hostRef.current;
    const layers = layersRef.current.filter((canvas): canvas is HTMLCanvasElement => canvas !== null);
    if (!host || layers.length < 2) return;

    const draw = (canvas: HTMLCanvasElement, seed: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      paintSky(ctx);
      paintCloudBands(ctx);
      ctx.drawImage(new TerrainPainter(new Terrain(seed)).canvas, 0, 0);
      canvas.style.opacity = '1';
    };
    const nextSeed = () => Math.floor(Math.random() * 1_000_000_000);

    let seed = nextSeed();
    let front = 0;
    draw(layers[front], seed);
    host.dataset.scene = String(seed);

    // A moving backdrop is decoration; hold one composition when motion is unwelcome.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      const back = 1 - front;
      seed = nextSeed();
      draw(layers[back], seed);
      layers[front].style.opacity = '0';
      front = back;
      host.dataset.scene = String(seed);
    }, SCENE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="menu-backdrop" data-testid="menu-backdrop" ref={hostRef} aria-hidden>
      <canvas width={WORLD_W} height={WORLD_H} ref={(el) => { layersRef.current[0] = el; }} />
      <canvas width={WORLD_W} height={WORLD_H} ref={(el) => { layersRef.current[1] = el; }} />
    </div>
  );
}
