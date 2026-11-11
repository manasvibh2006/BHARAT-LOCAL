import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Auth & User Account API', () => {
  it('should request an OTP for a valid Indian phone number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe('+919876543210');
    expect(res.body.data.expiresInSeconds).toBeGreaterThan(0);
  });

  it('should reject invalid phone numbers with validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should verify OTP and issue a valid JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: '+919876543210',
        otp: '123456',
        preferred_language: 'kn',
        city: 'Bengaluru'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.phone).toBe('+919876543210');
  });

  it('should return 401 when accessing protected /api/v1/auth/me without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return current user profile with valid Bearer token', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: '+919876543210', otp: '123456' });
    const token = loginRes.body.data.token;

    // 2. Fetch /me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.phone).toBe('+919876543210');
  });
});
