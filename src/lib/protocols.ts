import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';
import { Protocol } from '../types';

const COLLECTION_NAME = 'protocols';

export async function saveProtocol(protocol: Protocol) {
  const path = `${COLLECTION_NAME}/${protocol.id}`;
  try {
    await setDoc(doc(db, path), {
      ...protocol,
      lastUpdated: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, 'write', path);
  }
}

export async function getAllProtocols(): Promise<Protocol[]> {
  const path = COLLECTION_NAME;
  try {
    const q = query(collection(db, path), orderBy('lastUpdated', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Protocol);
  } catch (error) {
    handleFirestoreError(error, 'list', path);
  }
}

export async function deleteProtocol(id: string) {
  const path = `${COLLECTION_NAME}/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, 'delete', path);
  }
}
