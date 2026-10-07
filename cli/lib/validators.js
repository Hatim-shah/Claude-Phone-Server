import axios from 'axios';

// Known Deepgram TTS models (Aura + Aura-2 English)
const DEEPGRAM_VOICES = new Set([
  'aura-angus-en', 'aura-arcas-en', 'aura-asteria-en', 'aura-athena-en',
  'aura-helios-en', 'aura-hera-en', 'aura-luna-en', 'aura-orion-en',
  'aura-orpheus-en', 'aura-perseus-en', 'aura-stella-en', 'aura-zeus-en',
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
]);

/**
 * Validate Deepgram API key by making a test request
 * @param {string} apiKey - Deepgram API key
 * @returns {Promise<{valid: boolean, error?: string}>} Validation result
 */
export async function validateDeepgramKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      error: 'API key cannot be empty'
    };
  }

  try {
    const response = await axios.get('https://api.deepgram.com/v1/projects', {
      headers: {
        'Authorization': `Token ${apiKey}`
      },
      timeout: 10000
    });

    if (response.status === 200) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Unexpected status: ${response.status}`
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        return {
          valid: false,
          error: 'Invalid API key (401 Unauthorized)'
        };
      }
      return {
        valid: false,
        error: `API error: ${error.response.status} ${error.response.statusText}`
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        valid: false,
        error: 'Request timeout - check your internet connection'
      };
    }

    return {
      valid: false,
      error: `Network error: ${error.message}`
    };
  }
}

/**
 * Validate SIP extension format
 * @param {string} extension - SIP extension number
 * @returns {boolean} True if valid
 */
export function validateExtension(extension) {
  return /^\d{4,5}$/.test(extension);
}

/**
 * Validate IP address format
 * @param {string} ip - IP address
 * @returns {boolean} True if valid
 */
export function validateIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate hostname format
 * @param {string} hostname - Hostname or FQDN
 * @returns {boolean} True if valid
 */
export function validateHostname(hostname) {
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  return hostnameRegex.test(hostname);
}

/**
 * Validate Deepgram TTS voice/model ID
 * @param {string} apiKey - Deepgram API key (unused; kept for call-site compatibility)
 * @param {string} voiceId - Deepgram model name (e.g. aura-2-orpheus-en)
 * @returns {Promise<{valid: boolean, name?: string, error?: string}>} Validation result
 */
export async function validateVoiceId(apiKey, voiceId) {
  if (!voiceId || voiceId.trim() === '') {
    return {
      valid: false,
      error: 'Voice ID cannot be empty'
    };
  }

  const model = voiceId.trim();

  // Accept known models, or Aura-style names (allows newer models without a code update)
  if (DEEPGRAM_VOICES.has(model) || /^aura(-2)?-[a-z]+-[a-z]{2}$/i.test(model)) {
    return {
      valid: true,
      name: model
    };
  }

  return {
    valid: false,
    error: 'Unknown Deepgram voice model (expected e.g. aura-2-orpheus-en)'
  };
}
