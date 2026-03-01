import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '../constants/game.js';

/** Result of a validation check. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate that a value is a non-empty trimmed string within a max length. */
export function validateString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): ValidationResult {
  const errors: string[] = [];
  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      errors.push(`${fieldName} must not be empty`);
    }
    if (trimmed.length > maxLength) {
      errors.push(`${fieldName} must be at most ${maxLength} characters`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate a game title. */
export function validateGameTitle(title: unknown): ValidationResult {
  return validateString(title, 'title', MAX_TITLE_LENGTH);
}

/** Validate a game description. */
export function validateGameDescription(description: unknown): ValidationResult {
  return validateString(description, 'description', MAX_DESCRIPTION_LENGTH);
}

/** Validate an email address (basic RFC 5322 subset). */
export function validateEmail(email: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof email !== 'string') {
    errors.push('email must be a string');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email is not valid');
  }
  return { valid: errors.length === 0, errors };
}

/** Merge multiple ValidationResults into one. */
export function mergeValidations(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}
