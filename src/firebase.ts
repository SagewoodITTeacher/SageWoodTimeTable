/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json';
import { sanitizeError } from './lib/sanitize-error';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();

/**
 * Validates connection to Firestore. Dev-only.
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client appears offline. Check Firebase config.');
    }
  }
}

if (import.meta.env.DEV) {
  testConnection();
}

/**
 * Standard Error Handler for Firestore operations.
 *
 * Sanitizes error messages — strips email-shaped strings and 28-char Firebase
 * UIDs — and never logs auth user details. Authentication PII MUST NOT reach
 * the browser console or any error-tracking pipeline.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  code: string;
  operationType: OperationType;
  path: string | null;
  message: string;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const { code, message } = sanitizeError(error);
  const errInfo: FirestoreErrorInfo = { code, operationType, path, message };
  console.error('Firestore Error:', errInfo);
  throw new Error(JSON.stringify(errInfo));
}
