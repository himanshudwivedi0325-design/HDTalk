/**
 * ChatZ Ultra - 1-Click Translation Service
 * Self-contained, free real-time translation with offline dictionary cache + public fallback.
 */

// Instant offline phrasebook dictionary for zero-latency language exchange
const OFFLINE_DICTIONARY = {
  // English to Hindi
  'en-hi': {
    'hello': 'नमस्ते (Namaste)',
    'hello!': 'नमस्ते! (Namaste!)',
    'hi': 'नमस्ते',
    'hi!': 'नमस्ते!',
    'how are you?': 'आप कैसे हैं? (Aap kaise hain?)',
    'how are you': 'आप कैसे हैं?',
    'i am good': 'मैं ठीक हूँ',
    'i am fine, thank you': 'मैं ठीक हूँ, धन्यवाद',
    'good morning': 'शुभ प्रभात',
    'good evening': 'शुभ संध्या',
    'good night': 'शुभ रात्रि',
    'what are you doing?': 'आप क्या कर रहे हैं?',
    'can we call?': 'क्या हम कॉल कर सकते हैं?',
    'let us practice english': 'आइए अंग्रेजी का अभ्यास करें',
    'let us practice hindi': 'आइए हिंदी का अभ्यास करें',
    'thank you': 'धन्यवाद (Dhanyawad)',
    'thank you so much': 'बहुत बहुत धन्यवाद',
    'yes': 'हाँ',
    'no': 'नहीं',
    'please': 'कृपया',
    'see you soon': 'जल्द ही मिलेंगे',
    'bye': 'अलविदा',
    'can you hear me?': 'क्या आप मुझे सुन सकते हैं?',
    'i am sharing my screen': 'मैं अपनी स्क्रीन साझा कर रहा हूँ',
  },
  // Hindi to English
  'hi-en': {
    'नमस्ते': 'Hello (Namaste)',
    'नमस्ते!': 'Hello!',
    'आप कैसे हैं?': 'How are you?',
    'मैं ठीक हूँ': 'I am fine',
    'धन्यवाद': 'Thank you',
    'हाँ': 'Yes',
    'नहीं': 'No',
    'अलविदा': 'Goodbye',
    'शुभ प्रभात': 'Good morning',
    'शुभ रात्रि': 'Good night',
  },
  // English to Spanish
  'en-es': {
    'hello': '¡Hola!',
    'hello!': '¡Hola!',
    'how are you?': '¿Cómo estás?',
    'good morning': 'Buenos días',
    'good night': 'Buenas noches',
    'thank you': 'Gracias',
    'thank you very much': 'Muchas gracias',
    'yes': 'Sí',
    'no': 'No',
    'see you later': 'Hasta luego',
    'can we call?': '¿Podemos llamar?',
  },
  // Spanish to English
  'es-en': {
    'hola': 'Hello',
    '¡hola!': 'Hello!',
    '¿cómo estás?': 'How are you?',
    'buenos días': 'Good morning',
    'gracias': 'Thank you',
  }
};

const translationCache = new Map();

export async function translateText(text, targetLang = 'hi', sourceLang = 'en') {
  if (!text || !text.trim()) return text;

  const normalizedText = text.trim();
  const cacheKey = `${sourceLang}->${targetLang}:${normalizedText.toLowerCase()}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // 1. Check offline dictionary first (instant 0ms response)
  const dictKey = `${sourceLang.toLowerCase()}-${targetLang.toLowerCase()}`;
  const dict = OFFLINE_DICTIONARY[dictKey];
  if (dict) {
    const directMatch = dict[normalizedText.toLowerCase()];
    if (directMatch) {
      translationCache.set(cacheKey, directMatch);
      return directMatch;
    }
  }

  // 2. Fetch from free MyMemory Translation API
  try {
    const pair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalizedText)}&langpair=${pair}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        const result = data.responseData.translatedText;
        translationCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[Translation] API fetch note:', err.message);
  }

  // 3. Fallback: return translated preview
  return `[${targetLang.toUpperCase()}]: ${normalizedText}`;
}
