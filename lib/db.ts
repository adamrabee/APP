/**
 * Offline-first data layer (BRD §6).
 *
 * Every table is mirrored in memory + AsyncStorage. Writes apply locally first
 * (instant UI), then go into a persistent queue that is flushed to Supabase
 * whenever we're online. Reads pull the user's rows from Supabase and replace
 * the local copy, keeping any rows whose writes are still queued.
 *
 * It's a single-user personal app, so pulling a whole table is fine.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

export type Row = Record<string, any> & { id: string };

type Op =
  | { kind: 'upsert'; table: string; row: Row; key: string }
  | { kind: 'delete'; table: string; id: string; key: string };

const PK: Record<string, string> = { profiles: 'user_id', work_state: 'user_id' };
const pk = (table: string) => PK[table] ?? 'id';

let userId: string | null = null;
const cache = new Map<string, Map<string, Row>>();
const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, Row[]>();
let queue: Op[] = [];
let flushing = false;
let syncListeners = new Set<() => void>();
let syncState: { pending: number; online: boolean; lastError?: string } = { pending: 0, online: true };

const storeKey = (t: string) => `me.db.${userId}.${t}`;
const queueKey = () => `me.queue.${userId}`;

export const uuid = () => Crypto.randomUUID();
export const getUserId = () => userId;

function emit(table: string) {
  snapshots.delete(table);
  listeners.get(table)?.forEach((l) => l());
}

function emitSync() {
  syncState = { ...syncState, pending: queue.length };
  syncListeners.forEach((l) => l());
}

function tableMap(table: string): Map<string, Row> {
  let m = cache.get(table);
  if (!m) {
    m = new Map();
    cache.set(table, m);
  }
  return m;
}

async function persist(table: string) {
  if (!userId) return;
  const rows = Array.from(tableMap(table).values());
  await AsyncStorage.setItem(storeKey(table), JSON.stringify(rows)).catch(() => {});
}

async function persistQueue() {
  if (!userId) return;
  await AsyncStorage.setItem(queueKey(), JSON.stringify(queue)).catch(() => {});
}

const loaded = new Set<string>();
async function loadLocal(table: string) {
  if (loaded.has(table) || !userId) return;
  loaded.add(table);
  try {
    const raw = await AsyncStorage.getItem(storeKey(table));
    if (raw) {
      const m = tableMap(table);
      for (const r of JSON.parse(raw) as Row[]) m.set(r[pk(table)], r);
      emit(table);
    }
  } catch {}
}

/** Called on sign-in / sign-out. */
export async function setUser(id: string | null) {
  userId = id;
  cache.clear();
  loaded.clear();
  snapshots.clear();
  queue = [];
  if (id) {
    try {
      const raw = await AsyncStorage.getItem(queueKey());
      queue = raw ? JSON.parse(raw) : [];
    } catch {
      queue = [];
    }
  }
  emitSync();
  listeners.forEach((_, t) => emit(t));
  if (id) flush();
}

/** Pull the latest rows of a table from Supabase. */
export async function pull(table: string) {
  if (!userId) return;
  await loadLocal(table);
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) {
      syncState = { ...syncState, online: false, lastError: error.message };
      emitSync();
      return;
    }
    all.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const key = pk(table);
  const pendingIds = new Set(queue.filter((o) => o.table === table).map((o) => o.key));
  const m = tableMap(table);
  const next = new Map<string, Row>();
  for (const r of all) next.set(r[key], r);
  for (const id of pendingIds) {
    const local = m.get(id);
    if (local) next.set(id, local);
    else next.delete(id); // pending delete
  }
  cache.set(table, next);
  syncState = { ...syncState, online: true, lastError: undefined };
  emit(table);
  emitSync();
  persist(table);
}

export async function flush() {
  if (flushing || !userId || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length) {
      const op = queue[0];
      const res =
        op.kind === 'upsert'
          ? await supabase.from(op.table).upsert(op.row, { onConflict: pk(op.table) })
          : await supabase.from(op.table).delete().eq(pk(op.table), op.id);
      if (res.error) {
        const msg = res.error.message || '';
        // Network problems: stop and retry later. Data errors: drop the op so the queue never jams.
        const network = /fetch|network|timeout|Failed/i.test(msg) || res.status === 0;
        syncState = { ...syncState, online: !network, lastError: msg };
        if (network) break;
        console.warn('[db] dropped op', op, msg);
      } else {
        syncState = { ...syncState, online: true, lastError: undefined };
      }
      queue.shift();
      await persistQueue();
      emitSync();
    }
  } catch (e: any) {
    syncState = { ...syncState, online: false, lastError: String(e?.message ?? e) };
  } finally {
    flushing = false;
    emitSync();
  }
}

