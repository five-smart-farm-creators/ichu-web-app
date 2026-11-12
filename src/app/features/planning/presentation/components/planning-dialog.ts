import type { MatDialogConfig } from '@angular/material/dialog';

/** A planning dialog that saved closes with `saved`; the screen behind it then reloads what it shows. */
export type PlanningDialogOutcome = 'saved';

/** Panel size and surface shared by the planning form dialogs. */
export const PLANNING_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(560px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};

/** Dialogs with two lists, such as an activity's applications and follow-ups, need more room. */
export const PLANNING_WIDE_DIALOG_CONFIG: MatDialogConfig = {
  width: 'min(680px, calc(100vw - 32px))',
  panelClass: 'ichu-workspace-dialog',
};
