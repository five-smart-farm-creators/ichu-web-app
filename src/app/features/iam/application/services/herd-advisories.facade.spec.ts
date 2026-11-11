import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { IamAccount, RanchAccess } from '../../domain/model/auth.model';
import type { AdvisoryStatus, HerdAdvisoryRecord } from '../../domain/model/herd-advisory.model';
import type { ProfessionalProfile } from '../../domain/model/professional-profile.model';
import type { RanchSummary } from '../../domain/model/ranch-summary.model';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { RanchDirectoryRepository } from '../../domain/repositories/ranch-directory.repository';
import { IamContextFacade } from '../acl/iam-context.facade';
import { AuthFacade } from './auth.facade';
import { HerdAdvisoriesFacade } from './herd-advisories.facade';

const profile: ProfessionalProfile = { specialty: 'Bovine medicine', licenseNumber: 'CMVP-1234', yearsOfExperience: 8 };
const lakeside: RanchSummary = { ranchId: 'ranch-7', name: 'Lakeside', region: 'Puno', district: 'Melgar' };

function account(role: string, professional: ProfessionalProfile | null = profile): IamAccount {
  return { id: 'account-1', email: 'user@example.test', role, status: 'Active', profile: professional };
}

function ranchAccess(ranchId: string, scope: string): RanchAccess {
  return { ranchId, scope, expiresAt: null, name: null, region: null, district: null, accessCode: null };
}

function advisory(id: string, status: AdvisoryStatus, ranchId = 'ranch-1'): HerdAdvisoryRecord {
  return {
    id,
    veterinarianId: 'veterinarian-1',
    ranchId,
    reason: 'Vaccine review',
    status,
    scope: 'Read',
    requestedAt: '2026-11-01T10:00:00Z',
    grantedAt: null,
    expiresAt: null,
    endedAt: null,
    veterinarianProfile: profile,
  };
}

