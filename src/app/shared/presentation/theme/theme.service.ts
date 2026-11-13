import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ichu.theme';

/** Holds the light or dark choice, applies it to the document and remembers it across visits. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly current = signal<AppTheme>(readStoredTheme() ?? 'light');

  constructor() {
    this.document.documentElement.dataset['theme'] = this.current();
  }

  use(theme: AppTheme): void {
    this.current.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
    writeStoredTheme(theme);
  }

  toggle(): void {
    this.use(this.current() === 'dark' ? 'light' : 'dark');
  }
}

function readStoredTheme(): AppTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled; the theme still applies until the page reloads.
  }
}
