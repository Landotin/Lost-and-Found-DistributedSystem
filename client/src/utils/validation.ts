/**
 * Validates a Philippine mobile number.
 * Accepts either:
 *  - E.164 format: +639XXXXXXXXX (+639 followed by 9 digits)
 *  - Local format: 09XXXXXXXXX (09 followed by 9 digits)
 */
export function validateMobile(mobile: string): boolean {
  const trimmed = mobile.trim();
  return /^\+639\d{9}$/.test(trimmed) || /^09\d{9}$/.test(trimmed);
}

/**
 * Converts a Philippine mobile number to E.164 format (+639XXXXXXXXX).
 * Accepts both '09XXXXXXXXX' and '+639XXXXXXXXX' formats.
 * Trims whitespace before processing.
 * Throws if the input is not a valid Philippine mobile number.
 */
export function formatMobileToE164(mobile: string): string {
  const trimmed = mobile.trim();
  if (!trimmed) return '';

  // Already in E.164 format with +63 prefix
  if (/^\+639\d{9}$/.test(trimmed)) {
    return trimmed;
  }

  // Local 09 format — convert to E.164
  if (/^09\d{9}$/.test(trimmed)) {
    return '+63' + trimmed.slice(1);
  }

  throw new Error('Invalid mobile number format');
}

/**
 * Validates that a string is non-empty after trimming whitespace.
 */
export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}
