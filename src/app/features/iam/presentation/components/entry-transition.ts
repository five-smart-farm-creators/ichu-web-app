import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'ichu-entry-transition',
  standalone: true,
  imports: [CdkTrapFocus, TranslatePipe],
  templateUrl: './entry-transition.html',
  styleUrl: './entry-transition.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryTransition {
  readonly finished = output<void>();
  readonly progress = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1200;
      const started = performance.now();
      let frame = 0;
      const update = (now: number): void => {
        if (this.destroyRef.destroyed) return;
        const elapsed = Math.min((now - started) / duration, 1);
        this.progress.set(Math.round(elapsed * 100));
        if (elapsed === 1) this.finished.emit();
        else frame = requestAnimationFrame(update);
      };
      frame = requestAnimationFrame(update);
      this.destroyRef.onDestroy(() => cancelAnimationFrame(frame));
    });
  }
}
