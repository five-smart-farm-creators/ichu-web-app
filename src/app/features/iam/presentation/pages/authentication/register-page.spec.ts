import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthFacade } from '../../../application/services/auth.facade';
import { RegisterPage } from './register-page';

function createPage(): RegisterPage {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthFacade, useValue: {} },
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
    ],
  });
  return TestBed.runInInjectionContext(() => new RegisterPage());
}

function fillAccount(page: RegisterPage, role: 'rancher' | 'veterinarian'): void {
  page.form.patchValue({
    name: 'Eduardo Quispe',
    email: 'vet@example.test',
    password: 'secret-password',
    confirmPassword: 'secret-password',
    role,
    terms: true,
  });
}

describe('RegisterPage form', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lets a veterinarian continue without the hidden ranch fields', () => {
    const page = createPage();
    fillAccount(page, 'veterinarian');

    expect(page.form.valid).toBe(true);
  });

  it('still requires the ranch details and a positive head count from a ranch manager', () => {
    const page = createPage();
    fillAccount(page, 'rancher');
    expect(page.form.hasError('ranchDetailsRequired')).toBe(true);

    page.form.patchValue({ ranchName: 'Los Andes', region: 'Cusco', district: 'Urubamba', estimatedHeadCount: 40 });
    expect(page.form.valid).toBe(true);
  });
});
