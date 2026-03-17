import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  profileUpdateSchema,
  approvalInitiateSchema,
  validateRequestBody,
  validateBodyMiddleware
} from '../utils/requestValidation.js';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('requestValidation utility', () => {
  it('returns parsed body for valid payload', () => {
    const req = { body: { username: 'admin', password: 'secret' } };
    const res = createMockRes();

    const parsed = validateRequestBody(loginSchema, req, res);

    expect(parsed).toEqual({ username: 'admin', password: 'secret' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns 400 with issue details for invalid payload', () => {
    const req = { body: { username: '' } };
    const res = createMockRes();

    const parsed = validateRequestBody(loginSchema, req, res);

    expect(parsed).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('Validation failed');
    expect(Array.isArray(res.body?.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('enforces currentPassword when profile password changes', () => {
    const req = { body: { password: 'new-password' } };
    const res = createMockRes();

    const parsed = validateRequestBody(profileUpdateSchema, req, res);

    expect(parsed).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body.details.some((d) => d.path === 'currentPassword')).toBe(true);
  });

  it('middleware writes validated data to req.body', () => {
    const req = {
      body: {
        title: 'Persetujuan Dokumen',
        requester_username: 'alice',
        steps: [{ username: 'manager-1' }]
      }
    };
    const res = createMockRes();
    let called = false;

    const middleware = validateBodyMiddleware(approvalInitiateSchema);
    middleware(req, res, () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(req.body.requester_username).toBe('alice');
    expect(Array.isArray(req.body.steps)).toBe(true);
  });
});
