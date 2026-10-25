import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';

export const MODES = ['Gather', 'Drift', 'Swarm', 'Melt', 'Wave'] as const;
export type Mode = (typeof MODES)[number];
const COUNT = 9000;
// Critically damped: particles settle into the logo without bouncing back past it.
const SPRING = 0.015;
const DAMP = 0.85;
const MOUSE_RADIUS = 100;
const SWARM_RADIUS = 240;
const SPLASH_RADIUS = 280;
const BG = '#0a0a0a';
const INK = '236, 234, 227';

/** Particles that form whatever image they are given, moving according to the chosen mode. */
@Component({
  selector: 'app-stage',
  template: `
    <canvas
      #canvas
      (pointermove)="onMove($event)"
      (pointerleave)="mouse.x = mouse.y = -1e4"
      (click)="splash($event)"
    ></canvas>
    <div class="slot" [style.top.px]="captionTop()" [style.opacity]="captionTop() < 0 ? 0 : 1">
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
    .slot { position: absolute; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none; }
  `,
})
export class Stage implements OnDestroy {
  readonly image = input.required<string>();
  readonly mode = input<Mode>('Gather');

  protected readonly captionTop = signal(-1);
  protected readonly mouse = { x: -1e4, y: -1e4 };

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private ctx!: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  private readonly px = new Float32Array(COUNT);
  private readonly py = new Float32Array(COUNT);
  private readonly vx = new Float32Array(COUNT);
  private readonly vy = new Float32Array(COUNT);
  private readonly tx = new Float32Array(COUNT);
  private readonly ty = new Float32Array(COUNT);
  private readonly tb = new Float32Array(COUNT); // brightness of the sampled pixel
  private readonly al = new Float32Array(COUNT); // brightness x mode fade, used when drawing

