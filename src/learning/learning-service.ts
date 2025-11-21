import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface FeedbackDetails {
  score: number;
  correction?: string | null;
  timestamp?: string;
}

export interface InteractionRecord {
  interaction_id: string;
  timestamp: string;
  user_message: string;
  detected_intent: string;
  adapters_queried: string[];
  adapter_responses: Record<string, unknown>;
  final_reply: string;
  latency_ms: number;
  feedback: FeedbackDetails | null;
}

interface LearningServiceOptions {
  logPath?: string;
  chromaUrl?: string;
  collectionName?: string;
  similarityK?: number;
  vectorStore?: VectorStore;
}

interface VectorSearchResult {
  score: number;
  metadata: Record<string, any>;
}

interface VectorStore {
  reset(): Promise<void> | void;
  upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> | void;
  similaritySearch(vector: number[], k: number): Promise<VectorSearchResult[]> | VectorSearchResult[];
}

class MemoryVectorStore implements VectorStore {
  private items: Array<{ id: string; vector: number[]; metadata: Record<string, any> }> = [];

  async reset(): Promise<void> {
    this.items = [];
  }

  async upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    this.items.push({ id, vector, metadata });
  }

  async similaritySearch(vector: number[], k: number): Promise<VectorSearchResult[]> {
    const scored = this.items.map(item => {
      const score = cosineSimilarity(vector, item.vector);
      return { score, metadata: item.metadata };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

class ChromaVectorStore implements VectorStore {
  private collectionPromise: Promise<any> | null = null;

  constructor(private url: string, private collectionName: string) {
    this.collectionPromise = this.init();
  }

  private async init() {
    try {
      const chroma = await import('chromadb');
      const client = new chroma.ChromaClient({ path: this.url });
      return client.getOrCreateCollection({ name: this.collectionName });
    } catch (err) {
      throw new Error(`Failed to initialize Chroma vector store: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async collection() {
    if (!this.collectionPromise) {
      throw new Error('Chroma collection not initialized');
    }
    return this.collectionPromise;
  }

  async reset(): Promise<void> {
    const collection = await this.collection();
    await collection.delete({});
  }

  async upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    const collection = await this.collection();
    await collection.add({ ids: [id], embeddings: [vector], metadatas: [metadata] });
  }

  async similaritySearch(vector: number[], k: number): Promise<VectorSearchResult[]> {
    const collection = await this.collection();
    const result = await collection.query({ queryEmbeddings: [vector], nResults: k });
    const ids = result.ids?.[0] || [];
    const distances = result.distances?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];

    return ids.map((_, idx) => ({
      score: 1 - (distances[idx] ?? 0),
      metadata: metadatas[idx] || {}
    }));
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class LearningService {
  private logPath: string;
  private interactions: InteractionRecord[] = [];
  private interactionIndex = new Map<string, InteractionRecord>();
  private vectorStore: VectorStore;
  private embeddingsReady = false;
  private similarityK: number;

  constructor(private options: LearningServiceOptions = {}) {
    const rootDir = path.resolve(process.cwd(), '../ns-node/data');
    this.logPath = options.logPath || process.env.NS_INTERACTIONS_LOG || path.join(rootDir, 'interactions.jsonl');
    this.vectorStore = options.vectorStore || this.buildVectorStore();
    this.similarityK = options.similarityK || 5;
  }

  private buildVectorStore(): VectorStore {
    if (this.options.chromaUrl) {
      return new ChromaVectorStore(this.options.chromaUrl, this.options.collectionName || 'neuroswarm-learning');
    }
    return new MemoryVectorStore();
  }

  async ingestLogs(): Promise<void> {
    if (!fs.existsSync(this.logPath)) {
      this.interactions = [];
      this.interactionIndex.clear();
      this.embeddingsReady = false;
      return;
    }

    const raw = fs.readFileSync(this.logPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const materialized = new Map<string, InteractionRecord>();

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'interaction') {
          materialized.set(event.interaction_id, {
            interaction_id: event.interaction_id,
            timestamp: event.timestamp,
            user_message: event.user_message || '',
            detected_intent: event.detected_intent || 'unknown',
            adapters_queried: event.adapters_queried || [],
            adapter_responses: event.adapter_responses || {},
            final_reply: event.final_reply || '',
            latency_ms: event.latency_ms || 0,
            feedback: event.feedback || null
          });
        } else if (event.type === 'feedback' && materialized.has(event.interaction_id)) {
          const existing = materialized.get(event.interaction_id)!;
          existing.feedback = {
            score: event.score,
            correction: event.correction,
            timestamp: event.timestamp
          };
        }
      } catch (err) {
        continue; // Skip malformed lines
      }
    }

    this.interactions = Array.from(materialized.values());
    this.interactionIndex = new Map(this.interactions.map(record => [record.interaction_id, record]));
    this.embeddingsReady = false;
  }

  async generateEmbeddings(): Promise<void> {
    if (!this.interactions.length) {
      await this.ingestLogs();
    }
    await this.vectorStore.reset();

    for (const interaction of this.interactions) {
      const text = `${interaction.user_message}\n${interaction.final_reply}`;
      const vector = this.embedText(text);
      await this.vectorStore.upsert(interaction.interaction_id, vector, {
        interaction_id: interaction.interaction_id,
        user_message: interaction.user_message,
        final_reply: interaction.final_reply,
        adapters_queried: interaction.adapters_queried
      });
    }

    this.embeddingsReady = true;
  }

  async recommendAdapter(query: string, limit = 3): Promise<string[]> {
    const ranked = await this.rankInteractions(query);
    const adapterScores = new Map<string, { score: number; count: number }>();

    for (const item of ranked) {
      const interaction = this.interactionIndex.get(item.metadata.interaction_id);
      if (!interaction) continue;
      const successBoost = interaction.feedback?.score === -1 ? -1 : 1;
      const adapterList = interaction.adapters_queried.length ? interaction.adapters_queried : ['duckduckgo-search'];
      for (const adapter of adapterList) {
        const entry = adapterScores.get(adapter) || { score: 0, count: 0 };
        entry.score += item.score * successBoost;
        entry.count += 1;
        adapterScores.set(adapter, entry);
      }
    }

    const sorted = Array.from(adapterScores.entries())
      .map(([adapter, stats]) => ({ adapter, value: stats.score / Math.max(1, stats.count) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map(item => item.adapter);

    return sorted;
  }

  async retrieveExemplars(query: string, limit = 3): Promise<Array<Pick<InteractionRecord, 'interaction_id' | 'user_message' | 'final_reply' | 'feedback'>>> {
    const ranked = await this.rankInteractions(query, limit);
    return ranked.map(result => {
      const interaction = this.interactionIndex.get(result.metadata.interaction_id);
      return interaction ? {
        interaction_id: interaction.interaction_id,
        user_message: interaction.user_message,
        final_reply: interaction.final_reply,
        feedback: interaction.feedback
      } : {
        interaction_id: result.metadata.interaction_id,
        user_message: result.metadata.user_message || '',
        final_reply: result.metadata.final_reply || '',
        feedback: null
      };
    });
  }

  identifyKnowledgeGaps(limit = 5): Array<{ topic: string; occurrences: number }> {
    const gapCounts = new Map<string, number>();
    for (const interaction of this.interactions) {
      const negative = interaction.feedback?.score === -1 || /couldn\'t find/i.test(interaction.final_reply);
      if (!negative) continue;
      const topic = normalizeTopic(interaction.user_message);
      gapCounts.set(topic, (gapCounts.get(topic) || 0) + 1);
    }
    return Array.from(gapCounts.entries())
      .map(([topic, occurrences]) => ({ topic, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  async getRecommendations(query: string) {
    const [adapters, exemplars] = await Promise.all([
      this.recommendAdapter(query),
      this.retrieveExemplars(query)
    ]);
    return { adapters, exemplars };
  }

  async rankInteractions(query: string, limit = this.similarityK): Promise<VectorSearchResult[]> {
    if (!this.embeddingsReady) {
      await this.generateEmbeddings();
    }
    const vector = this.embedText(query);
    const results = await this.vectorStore.similaritySearch(vector, Math.max(limit, this.similarityK));
    return results;
  }

  private embedText(text: string): number[] {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const vector = new Array(64).fill(0);
    for (const token of tokens) {
      const hash = createHash('md5').update(token).digest();
      for (let i = 0; i < vector.length; i++) {
        vector[i] += hash[i % hash.length] / 255;
      }
    }
    return vector;
  }
}

function normalizeTopic(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
}