async function settleAsyncWork(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('HerdAdvisoriesFacade', () => {
  let auth: { account: WritableSignal<IamAccount | null>; ranchAccess: WritableSignal<readonly RanchAccess[]> };
  let advisories: { list: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn>; decide: ReturnType<typeof vi.fn> };
  let directory: { findByAccessCode: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    auth = {
      account: signal<IamAccount | null>(account('Veterinarian')),
      ranchAccess: signal<readonly RanchAccess[]>([]),
    };
    advisories = {
      list: vi.fn(async (): Promise<readonly HerdAdvisoryRecord[]> => []),
      request: vi.fn(),
      decide: vi.fn(),
    };
    directory = { findByAccessCode: vi.fn(async (): Promise<RanchSummary | null> => null) };
    TestBed.configureTestingModule({
      providers: [
        HerdAdvisoriesFacade,
        IamContextFacade,
        { provide: AuthFacade, useValue: auth },
        { provide: HerdAdvisoryRepository, useValue: advisories },
        { provide: RanchDirectoryRepository, useValue: directory },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('confirms a ranch by its access code, then requests access for that ranch', async () => {
    const facade = TestBed.inject(HerdAdvisoriesFacade);
    directory.findByAccessCode.mockResolvedValue(lakeside);
    advisories.request.mockResolvedValue(advisory('advisory-1', 'Pending', 'ranch-7'));

    await facade.findRanch('abcd2345');
    expect(directory.findByAccessCode).toHaveBeenCalledWith('abcd2345');
    expect(facade.foundRanch()).toEqual(lakeside);

    expect(await facade.requestAccess('Vaccine review')).toBe(true);
    expect(advisories.request).toHaveBeenCalledWith('ranch-7', { reason: 'Vaccine review' });
    expect(facade.requestedAdvisory()?.status).toBe('Pending');
    expect(facade.foundRanch()).toBeNull();
  });

  it('reports a code that matches no ranch and does not offer a request target', async () => {
    const facade = TestBed.inject(HerdAdvisoriesFacade);

    await facade.findRanch('ZZZZ9999');

    expect(facade.ranchNotFound()).toBe(true);
    expect(facade.foundRanch()).toBeNull();
  });

  it('drops a lookup that finishes after the access code was edited', async () => {
    let resolveLookup: (ranch: RanchSummary | null) => void = () => undefined;
    directory.findByAccessCode.mockReturnValueOnce(new Promise<RanchSummary | null>(resolve => {
      resolveLookup = resolve;
    }));
    const facade = TestBed.inject(HerdAdvisoriesFacade);

    const lookup = facade.findRanch('ABCD2345');
    facade.clearLookup();
    resolveLookup(lakeside);
    await lookup;

    expect(facade.foundRanch()).toBeNull();
    expect(facade.lookupBusy()).toBe(false);
  });

  it('blocks access requests until the veterinarian profile is complete', async () => {
    auth.account.set(account('Veterinarian', null));
    const facade = TestBed.inject(HerdAdvisoriesFacade);
    directory.findByAccessCode.mockResolvedValue(lakeside);
    await facade.findRanch('ABCD2345');

    expect(await facade.requestAccess('Vaccine review')).toBe(false);

    expect(advisories.request).not.toHaveBeenCalled();
    expect(facade.error()).toMatchObject({ status: 403, code: 'http-403' });
  });

  it('loads the managed ranch and reloads when the manager switches ranches', async () => {
    auth.account.set(account('RanchManager'));
    auth.ranchAccess.set([ranchAccess('ranch-1', 'Manage'), ranchAccess('ranch-2', 'Manage')]);
    advisories.list
      .mockResolvedValueOnce([advisory('advisory-a', 'Pending', 'ranch-1')])
      .mockResolvedValueOnce([advisory('advisory-b', 'Pending', 'ranch-2')]);
    const facade = TestBed.inject(HerdAdvisoriesFacade);
    const context = TestBed.inject(IamContextFacade);

    TestBed.flushEffects();
    await settleAsyncWork();
    expect(advisories.list).toHaveBeenCalledWith('ranch-1');
    expect(facade.records().map(record => record.id)).toEqual(['advisory-a']);

    context.selectRanch('ranch-2');
    TestBed.flushEffects();
    await settleAsyncWork();
    expect(advisories.list).toHaveBeenLastCalledWith('ranch-2');
    expect(facade.records().map(record => record.id)).toEqual(['advisory-b']);
  });

  it('ignores ranches the manager cannot manage', async () => {
    auth.account.set(account('RanchManager'));
    auth.ranchAccess.set([ranchAccess('ranch-1', 'Read')]);
    const facade = TestBed.inject(HerdAdvisoriesFacade);

    TestBed.flushEffects();
    await settleAsyncWork();

    expect(advisories.list).not.toHaveBeenCalled();
    expect(facade.records()).toEqual([]);
  });

  it('replaces the decided row with the response for grant, revoke, and reject', async () => {
    auth.account.set(account('RanchManager'));
    auth.ranchAccess.set([ranchAccess('ranch-1', 'Manage')]);
    advisories.list.mockResolvedValue([advisory('advisory-1', 'Pending')]);
    const facade = TestBed.inject(HerdAdvisoriesFacade);
    TestBed.flushEffects();
    await settleAsyncWork();

    const grant = { decision: 'grant' as const, scope: 'Read' as const, expiresAt: '2027-01-31T23:59:59.999Z' };
    advisories.decide.mockResolvedValueOnce(advisory('advisory-1', 'Granted'));
    expect(await facade.decide('advisory-1', grant)).toBe(true);
    expect(advisories.decide).toHaveBeenLastCalledWith('ranch-1', 'advisory-1', grant);
    expect(facade.records().map(record => record.status)).toEqual(['Granted']);
    expect(facade.notice()).toBe('granted');

    advisories.decide.mockResolvedValueOnce(advisory('advisory-1', 'Revoked'));
    await facade.decide('advisory-1', { decision: 'revoke' });
    expect(facade.records().map(record => record.status)).toEqual(['Revoked']);
    expect(facade.notice()).toBe('revoked');

    advisories.decide.mockResolvedValueOnce(advisory('advisory-1', 'Rejected'));
    await facade.decide('advisory-1', { decision: 'reject' });
    expect(facade.records().map(record => record.status)).toEqual(['Rejected']);
    expect(facade.notice()).toBe('rejected');
  });

  it('keeps the list and reports the error when a decision fails', async () => {
    auth.account.set(account('RanchManager'));
    auth.ranchAccess.set([ranchAccess('ranch-1', 'Manage')]);
    advisories.list.mockResolvedValue([advisory('advisory-1', 'Pending')]);
    const facade = TestBed.inject(HerdAdvisoriesFacade);
    TestBed.flushEffects();
    await settleAsyncWork();
    advisories.decide.mockRejectedValueOnce(new ApiError(409, 'http-409', null));

    expect(await facade.decide('advisory-1', { decision: 'reject' })).toBe(false);

    expect(facade.records().map(record => record.status)).toEqual(['Pending']);
    expect(facade.error()).toMatchObject({ status: 409 });
  });
});
