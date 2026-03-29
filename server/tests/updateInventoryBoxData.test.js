import { describe, it, expect, vi, beforeEach } from 'vitest';

// Static code scan utility
import fs from 'fs';
import path from 'path';

describe('Inventory Update - box_data null safety & code scan', () => {
  it('codebase scan: find literal occurrences of "box_data: null" in src', async () => {
    const root = path.resolve(process.cwd());
    const matches = [];

    const walk = (dir) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const p = path.join(dir, it.name);
        if (it.isDirectory()) {
          if (['node_modules', '.git', 'dist'].includes(it.name)) continue;
          walk(p);
        } else {
          if (!p.includes(path.join('src')) && !p.includes(path.join('server'))) continue;
          try {
            const txt = fs.readFileSync(p, 'utf8');
            if (txt && txt.includes('box_data: null')) {
              matches.push(p);
            }
          } catch (e) { /* ignore read errors */ }
        }
      }
    };

    walk(root);

    // We expect only intentional server-side clears (inventoryController.js and explicit reset handlers).
    // If new matches appear in client code, the test should fail to draw attention.
    const allowed = [
      path.join('server', 'controllers', 'inventoryController.js'),
      path.join('src', 'App.jsx')
    ].map(p => path.resolve(root, p));

    const unexpected = matches.filter(m => !allowed.includes(m));

    if (unexpected.length > 0) {
      console.warn('[scan] Found unexpected occurrences of `box_data: null`:', unexpected);
    }

    expect(unexpected.length).toBe(0);
  });

  it('controller logic: preserves box_id / avoids clearing box_data when box_id provided', async () => {
    // Prepare a mock knex that captures the update payload
    let capturedUpdate = null;

    const mockFirst = async () => ({ id: 1, status: 'STORED', box_id: 'BOX-2026-001', boxData: null, box_data: null });

    const mockWhereObj = {
      update: async (data) => {
        capturedUpdate = data;
        return 1; // rows affected
      },
      first: mockFirst
    };

    const mockKnex = (table) => ({ where: (col, val) => mockWhereObj });
    mockKnex.fn = { now: () => 'NOW' };

    // Mock the knex module before importing controller
    vi.mock('../db.js', () => ({
      knex: mockKnex
    }));

    // Import the controller after mocking
    const mod = await import('../controllers/inventoryController.js');

    // Build fake req/res
    const req = {
      params: { id: '1' },
      body: { status: 'STORED', box_data: null, box_id: 'BOX-2026-001', history: [] }
    };

    let statusCode = 200;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (obj) => { return obj; }
    };

    // Call updateInventoryItem
    await mod.updateInventoryItem(req, res);

    // Assertions: capturedUpdate should not include box_data: null for non-EMPTY status when box_id present
    expect(capturedUpdate).not.toBeNull();
    // If box_data field present and null, that's a clear instruction — ensure we did not set it to null
    if (Object.prototype.hasOwnProperty.call(capturedUpdate, 'box_data')) {
      expect(capturedUpdate.box_data).not.toBeNull();
    }
    // box_id must be preserved
    expect(capturedUpdate.box_id).toBe('BOX-2026-001');
  });
});