  private img?: HTMLImageElement;
  private ready = false;
  private raf = 0;
  private observer?: ResizeObserver;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    afterNextRender(() => {
      this.ctx = this.canvas().nativeElement.getContext('2d')!;
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.host);
      this.resize();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });

    effect(() => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.retarget(true);
      };
      img.src = this.image();
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
  }

  protected onMove(e: PointerEvent) {
    this.mouse.x = e.offsetX;
    this.mouse.y = e.offsetY;
  }

  protected splash(e: MouseEvent) {
    for (let i = 0; i < COUNT; i++) {
      const dx = this.px[i] - e.offsetX;
      const dy = this.py[i] - e.offsetY;
      const d = Math.hypot(dx, dy) + 0.001;
      if (d > SPLASH_RADIUS) continue;
      const f = (1 - d / SPLASH_RADIUS) * 40;
      this.vx[i] += (dx / d) * f;
      this.vy[i] += (dy / d) * f;
    }
  }

  private resize() {
    const el = this.canvas().nativeElement;
    if (el.clientWidth === this.w && el.clientHeight === this.h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = el.clientWidth;
    this.h = el.clientHeight;
    el.width = this.w * dpr;
    el.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = BG;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.retarget(false);
  }

  /** Samples the current image into particle targets. `burst` kicks the particles off first. */
  private retarget(burst: boolean) {
    if (!this.img || !this.w || !this.h) return;

    const size = Math.min(this.w, this.h) * 0.5;
    const scale = Math.min(size / this.img.naturalWidth, size / this.img.naturalHeight);
    const dw = Math.max(1, Math.round(this.img.naturalWidth * scale));
    const dh = Math.max(1, Math.round(this.img.naturalHeight * scale));

    const off = document.createElement('canvas');
    off.width = dw;
    off.height = dh;
    const c = off.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(this.img, 0, 0, dw, dh);
    const data = c.getImageData(0, 0, dw, dh).data;

    const lumAt = (i: number) => (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;

    // Logos on a transparent background are read by alpha. Opaque images are read by
    // brightness, flipped when they are mostly light (a dark logo on white).
    let flat = false;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) flat = true;
      sum += lumAt(i);
    }
    const invert = !flat && sum / (dw * dh) > 0.6;

    const weight = (p: number) => {
      const i = p * 4;
      const lum = lumAt(i);
      const a = data[i + 3] / 255;
      return flat ? a * (0.45 + 0.55 * lum) : (invert ? 1 - lum : lum) * a;
    };

    const pixels: number[] = [];
    for (let p = 0; p < dw * dh; p++) if (weight(p) > 0.12) pixels.push(p);
    if (!pixels.length) return;

    const ox = (this.w - dw) / 2;
    const oy = (this.h - dh) / 2 - 28;
    this.captionTop.set(oy + dh + 28);

    for (let i = 0; i < COUNT; i++) {
      const p = pixels[(Math.random() * pixels.length) | 0];
      this.tx[i] = ox + (p % dw) + Math.random();
      this.ty[i] = oy + Math.floor(p / dw) + Math.random();
      this.tb[i] = this.al[i] = weight(p);

      if (!this.ready) {
        this.px[i] = Math.random() * this.w;
        this.py[i] = Math.random() * this.h;
      } else if (burst && !this.reduced) {
        const a = Math.random() * Math.PI * 2;
        const s = 10 + Math.random() * 18;
        this.vx[i] += Math.cos(a) * s;
        this.vy[i] += Math.sin(a) * s;
      }
      if (this.reduced) {
        this.px[i] = this.tx[i];
        this.py[i] = this.ty[i];
      }
    }
    this.ready = true;
    if (this.reduced) this.draw();
  }

  private frame(now: number) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (!this.ready || this.reduced) return;

    const mode = this.mode();
    const t = now / 1000;
    const { x: mx, y: my } = this.mouse;

    for (let i = 0; i < COUNT; i++) {
      const x = this.px[i];
      const y = this.py[i];
      let ox = 0;
      let oy = 0;
      let fx = 0;
      let fy = 0;
      let k = SPRING;
      let a = 1;

      switch (mode) {
        case 'Gather':
          fx = Math.sin(t * 0.8 + i * 0.37) * 0.012;
          fy = Math.cos(t * 0.7 + i * 0.21) * 0.012;
          break;
        case 'Drift': {
          // Loose spring plus a slow flow field: the logo dissolves into moving smoke.
          k = 0.005;
          const ang = (Math.sin(x * 0.006 + t * 0.3) + Math.cos(y * 0.006 - t * 0.25)) * Math.PI;
          fx = Math.cos(ang) * 0.3;
          fy = Math.sin(ang) * 0.3;
          break;
        }
        case 'Swarm': {
          // Every particle circles its own point; the cursor pulls them in.
          const r = 2 + (i % 5) * 2;
          const s = 0.8 + (i % 5) * 0.25;
          const ph = i * 0.61;
          ox = Math.cos(t * s + ph) * r;
          oy = Math.sin(t * s + ph) * r;
          k = 0.02;
          break;
        }
        case 'Melt': {
          // Neighbouring particles share a phase, so the melt travels as a soft wave
// instead of every grain blinking on its own.
const life = (t * 0.14 + this.ty[i] * 0.002 + Math.sin(this.tx[i] * 0.03) * 0.08 + (i % 13) * 0.004) % 1;
oy = life * life * (3 - 2 * life) * 80;
k = 0.12;
a = Math.min(1, life * 6) * (1 - life * life);
break;
        }
        case 'Wave':
          oy = Math.sin(this.tx[i] * 0.025 + t * 1.8) * 16;
          ox = Math.cos(this.ty[i] * 0.02 + t * 1.4) * 8;
          k = 0.05;
          break;
      }

      let ax = (this.tx[i] + ox - x) * k + fx;
      let ay = (this.ty[i] + oy - y) * k + fy;

      const dx = x - mx;
      const dy = y - my;
      const d = Math.hypot(dx, dy) + 0.001;
      if (mode === 'Swarm') {
        if (d < SWARM_RADIUS) {
          const f = (1 - d / SWARM_RADIUS) * 0.6;
          ax -= (dx / d) * f;
          ay -= (dy / d) * f;
        }
      } else if (d < MOUSE_RADIUS) {
        const f = (1 - d / MOUSE_RADIUS) * 0.45;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
      }

      this.vx[i] = (this.vx[i] + ax) * DAMP;
      this.vy[i] = (this.vy[i] + ay) * DAMP;
      this.px[i] += this.vx[i];
      this.py[i] += this.vy[i];
      this.al[i] = a * this.tb[i];
    }
    this.draw();
  }

  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = this.reduced ? BG : 'rgba(10, 10, 10, 0.3)';
    ctx.fillRect(0, 0, this.w, this.h);

    // Four brightness buckets keep the draw loop to a handful of fillStyle changes.
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = `rgba(${INK}, ${0.3 + b * 0.23})`;
      for (let i = 0; i < COUNT; i++) {
        const a = this.al[i];
        if (a >= 0.06 && Math.min(3, (a * 4) | 0) === b) ctx.fillRect(this.px[i], this.py[i], 1.6, 1.6);
      }
    }
  }
}