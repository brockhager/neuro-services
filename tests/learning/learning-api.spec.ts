import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { LearningService } from '../../src/learning/learning-service.js';

describe('learning service recommendations', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const loggerPath = path.resolve(__dirname, '..', '..', '..', 'neuroswarm', 'ns-node', 'logger.js');
  let createInteractionLogger: any;

  beforeAll(async () => {
    ({ createInteractionLogger } = await import(pathToFileURL(loggerPath).href));
  });

  it('updates adapter rankings after feedback', async () => {
    const tmpLog = path.join(os.tmpdir(), `learning-${Date.now()}.jsonl`);
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
    const logger = createInteractionLogger({ logPath: tmpLog });

    const idA = logger.recordInteraction({
      user_message: 'How do I reach consensus?',
      detected_intent: 'question',
      adapters_queried: ['alpha-adapter'],
      adapter_responses: {},
      final_reply: 'Use alpha',
      latency_ms: 400
    });
    logger.recordFeedback({ interaction_id: idA, score: 1 });

    const idB = logger.recordInteraction({
      user_message: 'How do I reach consensus?',
      detected_intent: 'question',
      adapters_queried: ['beta-adapter'],
      adapter_responses: {},
      final_reply: 'Maybe beta',
      latency_ms: 600
    });
    logger.recordFeedback({ interaction_id: idB, score: -1 });

    const service = new LearningService({ logPath: tmpLog });
    await service.ingestLogs();
    await service.generateEmbeddings();

    const initial = await service.recommendAdapter('consensus best');
    expect(initial[0]).toBe('alpha-adapter');

    logger.recordFeedback({ interaction_id: idA, score: -1 });
    logger.recordFeedback({ interaction_id: idB, score: 1 });

    await service.ingestLogs();
    await service.generateEmbeddings();

    const updated = await service.recommendAdapter('consensus best');
    expect(updated[0]).toBe('beta-adapter');
  });
});
