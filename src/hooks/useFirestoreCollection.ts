import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useFirestoreCollection<T extends { id?: string }>(
  name: string,
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as T,
        );
        setData(docs);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setError(err instanceof Error ? err : new Error(String(err)));
        // We log it but don't re-throw here to avoid crashing the component
        console.error(`Firestore listener error on ${name}:`, err);
      },
    );
    return () => unsub();
  }, [name]);

  return { data, loading, error };
}
