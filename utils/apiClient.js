/**
 * API Client — Google Gemini via @google/genai SDK
 * Shared utility for all LLM calls with retry logic for rate limits.
 */

const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-3.1-flash-lite-preview';

let _ai = null;

function getAI() {
    if (!_ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
}

/**
 * Call Gemini with automatic retry on rate-limit (429) and server errors (503).
 *
 * @param {Object} options
 * @param {Array}  options.messages  — [{role, content}, …]  (OpenAI-style; converted internally)
 * @param {number} [options.maxTokens=2000]
 * @param {number} [options.temperature=0.5]
 * @param {number} [options.maxRetries=5]
 * @param {string} [options.label='API call']
 * @returns {string} The generated text
 */
async function callLLM(options) {
    const {
        messages,
        maxTokens = 2000,
        temperature = 0.5,
        maxRetries = 5,
        label = 'API call'
    } = options;

    // Convert OpenAI-style messages → Gemini format
    // Gemini expects: systemInstruction (string) + contents [{role:'user'|'model', parts:[{text}]}]
    let systemInstruction = '';
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction += (systemInstruction ? '\n' : '') + msg.content;
        } else {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    }

    // Google Gemini Free Tier is 15 RPM. Let's use longer delays.
    const delays = [15000, 20000, 30000, 45000, 60000];
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = delays[Math.min(attempt - 1, delays.length - 1)];
                console.log(`[${label}] Retry ${attempt + 1}/${maxRetries} — waiting ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }

            const ai = getAI();
            const config = {
                temperature,
                maxOutputTokens: maxTokens
            };

            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
                config,
                ...(systemInstruction ? { systemInstruction } : {})
            });

            const text = response.text;
            if (!text) throw new Error('Empty response from Gemini');
            return text.trim();
        } catch (err) {
            lastError = err;
            const status = err.status || err.code;
            const msg = err.message || String(err);
            console.warn(`[${label}] Attempt ${attempt + 1} failed: ${status || 'error'} — ${msg}`);

            // Only retry on rate limit (429) or service unavailable (503)
            if (status !== 429 && status !== 503 && !msg.includes('429') && !msg.includes('503') && !msg.includes('RESOURCE_EXHAUSTED')) {
                break;
            }
        }
    }

    const msg = lastError?.message || String(lastError);
    throw new Error(`${label} failed after ${maxRetries} attempts: ${msg}`);
}

module.exports = { callLLM, MODEL };
