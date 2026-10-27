// Inline SVG icons (ADR-0010 §5): path data rendered by UiIcon, so no v-html and no icon font.
// Paths from Lucide (https://lucide.dev), ISC License, Copyright (c) for portions of Lucide are held by
// Cole Bemis 2013-2022 as part of Feather (MIT); all other copyright (c) for Lucide are held by Lucide Contributors 2022.
// 24×24 grid, drawn with a 2px stroke in currentColor.

const CIRCLE = 'M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0'

export const ICONS = {
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  'arrow-up-right': ['M7 7h10v10', 'M7 17 17 7'],
  'check': ['M20 6 9 17l-5-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'close': ['M18 6 6 18', 'm6 6 12 12'],
  'menu': ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'info': [CIRCLE, 'M12 16v-4', 'M12 8h.01'],
  'circle-check': [CIRCLE, 'm9 12 2 2 4-4'],
  'circle-alert': [CIRCLE, 'M12 8v4', 'M12 16h.01'],
  'triangle-alert': ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
} as const satisfies Record<string, readonly string[]>

export type IconName = keyof typeof ICONS
