import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./polished-select.css', import.meta.url), 'utf8');

describe('schedule layout CSS regression', () => {
 it('keeps the picker above the table and editor without stacking the desktop sidebar', () => {
  expect(css).toContain('.schedule-layout{flex-direction:row;flex-wrap:wrap;align-items:flex-start}');
  expect(css).toMatch(/\.schedule-layout>\.group-sidebar\.schedule-picker-strip\{[^}]*flex:0 0 100%/);
  expect(css).toContain('.schedule-layout>.schedule-body{width:auto;max-width:none;flex:1 1 0;min-width:0}');
  expect(css).toContain('.schedule-layout{flex-direction:column;flex-wrap:nowrap;align-items:stretch}');
  expect(css).toContain('.schedule-layout>.schedule-body{width:100%;max-width:100%;flex:1 1 auto}');
 });
});
