# neuro-services — APP-01: NeuroServiceController

This module contains the initial implementation of the NeuroServiceController and BillingReconciliationEngine.

Purpose:
- Provide a test-friendly, dependency-injectable service core for request processing, billing, and secure data access.
- Keep external SDK usage out of the controller internals for easier unit testing and CI.

Files:
- `src/NeuroServiceController.ts` — controller + billing engine implementation
- `src/NeuroServiceController.test.ts` — Jest unit tests (require dev dependencies)

Quick local dev notes:
- Install package dependencies for this package (from repo root):
  ```powershell
  cd neuro-services
  npm install
  npm run test
  ```

Design Notes:
- The controller accepts an injectable `DBClientLike` which provides `runTransaction`, `getDoc` and `setDoc`.
- This allows the server to use Firestore or any other transactional store at runtime with minimal adapter glue.
- Billing reconciliation is transactional and will abort on insufficient funds.
