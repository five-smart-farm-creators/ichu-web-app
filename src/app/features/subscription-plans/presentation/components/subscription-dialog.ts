import type { MatDialogConfig } from '@angular/material/dialog';

/** Panel size shared by the subscription dialogs. */
export const SUBSCRIPTION_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};