function enqueue(op: Op) {
  // Collapse ops on the same row. An upsert replaces an earlier upsert *in place*
  // so a parent row never moves behind its children (FK order is preserved).
  const same = (o: Op) => o.table === op.table && o.key === op.key;
  if (op.kind === 'upsert') {
    const i = queue.findIndex((o) => same(o) && o.kind === 'upsert');
    if (i >= 0) queue[i] = op;
    else queue.push(op);
  } else {
    queue = queue.filter((o) => !same(o));
    queue.push(op);
  }
  persistQueue();
  emitSync();
  flush();
}

export function insert<T extends Record<string, any>>(table: string, values: T): Row {
  const key = pk(table);
  const now = new Date().toISOString();
  const row: Row = { created_at: now, ...values, user_id: userId, id: values.id ?? uuid() } as Row;
  if (key === 'user_id') delete (row as any).id;
  tableMap(table).set(row[key], row);
  emit(table);
  persist(table);
  enqueue({ kind: 'upsert', table, row, key: row[key] });
  return row;
}

export function update(table: string, id: string, patch: Record<string, any>): Row | undefined {
  const m = tableMap(table);
  const cur = m.get(id);
  if (!cur) return undefined;
  const row = { ...cur, ...patch };
  if ('updated_at' in cur) row.updated_at = new Date().toISOString();
  m.set(id, row);
  emit(table);
  persist(table);
  enqueue({ kind: 'upsert', table, row, key: id });
  return row;
}

/** Insert-or-update for tables keyed by user_id (profiles, work_state). */
export function upsertOwn(table: string, patch: Record<string, any>) {
  if (!userId) return;
  const m = tableMap(table);
  const cur = m.get(userId) ?? { user_id: userId, created_at: new Date().toISOString() };
  const row = { ...cur, ...patch, user_id: userId } as Row;
  m.set(userId, row);
  emit(table);
  persist(table);
  enqueue({ kind: 'upsert', table, row, key: userId });
}

/** Delete a row. `cascade` lists child tables (table, fk) to clean locally — the DB cascades on its own. */
export function remove(table: string, id: string, cascade: [string, string][] = []) {
  tableMap(table).delete(id);
  emit(table);
  persist(table);
  for (const [t, fk] of cascade) {
    const m = tableMap(t);
    let changed = false;
    for (const [k, r] of m) if (r[fk] === id) (m.delete(k), (changed = true));
    if (changed) (emit(t), persist(t));
  }
  enqueue({ kind: 'delete', table, id, key: id });
}

export function rows(table: string): Row[] {
  let s = snapshots.get(table);
  if (!s) {
    s = Array.from(tableMap(table).values());
    snapshots.set(table, s);
  }
  return s;
}

export function get(table: string, id: string | null | undefined): Row | undefined {
  return id ? tableMap(table).get(id) : undefined;
}

function subscribe(table: string, cb: () => void) {
  let set = listeners.get(table);
  if (!set) {
    set = new Set();
    listeners.set(table, set);
  }
  set.add(cb);
  return () => set!.delete(cb);
}

const pulledThisSession = new Set<string>();

/** Live rows of a table. Loads local copy, then pulls once per session. */
export function useRows(table: string): Row[] {
  useEffect(() => {
    loadLocal(table);
    if (!pulledThisSession.has(table)) {
      pulledThisSession.add(table);
      pull(table);
    }
  }, [table]);
  return useSyncExternalStore(
    (cb) => subscribe(table, cb),
    () => rows(table),
    () => rows(table),
  );
}

/** Filtered + sorted live rows. */
export function useQuery(
  table: string,
  filter?: (r: Row) => boolean,
  sort?: (a: Row, b: Row) => number,
  deps: unknown[] = [],
): Row[] {
  const all = useRows(table);
  return useMemo(() => {
    const out = filter ? all.filter(filter) : all.slice();
    if (sort) out.sort(sort);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, ...deps]);
}

export function useOwn(table: 'profiles' | 'work_state'): Row | undefined {
  const all = useRows(table);
  return all.find((r) => r.user_id === userId);
}

export function useSync() {
  return useSyncExternalStore(
    (cb) => (syncListeners.add(cb), () => syncListeners.delete(cb)),
    () => syncState,
    () => syncState,
  );
}

export function resetSession() {
  pulledThisSession.clear();
}

/** Re-pull everything that's been opened, e.g. on pull-to-refresh. */
export async function refreshAll() {
  await flush();
  await Promise.all(Array.from(pulledThisSession).map((t) => pull(t)));
}

// Flush when the app returns to the foreground, and every 30s while open.
AppState.addEventListener('change', (s) => s === 'active' && flush());
setInterval(() => flush(), 30000);

export const bySort = (a: Row, b: Row) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
export const byCreated = (a: Row, b: Row) => String(a.created_at).localeCompare(String(b.created_at));
export const byCreatedDesc = (a: Row, b: Row) => String(b.created_at).localeCompare(String(a.created_at));

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
