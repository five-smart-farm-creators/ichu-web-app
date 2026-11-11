import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon';

export type ExportFormat = 'excel' | 'pdf';

/** Offers Excel and PDF downloads; the page prepares the rows and reports the chosen format. */
@Component({
  selector: 'ichu-export-menu',
  imports: [MatMenuModule, TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="btn secondary export-trigger" [matMenuTriggerFor]="formats"
      [disabled]="disabled() || busy()" [attr.aria-label]="'common.export' | translate">
      <ichu-icon name="download" />
      <span>{{ (busy() ? 'common.exporting' : 'common.export') | translate }}</span>
      <ichu-icon name="chevron" />
    </button>
    <mat-menu #formats="matMenu">
      <button mat-menu-item type="button" (click)="exportRequested.emit('excel')">
        <span>{{ 'common.exportExcel' | translate }}</span>
      </button>
      <button mat-menu-item type="button" (click)="exportRequested.emit('pdf')">
        <span>{{ 'common.exportPdf' | translate }}</span>
      </button>
    </mat-menu>`,
  styles: ':host{display:inline-flex}.export-trigger ichu-icon{width:16px;height:16px}',
})
export class ExportMenu {
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly exportRequested = output<ExportFormat>();
}
