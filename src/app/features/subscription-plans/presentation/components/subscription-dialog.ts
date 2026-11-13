import type { MatDialogConfig } from '@angular/material/dialog';
import { DIALOG_MOTION } from '../../../../shared/presentation/dialog-motion';

/** Panel size shared by the subscription dialogs. */
export const SUBSCRIPTION_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_MOTION,
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};
