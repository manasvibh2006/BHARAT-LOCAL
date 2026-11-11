import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Feed & Redis Caching API', () => {
  it('should fetch the community feed filtered by city', async () => {
    const res = await request(app).get('/api/v1/feed?city=Jaipur&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.posts).toBeDefined();
    expect(Array.isArray(res.body.data.posts)).toBe(true);
    expect(res.body.data.filters.city).toBe('Jaipur');
  });

  it('should serve subsequent identical feed requests from cache', async () => {
    // 1st request (miss / populate)
    const res1 = await request(app).get('/api/v1/feed?city=Jaipur&category=announcements&limit=5');
    expect(res1.status).toBe(200);

    // 2nd request (cache hit)
    const res2 = await request(app).get('/api/v1/feed?city=Jaipur&category=announcements&limit=5');
    expect(res2.status).toBe(200);
    expect(res2.body.data.meta.cached).toBe(true);
  });

  it('should filter posts by language preference', async () => {
    const res = await request(app).get('/api/v1/feed?city=Jaipur&language=hi');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    res.body.data.posts.forEach((post: any) => {
      expect(post.language).toBe('hi');
    });
  });

  it('should support search with pagination', async () => {
    const res = await request(app).get('/api/v1/search?q=जल&city=Jaipur');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pagination.page).toBe(1);
  });
});
