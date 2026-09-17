import { describe, expect, it } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('uses the Unrestricted AI dark baseline', () => {
    expect(theme.palette.mode).toBe('dark');
    expect(theme.typography.fontFamily).toContain('Segoe UI');
  });
});
