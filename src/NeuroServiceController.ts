/**
 * neuro-services/src/NeuroServiceController.ts
 * APP-01: Core business logic service for user requests, billing, and secure data access.
 *
 * This module provides a test-friendly, dependency-injectable controller so the
 * service can run in environments without a real Firestore instance during unit tests.
 */

export interface DBTransactionLike {
  get(ref: any): Promise<any>;
  update(ref: any, data: any): void;
  set(ref: any, data: any): void;
}

export interface DBClientLike {
  runTransaction<T>(fn: (tx: DBTransactionLike) => Promise<T>): Promise<T>;
  getDoc(ref: any): Promise<any>;
  setDoc(ref: any, data: any): Promise<void>;
}

export interface ServiceAdapter {
  id: string;
  name: string;
  execute(input: any, tx?: DBTransactionLike): Promise<{ data: any; estimatedUnits?: number }>;
  getCostPerUnit(): number;
}

export class BillingReconciliationEngine {
  private db: DBClientLike;
  private appId: string;

  constructor(db: DBClientLike, appId = 'default-app-id') {
    this.db = db;
    this.appId = appId;
  }

  private userDocRef(userId: string) {
    return `artifacts/${this.appId}/users/${userId}`;
  }

  private billingHistoryRef(userId: string) {
    return `artifacts/${this.appId}/users/${userId}/billing_history`;
  }

  public async reconcileBilling(userId: string, adapter: ServiceAdapter, unitsUsed: number, tx: DBTransactionLike): Promise<number> {
    const cost = adapter.getCostPerUnit() * unitsUsed;
    const userRef = this.userDocRef(userId);

    const userDoc = await tx.get(userRef);
    if (!userDoc || !userDoc.exists) throw new Error('User profile not found for billing.');

    const currentBalance = (userDoc.data && userDoc.data.balance) || 0;
    const newBalance = currentBalance - cost;
    if (newBalance < 0) throw new Error('Insufficient funds. Billing halted.');

    tx.update(userRef, { balance: newBalance });

    // Add billing history (simulate new doc id)
    const historyRef = `${this.billingHistoryRef(userId)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tx.set(historyRef, {
      timestamp: Date.now(),
      serviceId: adapter.id,
      unitsUsed,
      cost,
      newBalance,
    });

    return newBalance;
  }
}

export class NeuroServiceController {
  private db: DBClientLike;
  private billing: BillingReconciliationEngine;
  private adapters: Map<string, ServiceAdapter> = new Map();

  constructor(dbClient: DBClientLike, appId = 'default-app-id') {
    this.db = dbClient;
    this.billing = new BillingReconciliationEngine(dbClient, appId);
  }

  registerAdapter(adapter: ServiceAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  async getSecureUserConfig(userId: string) {
    const ref = `artifacts/default-app-id/users/${userId}/private_settings/config`;
    const doc = await this.db.getDoc(ref);
    if (!doc || !doc.exists) return { message: 'No secure configuration found.' };
    return doc.data;
  }

  async processServiceRequest(userId: string, serviceId: string, payload: any) {
    const adapter = this.adapters.get(serviceId);
    if (!adapter) throw new Error(`Service adapter '${serviceId}' not found.`);

    return await this.db.runTransaction(async (tx) => {
      const exec = await adapter.execute(payload, tx);
      const units = exec.estimatedUnits ?? 1;
      const newBalance = await this.billing.reconcileBilling(userId, adapter, units, tx);
      return { result: exec.data, balance: newBalance };
    });
  }
}

export default { NeuroServiceController, BillingReconciliationEngine };
