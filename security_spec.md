# Security Specification for Curro Exam Timetable

## Data Invariants
1. A **User** profile must be linked to their Auth UID.
2. Only **Admins** or **Webmasters** can modify other users' roles or critical data.
3. **Leave Requests** can be created by any authenticated user for themselves, but only approved/denied by Admins.
4. **Exam Sessions**, **Venues**, and **Timetable Entries** are strictly managed by Admins.
5. **Venues** must have a non-empty name and a capacity greater than zero.

## The "Dirty Dozen" Payloads (Attack Vectors)
1. **Identity Spoofing**: User A tries to create a user profile for User B.
2. **Role Escalation**: User A tries to update their own `roles` to `['ADMIN']`.
3. **Orphaned Leave**: User A tries to create a leave request for a non-existent teacher ID.
4. **Status Shortcutting**: User A tries to "Approve" their own leave request.
5. **Venue Poisoning**: User A (non-admin) tries to create a venue with 1,000,000 capacity.
6. **Session Hijacking**: User A tries to delete an exam session.
7. **Timetable Tampering**: User A tries to update a timetable entry to add a restricted staff member.
8. **Shadow Fields**: User A tries to inject `isGod: true` into their user document.
9. **Blanket Read Attack**: User A tries to list all users' private details (if we had any).
10. **ID Poisoning**: User A tries to create a venue with a 2MB string as ID.
11. **Timestamp Spoofing**: User A tries to set a `createdAt` date in the future (managed by server time).
12. **Recursive Cost Attack**: User A tries to trigger rules that perform infinite lookups (prevented by order of evaluation).

## Test Runner (Logic Verification)
A complete `firestore.rules.test.ts` would verify these, but since I cannot run a test suite directly in this env without setup, I will perform a mental audit and manual verification via refined rules.
