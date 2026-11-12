import type { MatDialogConfig } from '@angular/material/dialog';

/** How a dialog ended: saved, or refused because the record changed meanwhile (the page reloads it). */
export type MonitoringDialogOutcome = 'saved' | 'conflict';

/** Panel size and surface shared by the monitoring form dialogs. */
export const MONITORING_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};

/** Alert details open as a drawer beside the queue, using the shared drawer surface styles. */
export const ALERT_DRAWER_CONFIG: MatDialogConfig = {
  width: 'min(440px, 100vw)',
  height: '100dvh',
  maxHeight: '100dvh',
  position: { top: '0', right: '0' },
  panelClass: ['ichu-workspace-dialog', 'ichu-alert-drawer'],
};

/** Form layout shared by the monitoring dialogs; one column on narrow screens. */
export const MONITORING_DIALOG_STYLES = '.dialog-lead{margin:0 0 16px;color:var(--muted);font-size:.875rem}'
  + '.dialog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}'
  + '.dialog-grid mat-form-field,.full-width{width:100%}.span-two{grid-column:1/-1}'
  + '.dialog-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;margin:0 0 18px}'
  + '.dialog-facts dt{color:var(--muted);font-size:.75rem;font-weight:600}.dialog-facts dd{margin:2px 0 0;font-size:.875rem}'
  + '@media (max-width:560px){.dialog-grid,.dialog-facts{grid-template-columns:1fr}}';
