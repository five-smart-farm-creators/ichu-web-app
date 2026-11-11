import type { TranslateService } from '@ngx-translate/core';
import type { IamContextFacade } from '../../iam/application/acl/iam-context.facade';

/** Names the current ranch the way the shell does: its name, or a numbered fallback that never shows the ID. */
export function currentRanchLabel(context: IamContextFacade, translate: TranslateService): string {
  const ranch = context.currentRanch();
  if (!ranch) return '';
  if (ranch.name) return ranch.name;
  const position = context.ranches().findIndex(access => access.ranchId === ranch.ranchId) + 1;
  return translate.instant('shell.ranchFallback', { position });
}
