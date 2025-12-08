import { NeuroServiceController, BillingReconciliationEngine, ServiceAdapter } from './NeuroServiceController';

class FakeTx {
  private store: Record<string, any>;
  public updates: Record<string, any> = {};
  public sets: Record<string, any> = {};

  constructor(store: Record<string, any>) { this.store = store; }
  async get(ref: string) {
    const exists = !!this.store[ref];
    return { exists, data: this.store[ref] };
  }
  update(ref: string, data: any) { this.updates[ref] = data; }
  set(ref: string, data: any) { this.sets[ref] = data; }
}

class FakeDB {
  private store: Record<string, any> = {};
  constructor(initial: Record<string, any> = {}) { this.store = initial; }
  async runTransaction<T>(fn: (tx: any) => Promise<T>) {
    const tx = new FakeTx(this.store);
    return fn(tx);
  }
  async getDoc(ref: string) { const v = this.store[ref]; return { exists: !!v, data: v } }
  async setDoc(ref: string, data: any) { this.store[ref] = data }
}

describe('NeuroServiceController + BillingReconciliationEngine', () => {
  it('reconciles billing and updates balance in transaction', async () => {
    const userRef = 'artifacts/default-app-id/users/user1';
    const initialStore = { [userRef]: { balance: 100 } };

    const db = new FakeDB(initialStore as any);
    const controller = new NeuroServiceController(db as any);

    // Adapter: cost 10 per unit, returns data and estimatedUnits=3
    const adapter: ServiceAdapter = {
      id: 'test-adapter',
      name: 'TestAdapter',
      getCostPerUnit: () => 10,
      async execute(input: any) { return { data: { echo: input }, estimatedUnits: 3 }; }
    };

    controller.registerAdapter(adapter);

    const res = await controller.processServiceRequest('user1', 'test-adapter', { x: 1 });
    expect(res.result).toEqual({ echo: { x: 1 } });
    // cost = 10 * 3 = 30; new balance = 100 - 30 = 70
    expect(res.balance).toBe(70);
  });

  it('throws if adapter not found', async () => {
    const db = new FakeDB({} as any);
    const controller = new NeuroServiceController(db as any);
    await expect(controller.processServiceRequest('user-not-found', 'missing', {})).rejects.toThrow('Service adapter');
  });
});
