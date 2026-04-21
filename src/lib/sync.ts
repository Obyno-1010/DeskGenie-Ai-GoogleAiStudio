import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError } from './firebase';
import { DeskQuery } from '../types';
import { getAllQueries as getLocalQueries, saveQuery as saveLocalQuery, markAsSynced, deleteQuery as deleteLocalQuery } from './storage';

export async function syncQueries() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const unsynced = (await getLocalQueries()).filter(q => !q.isSynced);
    const batch = writeBatch(db);

    for (const q of unsynced) {
      const qRef = doc(db, 'users', user.uid, 'queries', q.id);
      batch.set(qRef, {
        ...q,
        userId: user.uid,
        isSynced: true, // Mark as synced in remote
        syncedAt: serverTimestamp()
      });
    }

    if (unsynced.length > 0) {
      await batch.commit();
      for (const q of unsynced) {
        await markAsSynced(q.id);
      }
    }

    // Also pull from remote
    const remoteQuery = query(
      collection(db, 'users', user.uid, 'queries'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(remoteQuery);
    const remoteQueries = snapshot.docs.map(doc => doc.data() as DeskQuery);
    
    // Save remote to local
    for (const rq of remoteQueries) {
      await saveLocalQuery({ ...rq, isSynced: true });
    }
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

export async function saveToRemote(deskQuery: DeskQuery) {
  const user = auth.currentUser;
  if (!user) return;

  const path = `users/${user.uid}/queries/${deskQuery.id}`;
  try {
    await setDoc(doc(db, path), {
      ...deskQuery,
      userId: user.uid,
      isSynced: true,
      syncedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'create', path);
  }
}

export async function deleteFromRemote(id: string) {
  const user = auth.currentUser;
  if (!user) return;

  const path = `users/${user.uid}/queries/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, 'delete', path);
  }
}
