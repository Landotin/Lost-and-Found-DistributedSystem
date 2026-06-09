import { describe, it, expect } from 'vitest';
import { validateMobile, validateRequired, formatMobileToE164 } from './validation';

describe('validateMobile', () => {
  it('returns true for valid E.164 Philippine mobile number (+639)', () => {
    expect(validateMobile('+639123456789')).toBe(true);
  });

  it('returns true for another valid E.164 Philippine mobile number', () => {
    expect(validateMobile('+639987654321')).toBe(true);
  });

  it('returns true for valid 09-format Philippine mobile number', () => {
    expect(validateMobile('09123456789')).toBe(true);
  });

  it('returns true for another valid 09-format Philippine mobile number', () => {
    expect(validateMobile('09876543210')).toBe(true);
  });

  it('returns false for 09 number with too few digits', () => {
    expect(validateMobile('0912345678')).toBe(false);
  });

  it('returns false for 09 number with too many digits', () => {
    expect(validateMobile('091234567890')).toBe(false);
  });

  it('returns false for number with too few digits (+639 format)', () => {
    expect(validateMobile('+63912345678')).toBe(false);
  });

  it('returns false for number with too many digits (+639 format)', () => {
    expect(validateMobile('+6391234567890')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateMobile('')).toBe(false);
  });

  it('returns false for non-numeric characters in +639 format', () => {
    expect(validateMobile('+63912345678a')).toBe(false);
  });

  it('returns false for non-numeric characters in 09 format', () => {
    expect(validateMobile('0912345678a')).toBe(false);
  });

  it('returns false for completely invalid string', () => {
    expect(validateMobile('abc')).toBe(false);
  });

  it('returns false for 639 without plus sign', () => {
    expect(validateMobile('639123456789')).toBe(false);
  });

  it('returns false for number starting with 08 (not a valid mobile prefix)', () => {
    expect(validateMobile('08123456789')).toBe(false);
  });
});

describe('formatMobileToE164', () => {
  it('converts 09XXXXXXXXX to +639XXXXXXXXX', () => {
    expect(formatMobileToE164('09123456789')).toBe('+639123456789');
  });

  it('converts 09XXXXXXXXX with whitespace to +639XXXXXXXXX', () => {
    expect(formatMobileToE164('  09123456789  ')).toBe('+639123456789');
  });

  it('leaves +639XXXXXXXXX unchanged', () => {
    expect(formatMobileToE164('+639123456789')).toBe('+639123456789');
  });

  it('leaves +639XXXXXXXXX with whitespace unchanged', () => {
    expect(formatMobileToE164('  +639123456789  ')).toBe('+639123456789');
  });

  it('returns empty string for empty input', () => {
    expect(formatMobileToE164('')).toBe('');
  });

  it('throws for invalid mobile format', () => {
    expect(() => formatMobileToE164('abc')).toThrow('Invalid mobile number format');
  });

  it('throws for 08-prefixed number', () => {
    expect(() => formatMobileToE164('08123456789')).toThrow('Invalid mobile number format');
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
