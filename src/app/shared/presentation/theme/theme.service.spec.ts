import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const storageKey = 'ichu.theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  it('defaults to the light theme without a saved choice', () => {
    const theme = TestBed.inject(ThemeService);

    expect(theme.current()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('toggles the theme, marks the document and persists the choice', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();

    expect(theme.current()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(storageKey)).toBe('dark');

    theme.toggle();

    expect(theme.current()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem(storageKey)).toBe('light');
  });

  it('restores a saved dark theme on startup', () => {
    localStorage.setItem(storageKey, 'dark');

    const theme = TestBed.inject(ThemeService);

    expect(theme.current()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('keeps switching themes when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    const theme = TestBed.inject(ThemeService);

    expect(theme.current()).toBe('light');

    theme.toggle();

    expect(theme.current()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
