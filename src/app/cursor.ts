import { Component, ElementRef, OnDestroy, afterNextRender, viewChildren } from '@angular/core';

// One ring follows the pointer; two ghost rings trail behind it.
const RINGS = [0.4, 0.2, 0.11];

@Component({
  selector: 'app-cursor',
  template: `@for (r of rings; track $index) {<span #ring></span>}`,
  styles: `
    :host { display: none; }
    span {
      position: fixed; top: 0; left: 0; z-index: 100; pointer-events: none;
      width: 26px; height: 26px; margin: -13px 0 0 -13px;
      border: 1px solid #eceae3; border-radius: 50%;
      transition: width .3s, height .3s, margin .3s, opacity .3s;
    }
    span:nth-child(2) { opacity: .4; }
    span:nth-child(3) { opacity: .18; }
    :host(.hot) span { width: 44px; height: 44px; margin: -22px 0 0 -22px; }
    @media (hover: hover) and (pointer: fine) { :host { display: block; } }
  `,
  host: {
    '(window:pointermove)': 'target = [$event.clientX, $event.clientY]',
    '(window:pointerover)': 'hot($event)',
  },
})
export class Cursor implements OnDestroy {
  protected readonly rings = RINGS;
  protected target = [-100, -100];

  private readonly els = viewChildren<ElementRef<HTMLElement>>('ring');
  private readonly pos = RINGS.map(() => [-100, -100]);
  private raf = 0;

  constructor(private readonly host: ElementRef<HTMLElement>) {
    afterNextRender(() => (this.raf = requestAnimationFrame(() => this.frame())));
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }

  protected hot(e: PointerEvent) {
    const over = (e.target as Element).closest('a, button, app-stage');
    this.host.nativeElement.classList.toggle('hot', !!over);
  }

  private frame() {
    this.els().forEach((el, i) => {
      const p = this.pos[i];
      p[0] += (this.target[0] - p[0]) * RINGS[i];
      p[1] += (this.target[1] - p[1]) * RINGS[i];
      el.nativeElement.style.transform = `translate3d(${p[0]}px, ${p[1]}px, 0)`;
    });
    this.raf = requestAnimationFrame(() => this.frame());
  }
}
