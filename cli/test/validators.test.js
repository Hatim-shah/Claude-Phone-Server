import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateDeepgramKey,
  validateVoiceId
} from '../lib/validators.js';

test('validators module', async (t) => {
  await t.test('validateDeepgramKey rejects empty key', async () => {
    const result = await validateDeepgramKey('');
    assert.strictEqual(result.valid, false);
    assert.match(result.error, /API key cannot be empty/);
  });

  await t.test('validateDeepgramKey rejects invalid format', async () => {
    const result = await validateDeepgramKey('invalid-key');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
  });

  await t.test('validateVoiceId accepts Deepgram model names', async () => {
    const result = await validateVoiceId('unused', 'aura-2-orpheus-en');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.name, 'aura-2-orpheus-en');
  });

  await t.test('validateVoiceId rejects empty voice', async () => {
    const result = await validateVoiceId('unused', '');
    assert.strictEqual(result.valid, false);
  });

  // Note: We can't test successful API key validation without real API keys
  // These would be integration tests, not unit tests
});
