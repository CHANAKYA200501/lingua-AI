# 🌐 LinguaAI — AI-Powered Real-Time Translator

> Built for **Pinnacle Labs Internship** — A JARVIS-style AI translator with voice wake word ("Hey Chanakya"), live conversation translation, background mode, and PWA support for Android/iOS.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003b57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)]()

---

## ✨ Features

| Feature | Details |
|---|---|
| 🌍 **47 Languages** | Full language matrix including Hindi, Japanese, Arabic, Tamil, and more |
| 🎤 **"Hey Chanakya" Wake Word** | Hands-free activation with voice biometric verification |
| 🔊 **Bold Female Voice** | Auto-selects female TTS voice with commanding tone |
| 🔴 **Live Conversation Translation** | Real-time speech capture, translation, and subtitles |
| 🛡️ **Background Mode** | Keeps listening even when tab is hidden or phone is locked |
| 📱 **PWA (Android + iOS)** | Installable on home screen with offline support |
| 📊 **AI Summary** | Post-conversation analytics with speaker stats |
| 📥 **Export (TXT/PDF)** | Download conversation transcripts |
| 🕐 **Auto-translate** | Smart 900ms debounce for seamless real-time translation |
| 📋 **History Panel** | Full translation history with SQLite persistence |

---

## 🏗️ Architecture

```
translator/
├── frontend/              # React 18 + Vite (PWA)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx           ← Nav with mobile bottom bar
│   │   │   ├── JarvisOrb.jsx        ← JARVIS-style interactive orb
│   │   │   ├── TranslatorPanel.jsx  ← Core translation UI
│   │   │   ├── LiveTranslation.jsx  ← Real-time live engine
│   │   │   ├── HistoryPanel.jsx     ← History management
│   │   │   ├── VoiceEnrollment.jsx  ← Voice training modal
│   │   │   ├── StatsBar.jsx
│   │   │   └── Background.jsx
│   │   ├── hooks/
│   │   │   ├── useSpeechSynthesis.js   ← Bold female TTS
│   │   │   ├── useVoiceProfile.js      ← Voice biometrics
│   │   │   └── useBackgroundService.js ← Background persistence
│   │   ├── utils/
│   │   │   ├── commandParser.js     ← Voice command parser
│   │   │   ├── languages.js         ← Language codes & flags
│   │   │   └── soundEffects.js      ← UI sound effects
│   │   ├── App.jsx                  ← Main state machine
│   │   └── App.css                  ← Full responsive design
│   ├── public/
│   │   ├── manifest.json   ← PWA manifest
│   │   ├── sw.js            ← Service worker
│   │   └── icon-512.png     ← App icon
│   ├── vite.config.js       ← Proxy → :8000
│   └── package.json
│
├── backend/               # FastAPI + Python
│   ├── main.py            ← All API routes + /api/summarize
│   ├── requirements.txt
│   └── translations.db    ← Auto-created SQLite
│
└── README.md
```

---

## 🚀 Quick Start

### Option A: Using shell scripts

```bash
# Terminal 1 — Backend
chmod +x start-backend.sh
./start-backend.sh

# Terminal 2 — Frontend
chmod +x start-frontend.sh
./start-frontend.sh
```

### Option B: Manual commands (any editor / terminal)

**Terminal 1 — Start Backend:**

```bash
cd /Users/chanakya01/Documents/translator/backend
pip install fastapi uvicorn deep-translator langdetect
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Start Frontend:**

```bash
cd /Users/chanakya01/Documents/translator/frontend
npm install
npm run dev
```

**Then open:** [http://localhost:3000](http://localhost:3000) in **Chrome**

> ⚠️ **Chrome is required** — Speech Recognition API is only fully supported in Chrome/Edge.

---

## 📱 Install on Phone (PWA)

| Platform | Steps |
|---|---|
| **Android** | Open `http://<your-ip>:3000` in Chrome → Menu (⋮) → **Add to Home Screen** |
| **iOS** | Open `http://<your-ip>:3000` in Safari → Share (↗) → **Add to Home Screen** |

> To access from phone: replace `localhost` with your Mac's IP address.  
> Find it with: `ifconfig | grep "inet " | grep -v 127.0.0.1`

---

## 🎙️ Voice Commands

| Say this... | Action |
|---|---|
| "Hey Chanakya" | Wake the assistant |
| "Translate hello to Spanish" | Translate text |
| "Change output to French" | Change target language |
| "Swap languages" | Swap source ↔ target |
| "Repeat" | Repeat last translation |
| "Clear" | Clear all text |
| "Show history" | Switch to History tab |
| "Go to sleep" | Deactivate assistant |

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/translate` | Translate text, auto-detect source |
| `POST` | `/api/summarize` | AI-generated conversation summary |
| `GET` | `/api/history` | Fetch translation history |
| `DELETE` | `/api/history/{id}` | Delete a specific entry |
| `DELETE` | `/api/history` | Clear all history |
| `GET` | `/api/stats` | Get usage statistics |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/languages` | List supported languages |

### Example Request

```json
POST /api/translate
{
  "text": "Hello, how are you?",
  "source_lang": "auto",
  "target_lang": "hi"
}
```

### Example Response

```json
{
  "source_text": "Hello, how are you?",
  "translated_text": "नमस्ते, आप कैसे हैं?",
  "source_lang": "en",
  "target_lang": "hi",
  "detected_language": "en",
  "confidence": 0.98,
  "translation_id": 42
}
```

---

## 🛠️ Tech Stack

**Frontend**: React 18, Vite, React Icons, React Hot Toast, Web Audio API  
**Backend**: FastAPI, Uvicorn, deep-translator (Google Translate), langdetect  
**Database**: SQLite (via Python stdlib `sqlite3`)  
**Speech**: Web Speech API (STT + TTS, browser-native)  
**PWA**: Service Worker, Web App Manifest, Wake Lock API  

---

## 🎯 Internship Context

This project was built as part of the **Pinnacle Labs Internship** program, demonstrating:
- Full-stack development with modern tooling
- AI/ML integration (translation engine, language detection, voice biometrics)
- Real-time UX with voice capabilities & live translation
- Progressive Web App for mobile deployment
- Background processing & notification system
- Professional code architecture

---

*Built with ❤️ for Pinnacle Labs · LinguaAI — Hey Chanakya*
