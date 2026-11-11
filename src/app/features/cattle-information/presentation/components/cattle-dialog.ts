import type { MatDialogConfig } from '@angular/material/dialog';

/** How a dialog ended: saved, or refused because the record changed meanwhile (the page reloads it). */
export type CattleDialogOutcome = 'saved' | 'conflict';

/** Panel size and surface shared by the animal and lot dialogs. */
export const CATTLE_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};
