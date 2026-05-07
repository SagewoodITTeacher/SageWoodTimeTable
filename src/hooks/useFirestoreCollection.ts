import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
}

export function useFirestoreCollection<T extends { id?: string }>(
  name: string,
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as T,
        );
        setData(docs);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, name);
      },
    );
    return () => unsub();
  }, [name]);

  return { data, loading };
}
