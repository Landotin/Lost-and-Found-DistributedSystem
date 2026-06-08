import { describe, it, expect } from 'vitest';
import { validateMobile, validateRequired } from './validation';

describe('validateMobile', () => {
  it('returns true for valid Philippine mobile number', () => {
    expect(validateMobile('+639123456789')).toBe(true);
  });

  it('returns true for another valid Philippine mobile number', () => {
    expect(validateMobile('+639987654321')).toBe(true);
  });

  it('returns false for number starting with 0 instead of +63', () => {
    expect(validateMobile('09123456789')).toBe(false);
  });

  it('returns false for number with too few digits', () => {
    expect(validateMobile('+63912345678')).toBe(false);
  });

  it('returns false for number with too many digits', () => {
    expect(validateMobile('+6391234567890')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateMobile('')).toBe(false);
  });

  it('returns false for non-numeric characters', () => {
    expect(validateMobile('+63912345678a')).toBe(false);
  });

  it('returns false for completely invalid string', () => {
    expect(validateMobile('abc')).toBe(false);
  });

  it('returns false for missing plus sign', () => {
    expect(validateMobile('639123456789')).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns true for a non-empty string', () => {
    expect(validateRequired('hello')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(validateRequired('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(validateRequired('   ')).toBe(false);
  });

  it('returns true for a string with leading/trailing whitespace but non-empty content', () => {
    expect(validateRequired('  hello  ')).toBe(true);
  });

  it('returns false for string with only newlines', () => {
    expect(validateRequired('\n\n')).toBe(false);
  });
});
