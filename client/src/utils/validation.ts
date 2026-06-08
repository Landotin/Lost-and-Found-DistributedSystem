/**
 * Validates a Philippine mobile number.
 * Must match format +639XXXXXXXXX (country code +639 followed by 9 digits).
 */
export function validateMobile(mobile: string): boolean {
  return /^\+639\d{9}$/.test(mobile);
}

/**
 * Validates that a string is non-empty after trimming whitespace.
 */
export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}
