import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import pustakaRoutes from '../routes/pustakaRoutes.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/pustaka', pustakaRoutes);

describe('Pustaka routes validation', () => {
  it('rejects create guide without title', async () => {
    const res = await request(app).post('/api/pustaka/guides').send({ category: 'umum' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects create slide without title', async () => {
    const res = await request(app).post('/api/pustaka/slides').send({ guide_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
