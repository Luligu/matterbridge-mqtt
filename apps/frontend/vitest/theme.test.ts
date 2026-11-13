/**
 * @file apps/frontend/vitest/theme.test.ts
 * @description Tests for the frontend application theme.
 * @author Luligu
 */

import { describe, expect, it } from 'vitest';

import { createAppTheme } from '../src/theme.js';

describe('createAppTheme', () => {
  it('should create a light theme when the mode is light', () => {
    const theme = createAppTheme('light');

    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.primary.main).toBe('#1976d2');
    expect(theme.palette.background.default).toBe('#fff');
    expect(theme.palette.background.paper).toBe('#fff');
  });

  it('should create a dark theme when the mode is dark', () => {
    const theme = createAppTheme('dark');

    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#1976d2');
    expect(theme.palette.background.default).toBe('#121212');
    expect(theme.palette.background.paper).toBe('#121212');
  });
});
