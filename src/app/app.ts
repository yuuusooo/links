import { Component, HostListener, computed, signal } from '@angular/core';
import { Cursor } from './cursor';
import { LINKS, NAME } from './links';
import { MODES, Mode, Stage } from './stage';

@Component({
  selector: 'app-root',
  imports: [Stage, Cursor],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly links = LINKS;
  protected readonly modes = MODES;
  protected readonly name = NAME;
  protected readonly index = signal(0);
  protected readonly mode = signal<Mode>('Gather');
  protected readonly active = computed(() => this.links[this.index()]);

  private wheelLock = 0;

  protected go(i: number) {
    const n = this.links.length;
    this.index.set(((i % n) + n) % n);
  }

  protected pad(n: number) {
    return String(n).padStart(2, '0');
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.go(this.index() + 1);
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.go(this.index() - 1);
    const m = MODES[Number(e.key) - 1];
    if (m) this.mode.set(m);
  }

  @HostListener('window:wheel', ['$event'])
  onWheel(e: WheelEvent) {
    const now = performance.now();
    if (now - this.wheelLock < 800 || Math.abs(e.deltaY) < 20) return;
    this.wheelLock = now;
    this.go(this.index() + (e.deltaY > 0 ? 1 : -1));
  }
}