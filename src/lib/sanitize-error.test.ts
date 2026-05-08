import { describe, it, expect } from 'vitest';
import { sanitizeError } from './sanitize-error';

describe('sanitizeError', () => {
  it('strips email addresses from error messages', () => {
    const err = new Error('Permission denied for user alice@curro.co.za on path users/x');
    const result = sanitizeError(err);
    expect(result.message).not.toContain('alice@curro.co.za');
    expect(result.message).toContain('[redacted-email]');
  });

  it('strips 28-char UIDs from error messages', () => {
    const err = new Error('User AbCdEfGhIjKlMnOpQrStUvWxYz12 not authorized');
    const result = sanitizeError(err);
    expect(result.message).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz12');
    expect(result.message).toContain('[redacted-uid]');
  });

  it('preserves non-PII portions of the message', () => {
    const err = new Error('Permission denied for user alice@curro.co.za on path users/x');
    const result = sanitizeError(err);
    expect(result.message).toContain('Permission denied');
    expect(result.message).toContain('users/x');
  });

  it('extracts the error code when present', () => {
    const err = Object.assign(new Error('boom'), { code: 'permission-denied' });
    expect(sanitizeError(err).code).toBe('permission-denied');
  });

  it('returns code "unknown" when error has no code', () => {
    expect(sanitizeError(new Error('boom')).code).toBe('unknown');
  });

  it('handles non-Error input', () => {
    expect(sanitizeError('plain string')).toEqual({ code: 'unknown', message: 'plain string' });
    expect(sanitizeError({ foo: 1 })).toEqual({ code: 'unknown', message: '[object Object]' });
  });
});
