/**
 * Deepgram Text-to-Speech Service (Aura)
 * Generates speech audio files and returns URLs for FreeSWITCH playback
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/speak';

// Default Aura-2 voice model (override with DEEPGRAM_VOICE_ID or per-device voiceId)
const DEFAULT_VOICE_ID = process.env.DEEPGRAM_VOICE_ID || 'aura-2-orpheus-en';

// Known Deepgram TTS models (Aura + Aura-2)
const KNOWN_VOICES = [
  // Aura-1
  'aura-angus-en', 'aura-arcas-en', 'aura-asteria-en', 'aura-athena-en',
  'aura-helios-en', 'aura-hera-en', 'aura-luna-en', 'aura-orion-en',
  'aura-orpheus-en', 'aura-perseus-en', 'aura-stella-en', 'aura-zeus-en',
  // Aura-2 English
  'aura-2-amalthea-en', 'aura-2-andromeda-en', 'aura-2-apollo-en', 'aura-2-arcas-en',
  'aura-2-aries-en', 'aura-2-asteria-en', 'aura-2-athena-en', 'aura-2-atlas-en',
  'aura-2-aurora-en', 'aura-2-callista-en', 'aura-2-cordelia-en', 'aura-2-cora-en',
  'aura-2-delia-en', 'aura-2-draco-en', 'aura-2-electra-en', 'aura-2-harmonia-en',
  'aura-2-helena-en', 'aura-2-hera-en', 'aura-2-hermes-en', 'aura-2-hyperion-en',
  'aura-2-iris-en', 'aura-2-janus-en', 'aura-2-juno-en', 'aura-2-jupiter-en',
  'aura-2-luna-en', 'aura-2-mars-en', 'aura-2-minerva-en', 'aura-2-neptune-en',
  'aura-2-odysseus-en', 'aura-2-ophelia-en', 'aura-2-orion-en', 'aura-2-orpheus-en',
  'aura-2-pandora-en', 'aura-2-phoebe-en', 'aura-2-pluto-en', 'aura-2-saturn-en',
  'aura-2-selene-en', 'aura-2-thalia-en', 'aura-2-theia-en', 'aura-2-vesta-en',
  'aura-2-zeus-en'
];

// Audio output directory (set via setAudioDir)
let audioDir = path.join(__dirname, '../audio-temp');

/**
 * Set the audio output directory
 * @param {string} dir - Absolute path to audio directory
 */
function setAudioDir(dir) {
  audioDir = dir;

  // Create directory if it doesn't exist
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    logger.info('Created audio directory', { path: audioDir });
  }
}

/**
 * Generate unique filename for audio file
 * @param {string} text - Text being converted
 * @returns {string} Filename (without path)
 */
function generateFilename(text) {
  // Hash text to create unique identifier
  const hash = crypto.createHash('md5').update(text).digest('hex').substring(0, 8);
  const timestamp = Date.now();
  return `tts-${timestamp}-${hash}.mp3`;
}

/**
 * Convert text to speech using Deepgram Aura TTS
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Deepgram model name (e.g. aura-2-orpheus-en)
 * @returns {Promise<string>} HTTP URL to audio file
 */
async function generateSpeech(text, voiceId = DEFAULT_VOICE_ID) {
  const startTime = Date.now();
  const model = voiceId || DEFAULT_VOICE_ID;

  try {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable not set');
    }

    logger.info('Generating speech with Deepgram', {
      textLength: text.length,
      model
    });

    // Call Deepgram Speak API
    const response = await axios({
      method: 'POST',
      url: DEEPGRAM_API_URL,
      params: {
        model,
        encoding: 'mp3'
      },
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: { text },
      responseType: 'arraybuffer'
    });

    // Generate filename and save audio
    const filename = generateFilename(text);
    const filepath = path.join(audioDir, filename);

    fs.writeFileSync(filepath, response.data);

    const latency = Date.now() - startTime;
    const fileSize = response.data.length;

    logger.info('Speech generation successful', {
      filename,
      fileSize,
      latency,
      textLength: text.length
    });

    // Return HTTP URL (assumes audio-temp is served via HTTP)
    // Format: http://localhost:PORT/audio/filename.mp3
    // The HTTP server setup is handled elsewhere
    const audioUrl = `http://127.0.0.1:3000/audio-files/${filename}`;

    return audioUrl;

  } catch (error) {
    const latency = Date.now() - startTime;

    logger.error('Speech generation failed', {
      error: error.message,
      latency,
      textLength: text?.length,
      responseStatus: error.response?.status,
      responseData: error.response?.data?.toString()
    });

    // Handle specific errors
    if (error.response?.status === 401) {
      throw new Error('Deepgram API authentication failed - check API key');
    } else if (error.response?.status === 429) {
      throw new Error('Deepgram API rate limit exceeded');
    } else if (error.response?.status === 400) {
      throw new Error('Invalid request to Deepgram API');
    }

    throw new Error(`TTS generation failed: ${error.message}`);
  }
}

/**
 * Clean up old audio files (older than specified age)
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
function cleanupOldFiles(maxAgeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = fs.readdirSync(audioDir);

    let deletedCount = 0;
    files.forEach(file => {
      if (!file.startsWith('tts-') || !file.endsWith('.mp3')) {
        return;
      }

      const filepath = path.join(audioDir, file);
      const stats = fs.statSync(filepath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      logger.info('Cleaned up old audio files', { deletedCount });
    }

  } catch (error) {
    logger.warn('Failed to cleanup old audio files', { error: error.message });
  }
}

/**
 * Get list of available Deepgram TTS voices
 * @returns {Promise<Array>} Array of voice objects
 */
async function getAvailableVoices() {
  return KNOWN_VOICES.map(model => ({
    voice_id: model,
    name: model
  }));
}

// Initialize audio directory
setAudioDir(audioDir);

// Setup periodic cleanup (every 30 minutes)
setInterval(() => {
  cleanupOldFiles();
}, 30 * 60 * 1000);

module.exports = {
  generateSpeech,
  setAudioDir,
  cleanupOldFiles,
  getAvailableVoices,
  KNOWN_VOICES
};
