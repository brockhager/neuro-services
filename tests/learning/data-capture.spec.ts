import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

describe('interaction logging', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const loggerPath = path.resolve(__dirname, '..', '..', '..', 'neuroswarm', 'ns-node', 'logger.js');
  let createInteractionLogger: any;

  beforeAll(async () => {
    ({ createInteractionLogger } = await import(pathToFileURL(loggerPath).href));
  });

  it('writes structured interaction records', () => {
    const tmpLog = path.join(os.tmpdir(), `interaction-${Date.now()}.jsonl`);
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
    const logger = createInteractionLogger({ logPath: tmpLog });

    const interactionId = logger.recordInteraction({
      user_message: 'What is the status of node A?',
      detected_intent: 'question',
      adapters_queried: ['duckduckgo-search'],
      adapter_responses: {},
      final_reply: 'Node A is online',
      latency_ms: 1200
    });

    const materialized = logger.materializeInteractions();
    expect(materialized).toHaveLength(1);
    expect(materialized[0]).toMatchObject({
      interaction_id: interactionId,
      user_message: 'What is the status of node A?',
      detected_intent: 'question',
      latency_ms: 1200
    });
  });
});
