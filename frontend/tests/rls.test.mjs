import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Postgres RLS denies anonymous, unauthorized and cross-user access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
    const owner = '00000000-0000-0000-0000-000000000001';
    const other = '00000000-0000-0000-0000-000000000002';
    const unauthorized = '00000000-0000-0000-0000-000000000003';
    await db.exec(`
      insert into auth.users values ('${owner}'), ('${other}'), ('${unauthorized}');
      insert into public.study_allowed_users values ('${owner}'), ('${other}');
      insert into public.study_progress(user_id) values ('${owner}'), ('${other}');
      set role anon;
    `);
    await assert.rejects(db.query('select * from public.study_progress'), /permission denied/);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${unauthorized}'`);
    assert.equal((await db.query('select * from public.study_progress')).rows.length, 0);
    assert.equal((await db.query('update public.study_progress set revision = 1 returning *')).rows.length, 0);
    await assert.rejects(db.query(`insert into public.study_allowed_users values ('${unauthorized}')`), /permission denied/);
    await db.exec(`set request.jwt.claim.sub = '${owner}'`);
    assert.equal((await db.query('select * from public.study_progress')).rows.length, 1);
    assert.equal((await db.query('select * from public.study_allowed_users')).rows.length, 1);
    await assert.rejects(db.query(`update public.study_progress set user_id = '${other}'`), /permission denied/);
    await assert.rejects(db.query(`insert into public.study_progress(user_id) values ('${unauthorized}')`), /permission denied/);
    assert.equal((await db.query('update public.study_progress set revision = 1 where revision = 0 returning *')).rows.length, 1);
    assert.equal((await db.query('update public.study_progress set revision = 1 where revision = 0 returning *')).rows.length, 0);
    assert.equal((await db.query(`update public.study_progress set revision = 2 where user_id = '${other}' returning *`)).rows.length, 0);
    await assert.rejects(db.query(`update public.study_progress set data = '{}'::jsonb`), /progress_format/);
    await db.exec(`reset role; delete from public.study_allowed_users where user_id = '${owner}'; set role authenticated`);
    assert.equal((await db.query('select * from public.study_progress')).rows.length, 0);
  } finally {
    await db.close();
  }
});
