import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { CattleProfileFacade } from '../../../application/services/cattle-profile.facade';
import { ageInMonths, toIsoDate } from '../../../domain/model/cattle.model';
import { ChangeLifeStageDialog } from '../../components/change-life-stage-dialog';
import { CATTLE_DIALOG_CONFIG, type CattleDialogOutcome } from '../../components/cattle-dialog';
import { EditCattleDialog } from '../../components/edit-cattle-dialog';
import { RecordExitDialog } from '../../components/record-exit-dialog';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { CATTLE_ERROR_KEYS } from '../../cattle-error-keys';

/** Shows one animal; write actions appear only for active animals in a ranch the account manages. */
@Component({
  selector: 'ichu-cattle-profile-page',
  imports: [ApiErrorMessagePipe, DatePipe, MatProgressBarModule, RouterLink, TranslatePipe],
  providers: [CattleProfileFacade],
  templateUrl: './cattle-profile-page.html',
  styleUrl: './cattle-profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CattleProfilePage {
  readonly errorKeys = CATTLE_ERROR_KEYS;
  readonly facade = inject(CattleProfileFacade);
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageService);
  readonly cattleId = toSignal(this.route.paramMap.pipe(map(params => params.get('cattleId') ?? '')), {
    initialValue: '',
  });
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly ageMonths = computed(() => {
    const animal = this.facade.animal();
    return animal ? ageInMonths(animal.birthDate, toIsoDate(new Date())) : 0;
  });
  readonly notice = signal<string | null>(null);
  readonly conflict = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const cattleId = this.cattleId();
      untracked(() => {
        this.notice.set(null);
        this.conflict.set(false);
        if (ranchId && cattleId) void this.facade.load(ranchId, cattleId);
      });
    });
  }

  editAnimal(): void {
    const animal = this.facade.animal();
    if (!animal) return;
    this.dialog.open(EditCattleDialog, { ...CATTLE_DIALOG_CONFIG, injector: this.injector, data: animal })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'cattle.edit.saved'));
  }

  changeStage(): void {
    const animal = this.facade.animal();
    if (!animal) return;
    this.dialog.open(ChangeLifeStageDialog, { ...CATTLE_DIALOG_CONFIG, injector: this.injector, data: animal })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'cattle.lifeStage.saved'));
  }

  recordExit(): void {
    const animal = this.facade.animal();
    if (!animal) return;
    this.dialog.open(RecordExitDialog, { ...CATTLE_DIALOG_CONFIG, injector: this.injector, data: animal })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'cattle.exit.saved'));
  }

  /** A conflict has already reloaded the animal, so the page says so instead of reporting a save. */
  private showOutcome(outcome: CattleDialogOutcome | undefined, savedKey: string): void {
    this.notice.set(outcome === 'saved' ? savedKey : null);
    this.conflict.set(outcome === 'conflict');
  }
}
