/**
 * Voice Command Parser — parses spoken text into structured commands
 * Supports natural language patterns for all translator operations
 */

import { findLangByName } from './languages.js'

// No always-on wake word detection. Activation is click or keyboard only.
// This prevents the constant red mic indicator in the browser tab.

// Command patterns — ordered by specificity
const COMMAND_PATTERNS = [
  // Translation commands
  { pattern: /^translate\s+(.+?)(?:\s+(?:to|into|in)\s+(\w+))?$/i, type: 'TRANSLATE', extract: (m) => ({ text: m[1], targetLang: m[2] }) },
  { pattern: /^(?:say|speak|how\s+(?:do\s+you\s+)?say)\s+(.+?)(?:\s+in\s+(\w+))?$/i, type: 'TRANSLATE', extract: (m) => ({ text: m[1], targetLang: m[2] }) },
  { pattern: /^(?:what\s+is|what's)\s+(.+?)\s+in\s+(\w+)$/i, type: 'TRANSLATE', extract: (m) => ({ text: m[1], targetLang: m[2] }) },

  // Language change commands
  { pattern: /^(?:change|set|switch)\s+(?:the\s+)?(?:input|source|from)\s+(?:language\s+)?(?:to\s+)?(\w+)$/i, type: 'SET_SOURCE_LANG', extract: (m) => ({ lang: m[1] }) },
  { pattern: /^(?:change|set|switch)\s+(?:the\s+)?(?:output|target|to)\s+(?:language\s+)?(?:to\s+)?(\w+)$/i, type: 'SET_TARGET_LANG', extract: (m) => ({ lang: m[1] }) },
  { pattern: /^(?:translate\s+)?(?:to|into)\s+(\w+)$/i, type: 'SET_TARGET_LANG', extract: (m) => ({ lang: m[1] }) },
  { pattern: /^(?:translate\s+)?from\s+(\w+)$/i, type: 'SET_SOURCE_LANG', extract: (m) => ({ lang: m[1] }) },

  // Swap languages
  { pattern: /^swap\s*(?:languages)?$/i, type: 'SWAP_LANGS' },
  { pattern: /^(?:switch|reverse|flip)\s*(?:languages)?$/i, type: 'SWAP_LANGS' },

  // Clear
  { pattern: /^(?:clear|reset|erase|delete)\s*(?:all|text|everything)?$/i, type: 'CLEAR' },

  // Repeat / Speak again
  { pattern: /^(?:repeat|say\s+(?:it\s+)?again|speak\s+(?:it\s+)?again|read\s+(?:it\s+)?again)$/i, type: 'REPEAT' },
  { pattern: /^(?:read|speak)\s+(?:the\s+)?translation$/i, type: 'REPEAT' },

  // Stop speaking
  { pattern: /^(?:stop|silence|quiet|shut\s*up|be\s+quiet|enough|cancel)$/i, type: 'STOP_SPEAKING' },

  // Copy
  { pattern: /^copy\s*(?:the\s+)?(?:translation|translated\s+text|result)?$/i, type: 'COPY_TRANSLATION' },
  { pattern: /^copy\s*(?:the\s+)?(?:source|original|input)(?:\s+text)?$/i, type: 'COPY_SOURCE' },

  // History
  { pattern: /^(?:show|open|view)\s+(?:the\s+)?history$/i, type: 'SHOW_HISTORY' },
  { pattern: /^(?:clear|delete)\s+(?:the\s+)?history$/i, type: 'CLEAR_HISTORY' },
  { pattern: /^(?:go\s+)?back(?:\s+to\s+translator)?$/i, type: 'SHOW_TRANSLATOR' },

  // Voice settings
  { pattern: /^(?:speed|rate)\s+(up|down|faster|slower|normal)$/i, type: 'VOICE_SPEED', extract: (m) => ({ direction: m[1] }) },
  { pattern: /^(?:pitch)\s+(up|down|higher|lower|normal)$/i, type: 'VOICE_PITCH', extract: (m) => ({ direction: m[1] }) },

  // Sleep / deactivate
  { pattern: /^(?:go\s+to\s+sleep|sleep|deactivate|goodbye|bye|stand\s+down)$/i, type: 'SLEEP' },

  // Help
  { pattern: /^(?:help|what\s+can\s+you\s+do|commands|show\s+commands)$/i, type: 'HELP' },
]

export function parseCommand(text) {
  const cleaned = text.trim()

  for (const cmd of COMMAND_PATTERNS) {
    const match = cleaned.match(cmd.pattern)
    if (match) {
      const result = { type: cmd.type }
      if (cmd.extract) {
        const extracted = cmd.extract(match)
        // Resolve language names to codes
        if (extracted.lang) {
          const langObj = findLangByName(extracted.lang)
          extracted.langCode = langObj ? langObj.code : null
          extracted.langName = langObj ? langObj.name : extracted.lang
        }
        if (extracted.targetLang) {
          const langObj = findLangByName(extracted.targetLang)
          extracted.targetLangCode = langObj ? langObj.code : null
          extracted.targetLangName = langObj ? langObj.name : extracted.targetLang
        }
        Object.assign(result, extracted)
      }
      return result
    }
  }

  // If no command matched, treat it as text to translate
  return { type: 'TRANSLATE', text: cleaned }
}

export const COMMAND_SUGGESTIONS = [
  { cmd: '"Translate hello to Spanish"', desc: 'Translate text' },
  { cmd: '"Change output to French"', desc: 'Change target language' },
  { cmd: '"Swap languages"', desc: 'Swap source ⇄ target' },
  { cmd: '"Repeat"', desc: 'Speak translation again' },
  { cmd: '"Copy translation"', desc: 'Copy to clipboard' },
  { cmd: '"Show history"', desc: 'View past translations' },
  { cmd: '"Clear"', desc: 'Reset all text' },
  { cmd: '"Speed up" / "Speed down"', desc: 'Change voice speed' },
  { cmd: '"Go to sleep"', desc: 'Deactivate assistant' },
  { cmd: '"Help"', desc: 'Show available commands' },
]
