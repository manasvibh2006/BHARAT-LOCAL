import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Posts Lifecycle & Reporting API', () => {
  let authToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: '+919876543210', otp: '123456' });
    authToken = res.body.data.token;
  });

  it('should create a new post with proper validation', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Community Tree Plantation Drive at Indiranagar',
        content: 'Join us this Sunday morning at 7 AM near BDA complex. Saplings will be provided free of cost.',
        category_id: 'events',
        language: 'en',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'Indiranagar',
        pincode: '560038'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe('Community Tree Plantation Drive at Indiranagar');
  });

  it('should reject invalid pincodes with validation error', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Invalid Pincode Post Example',
        content: 'Testing invalid pincode rejection validation.',
        category_id: 'services',
        state: 'Karnataka',
        city: 'Bengaluru',
        pincode: '999' // invalid
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should report a post and enqueue an async notification', async () => {
    // 1. Get a post ID from feed
    const feedRes = await request(app).get('/api/v1/feed?city=Jaipur');
    const postId = feedRes.body.data.posts[0].id;

    // 2. Report it
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/report`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reason: 'spam',
        details: 'Repetitive advertising'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.reason).toBe('spam');
  });
});
