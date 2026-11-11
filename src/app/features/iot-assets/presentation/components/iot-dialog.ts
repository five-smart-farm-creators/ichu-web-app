import type { MatDialogConfig } from '@angular/material/dialog';

/** How a dialog ended: saved, or refused because the record changed meanwhile (the page reloads it). */
export type IotDialogOutcome = 'saved' | 'conflict';

/** Panel size and surface shared by the IoT asset dialogs. */
export const IOT_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};

/** Two-column form grid and warning note shared by the IoT asset dialogs; one column on narrow screens. */
export const IOT_DIALOG_STYLES = '.dialog-lead{margin:0 0 16px;color:var(--muted);font-size:.875rem}'
  + '.dialog-warning{margin:0 0 16px;padding:12px 14px;border:1px solid #eed7c9;border-radius:10px;background:#fbf1ec;color:#7d3b2f;font-size:.875rem}'
  + '.device-serial{margin:0 0 14px;font-size:.875rem}.device-serial strong{font-weight:650}'
  + '.dialog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}'
  + '.dialog-grid mat-form-field,.full-width{width:100%}.span-two{grid-column:1/-1}'
  + '@media (max-width:560px){.dialog-grid{grid-template-columns:1fr}}';
