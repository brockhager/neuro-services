import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

describe('feedback endpoint helpers', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const loggerPath = path.resolve(__dirname, '..', '..', '..', 'neuroswarm', 'ns-node', 'logger.js');
  let createInteractionLogger: any;

  beforeAll(async () => {
    ({ createInteractionLogger } = await import(pathToFileURL(loggerPath).href));
  });

  it('links feedback to recorded interactions', () => {
    const tmpLog = path.join(os.tmpdir(), `feedback-${Date.now()}.jsonl`);
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
    const logger = createInteractionLogger({ logPath: tmpLog });

    const interactionId = logger.recordInteraction({
      user_message: 'Explain swarm consensus',
      detected_intent: 'question',
      adapters_queried: ['duckduckgo-search'],
      adapter_responses: {},
      final_reply: 'Consensus ensures agreement',
      latency_ms: 900
    });

    logger.recordFeedback({ interaction_id: interactionId, score: -1, correction: 'Consensus also needs voting math' });

    const materialized = logger.materializeInteractions();
    expect(materialized[0].feedback).toMatchObject({
      score: -1,
      correction: 'Consensus also needs voting math'
    });
  });
});
