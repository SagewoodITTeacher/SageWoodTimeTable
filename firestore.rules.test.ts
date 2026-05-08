// firestore.rules.test.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc, getDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-curro',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedUser(uid: string, roles: string[]) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}`), {
      id: uid,
      firstName: 'T',
      lastName: 'Test',
      roles,
    });
  });
}

describe('isAdmin', () => {
  it('admin can write venues', async () => {
    await seedUser('admin1', ['ADMIN']);
    const ctx = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'venues/v1'), {
        id: 'v1', name: 'Hall A', type: 'Hall', capacity: 100,
      })
    );
  });

  it('non-admin cannot write venues', async () => {
    await seedUser('teacher1', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('teacher1').firestore();
    await assertFails(
      setDoc(doc(ctx, 'venues/v2'), {
        id: 'v2', name: 'Hall B', type: 'Hall', capacity: 100,
      })
    );
  });

  it('signed-in but no user doc cannot write venues', async () => {
    const ctx = testEnv.authenticatedContext('ghost').firestore();
    await assertFails(
      setDoc(doc(ctx, 'venues/v3'), {
        id: 'v3', name: 'Hall C', type: 'Hall', capacity: 100,
      })
    );
  });
});

describe('isWebmaster', () => {
  it('webmaster cannot write subjects (subjects require ADMIN)', async () => {
    await seedUser('wm1', ['WEBMASTER']);
    const ctx = testEnv.authenticatedContext('wm1').firestore();
    // Subject writes are gated by isAdmin() in the current rules; this test
    // documents that intent and proves Webmaster does NOT silently inherit it.
    await assertFails(
      setDoc(doc(ctx, 'subjects/s1'), { code: 'X', name: 'X' })
    );
  });
});

describe('isOperationalManager', () => {
  it('OM can create marking extensions', async () => {
    await seedUser('om1', ['OPERATIONAL_MANAGER']);
    const ctx = testEnv.authenticatedContext('om1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'markingExtensions/m1'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 'om1',
      })
    );
  });

  it('Teacher cannot create marking extensions', async () => {
    await seedUser('t1', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('t1').firestore();
    await assertFails(
      setDoc(doc(ctx, 'markingExtensions/m2'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 't1',
      })
    );
  });
});

describe('isApprover', () => {
  it('approver can update marking extension', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/ap1'), {
        id: 'ap1', firstName: 'A', lastName: 'P',
        roles: ['OPERATIONAL_MANAGER'], canApproveExtensions: true,
      });
      await setDoc(doc(ctx.firestore(), 'markingExtensions/m3'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'PENDING', additionalGreenDays: 2, requestedBy: 'ap1',
      });
    });
    const ctx = testEnv.authenticatedContext('ap1').firestore();
    await assertSucceeds(
      setDoc(doc(ctx, 'markingExtensions/m3'), {
        entryId: 'e1', subject: 'MATH', grade: 8, requestDate: '2026-05-07',
        reason: 'illness', status: 'APPROVED', additionalGreenDays: 2, requestedBy: 'ap1',
      })
    );
  });
});

describe('role escalation', () => {
  it('non-admin cannot grant themselves ADMIN role', async () => {
    await seedUser('victim', ['TEACHER']);
    const ctx = testEnv.authenticatedContext('victim').firestore();
    await assertFails(
      setDoc(doc(ctx, 'users/victim'), {
        id: 'victim', firstName: 'T', lastName: 'Test', roles: ['ADMIN'],
      })
    );
  });
});

describe('anonymous session', () => {
  it('anonymous (no auth) cannot read users', async () => {
    const ctx = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(ctx, 'users/anyone')));
  });
});
