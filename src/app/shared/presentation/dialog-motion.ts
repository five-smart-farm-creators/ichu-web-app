import type { MatDialogConfig } from '@angular/material/dialog';

/** Timings and backdrop of every workspace dialog; kept out of app.config so the dialog module stays lazy. */
export const DIALOG_MOTION = {
  enterAnimationDuration: '220ms',
  exitAnimationDuration: '160ms',
  backdropClass: 'ichu-dialog-backdrop',
} satisfies MatDialogConfig;
