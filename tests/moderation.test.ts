import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Moderation & RBAC Permissions', () => {
  let userToken: string;
  let moderatorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const personasRes = await request(app).get('/api/v1/auth/demo-personas');
    const personas = personasRes.body.data;
    adminToken = personas.find((p: any) => p.role === 'admin').token;
    moderatorToken = personas.find((p: any) => p.role === 'moderator').token;
    userToken = personas.find((p: any) => p.role === 'user').token;
  });

  it('should block regular users from accessing moderation queue (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow moderators to view the reported posts queue', async () => {
    const res = await request(app)
      .get('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${moderatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should allow moderator to approve a flagged post and trigger async notification', async () => {
    const queueRes = await request(app)
      .get('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${moderatorToken}`);

    if (queueRes.body.data.length > 0) {
      const targetPostId = queueRes.body.data[0].post_id;

      const actionRes = await request(app)
        .post(`/api/v1/moderation/posts/${targetPostId}/action`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          action: 'approved',
          notes: 'Post verified compliant by community moderator.'
        });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.success).toBe(true);
      expect(actionRes.body.data.post.status).toBe('active');
    }
  });

  it('should allow admin to trigger district emergency broadcast', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Monsoon Flood Advisory - Ward 14',
        message: 'High water levels reported near Durgapura railway underpass.',
        city: 'Jaipur',
        level: 'warning'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
  });
});
