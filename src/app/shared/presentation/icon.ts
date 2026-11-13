import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const ICONS: Record<string, string> = {
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
  chevron: 'm9 5 7 7-7 7',
  collapse: 'M3 4h18v16H3z M9 4v16 M16 9l-3 3 3 3',
  plus: 'M12 4v16 M4 12h16',
  check: 'm5 12 4 4L19 6',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  cattle: 'M4 4c0 3 2 4 4 5 M20 4c0 3-2 4-4 5 M7 9h10v5a5 5 0 0 1-10 0z M10 14h.01 M14 14h.01',
  pulse: 'M2 12h5l3-7 4 14 3-7h5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  calendar: 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4',
  chart: 'M4 3v17h17 M8 16v-5 M13 16V7 M18 16v-7',
  pin: 'M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  leaf: 'M4 20C4 9 10 4 21 3c0 10-6 17-15 17z M4 20 16 8',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  radio: 'M8 5a10 10 0 0 0 0 14 M16 5a10 10 0 0 1 0 14 M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  users: 'M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M1 22v-2a7 7 0 0 1 14 0v2 M17 4a4 4 0 0 1 0 8 M18 15a6 6 0 0 1 5 6',
  card: 'M2 5h20v14H2z M2 10h20 M6 15h4',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'm6 6 12 12 M18 6 6 18',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  logout: 'M9 3H3v18h6 M9 12h13 M17 7l5 5-5 5',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
  alert: 'M12 3 2 21h20z M12 9v5 M12 17.5h.01',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  venus: 'M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 13v8 M8.5 17.5h7',
};

@Component({
  selector: 'ichu-icon', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name()] || paths[\'grid\']" /></svg>',
  styles: ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0}svg{width:100%;height:100%}',
})
export class Icon {
  readonly name = input('grid');
  readonly paths = ICONS;
}
