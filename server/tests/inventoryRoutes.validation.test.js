import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import inventoryRoutes from '../routes/inventoryRoutes.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/inventory', inventoryRoutes);

describe('Inventory routes validation', () => {
  it('rejects create box without box_id', async () => {
    const res = await request(app).post('/api/inventory/boxes').send({ description: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects external item without required destination', async () => {
    const res = await request(app).post('/api/inventory/external').send({ boxId: 'BOX-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects move without source/target ids', async () => {
    const res = await request(app).post('/api/inventory/move').send({ user: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
