/**
 * Deepgram Speech-to-Text Client
 * Converts audio buffers (L16 PCM from FreeSWITCH) to text via Deepgram Listen API
 */

const axios = require('axios');
const WaveFile = require('wavefile').WaveFile;
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_STT_MODEL = process.env.DEEPGRAM_STT_MODEL || 'nova-3';
const DEEPGRAM_LISTEN_URL = 'https://api.deepgram.com/v1/listen';

/**
 * Convert L16 PCM buffer to WAV format for Deepgram API
 * @param {Buffer} pcmBuffer - Raw L16 PCM audio data
 * @param {number} sampleRate - Sample rate (default: 8000 Hz for telephony)
 * @returns {Buffer} WAV file buffer
 */
function pcmToWav(pcmBuffer, sampleRate = 8000) {
  const wav = new WaveFile();

  // Convert Buffer to Int16Array for wavefile library
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

  // Create WAV from raw PCM data
  wav.fromScratch(1, sampleRate, '16', samples);

  return Buffer.from(wav.toBuffer());
}

/**
 * Transcribe audio using Deepgram Listen API
 * @param {Buffer} audioBuffer - Audio data (either WAV or raw PCM)
 * @param {Object} options - Transcription options
 * @param {string} options.format - Input format: "wav" or "pcm" (default: "pcm")
 * @param {number} options.sampleRate - Sample rate for PCM (default: 8000)
 * @param {string} options.language - Language code (default: "en")
 * @returns {Promise<string>} Transcribed text
 */
async function transcribe(audioBuffer, options = {}) {
  const {
    format = 'pcm',
    sampleRate = 8000,
    language = 'en'
  } = options;

  if (!DEEPGRAM_API_KEY) {
    throw new Error('Deepgram API key not configured (DEEPGRAM_API_KEY)');
  }

  // Convert PCM to WAV if needed
  let wavBuffer;
  if (format === 'pcm') {
    wavBuffer = pcmToWav(audioBuffer, sampleRate);
  } else {
    wavBuffer = audioBuffer;
  }

  // Write to temp file for debugging / cleanup parity with previous Whisper flow
  const tempFile = path.join(os.tmpdir(), 'deepgram-stt-' + Date.now() + '.wav');
  fs.writeFileSync(tempFile, wavBuffer);

  try {
    const response = await axios({
      method: 'POST',
      url: DEEPGRAM_LISTEN_URL,
      params: {
        model: DEEPGRAM_STT_MODEL,
        language,
        smart_format: true,
        punctuate: true
      },
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav'
      },
      data: wavBuffer,
      responseType: 'json',
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const transcript =
      response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    const timestamp = new Date().toISOString();
    const preview = transcript.substring(0, 100) + (transcript.length > 100 ? '...' : '');
    console.log('[' + timestamp + '] DEEPGRAM STT Transcribed: ' + preview);

    return transcript;
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) {
      throw new Error('Deepgram API authentication failed - check API key');
    }
    if (status === 429) {
      throw new Error('Deepgram API rate limit exceeded');
    }
    throw new Error(`Deepgram STT failed: ${error.message}`);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if Deepgram STT is configured and available
 * @returns {boolean} True if API key is set
 */
function isAvailable() {
  return !!DEEPGRAM_API_KEY;
}

module.exports = {
  transcribe,
  pcmToWav,
  isAvailable
};
