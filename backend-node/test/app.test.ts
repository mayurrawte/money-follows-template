import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seed } from '../src/seed.js';

const db = openDb(':memory:');
seed(db);
const app = createApp(db);

async function login(email: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token;
}

let asha: string;
let chetan: string;

beforeAll(async () => {
  asha = await login('asha@example.com');
  chetan = await login('chetan@example.com');
});

describe('auth', () => {
  it('login returns a token and the user', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'bilal@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toEqual({ id: 2, name: 'Bilal Khan', email: 'bilal@example.com' });
  });

  it('me returns the caller', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, name: 'Asha Rao', email: 'asha@example.com' });
  });
});

describe('groups', () => {
  it('lists only groups the caller belongs to', async () => {
    const res = await request(app).get('/groups').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.map((g: { id: number }) => g.id)).toEqual([1, 2]);
  });

  it('returns group detail with members', async () => {
    const res = await request(app).get('/groups/1').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Goa trip');
    expect(res.body.members).toHaveLength(3);
  });

  it('gives 404 for an unknown group', async () => {
    const res = await request(app).get('/groups/99').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'group not found' });
  });

  it('balances sum to zero', async () => {
    const res = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.reduce((sum: number, b: { net_paise: number }) => sum + b.net_paise, 0)).toBe(0);
  });

  it('settling reduces what the payer owes', async () => {
    const before = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    const chetanBefore = before.body.find((b: { user_id: number }) => b.user_id === 3).net_paise;
    const settle = await request(app)
      .post('/groups/1/settle')
      .set('Authorization', `Bearer ${chetan}`)
      .send({ from_user: 3, to_user: 1, amount_paise: 50000 });
    expect(settle.status).toBe(201);
    expect(settle.body.group_id).toBe(1);
    const after = await request(app).get('/groups/1/balances').set('Authorization', `Bearer ${asha}`);
    expect(after.body.find((b: { user_id: number }) => b.user_id === 3).net_paise).toBe(chetanBefore + 50000);
    expect(after.body.reduce((sum: number, b: { net_paise: number }) => sum + b.net_paise, 0)).toBe(0);
  });
});

describe('expenses', () => {
  it('equal split divides the amount across the members', async () => {
    const res = await request(app).post('/expenses').set('Authorization', `Bearer ${asha}`).send({
      group_id: 1,
      amount_paise: 90000,
      category: 'Food',
      description: 'Snacks',
      spent_on: '2026-08-16',
      split_type: 'equal',
    });
    expect(res.status).toBe(201);
    expect(res.body.splits.map((s: { share_paise: number }) => s.share_paise)).toEqual([30000, 30000, 30000]);
  });

  it('rejects exact splits that do not sum to the amount', async () => {
    const res = await request(app).post('/expenses').set('Authorization', `Bearer ${asha}`).send({
      group_id: 1,
      amount_paise: 100000,
      category: 'Food',
      description: 'Snacks',
      spent_on: '2026-08-16',
      split_type: 'exact',
      splits: [{ user_id: 1, share_paise: 50000 }, { user_id: 2, share_paise: 40000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exact splits sum to 90000/);
  });

  it('lists the caller personal expenses', async () => {
    const res = await request(app).get('/expenses').set('Authorization', `Bearer ${chetan}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe('Headphones');
    const one = await request(app).get('/expenses/20').set('Authorization', `Bearer ${chetan}`);
    expect(one.status).toBe(200);
    expect(one.body.splits).toEqual([{ user_id: 3, share_paise: 249900 }]);
  });

  it('search matches description across visible expenses', async () => {
    const res = await request(app).get('/expenses/search').query({ q: 'bigbasket' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: number }) => e.id)).toEqual([11, 13]);
  });
});

describe('dashboard', () => {
  it('monthly totals the caller share by category', async () => {
    const res = await request(app).get('/dashboard/monthly').query({ month: '2026-09' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-09');
    expect(res.body.total_paise).toBe(2709250);
    expect(res.body.by_category[0]).toEqual({ category: 'Rent', total_paise: 1800000 });
    expect(res.body.by_category.find((c: { category: string }) => c.category === 'Utilities').total_paise).toBe(169950);
  });

  it('csv export has the contract header and INR amounts', async () => {
    const res = await request(app).get('/export/csv').query({ month: '2026-09' }).set('Authorization', `Bearer ${asha}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('date,description,category,group,paid_by,amount_inr,my_share_inr');
    expect(lines[1]).toBe('2026-09-01,September rent,Rent,Flat 4B,Bilal Khan,36000.00,18000.00');
  });
});
