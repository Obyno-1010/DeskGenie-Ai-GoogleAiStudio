import { openDB, IDBPDatabase } from 'idb';
import { DeskQuery } from '../types';

const DB_NAME = 'deskgenie_db';
const STORE_NAME = 'queries';

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveQuery(query: DeskQuery) {
  const db = await initDB();
  await db.put(STORE_NAME, query);
}

export async function getAllQueries(): Promise<DeskQuery[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function getUnsyncedQueries(): Promise<DeskQuery[]> {
  const all = await getAllQueries();
  return all.filter(q => !q.isSynced);
}

export async function markAsSynced(id: string) {
  const db = await initDB();
  const query = await db.get(STORE_NAME, id);
  if (query) {
    query.isSynced = true;
    await db.put(STORE_NAME, query);
  }
}

export async function deleteQuery(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllQueries() {
  const db = await initDB();
  await db.clear(STORE_NAME);
}
