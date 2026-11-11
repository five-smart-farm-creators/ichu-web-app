import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

/** Translation keys for the question, explanation, and confirm label of a ConfirmDialog. */
export interface ConfirmDialogData {
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly confirmKey: string;
}

/** Asks before an action that is hard to undo; closes with true only when the user confirms. */
@Component({
  selector: 'ichu-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ data.titleKey | translate }}</h2>
    <mat-dialog-content><p>{{ data.bodyKey | translate }}</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button type="button" color="warn" [mat-dialog-close]="true">{{ data.confirmKey | translate }}</button>
    </mat-dialog-actions>`,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
