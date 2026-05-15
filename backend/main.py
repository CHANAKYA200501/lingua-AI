"""
LinguaAI — FastAPI Backend (Python 3.14 compatible, no pydantic models)
Handles translation, language detection, and history persistence (SQLite)
"""

import os
import sqlite3
import threading
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from deep_translator import GoogleTranslator
from langdetect import detect, detect_langs, DetectorFactory, LangDetectException

# Seed for consistent language detection
DetectorFactory.seed = 0

DB_PATH = os.path.join(os.path.dirname(__file__), "translations.db")

# BUG-11 FIX: Thread-safe SQLite connection manager
_db_lock = threading.Lock()

@contextmanager
def get_db():
    """Thread-safe database connection context manager."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrent read/write
    try:
        yield conn
    finally:
        conn.close()


# ─── Database Setup ──────────────────────────────────────────────────────────

def init_db():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                detected_lang TEXT,
                confidence REAL,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()


def save_translation(source_text, translated_text, source_lang, target_lang, detected_lang, confidence):
    with _db_lock:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO translations 
                (source_text, translated_text, source_lang, target_lang, detected_lang, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                source_text, translated_text, source_lang, target_lang,
                detected_lang, confidence, datetime.utcnow().isoformat()
            ))
            conn.commit()
            return c.lastrowid


def get_history(limit: int = 50):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT id, source_text, translated_text, source_lang, target_lang, 
                   detected_lang, confidence, created_at
            FROM translations 
            ORDER BY id DESC 
            LIMIT ?
        """, (limit,))
        rows = c.fetchall()
    return [
        {
            "id": r[0],
            "source_text": r[1],
            "translated_text": r[2],
            "source_lang": r[3],
            "target_lang": r[4],
            "detected_lang": r[5],
            "confidence": r[6],
            "created_at": r[7],
        }
        for r in rows
    ]


# BUG-10 FIX: Use SQL to count words instead of loading all texts into memory
def get_stats():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM translations")
        total = c.fetchone()[0]
        c.execute("SELECT COUNT(DISTINCT target_lang) FROM translations")
        langs = c.fetchone()[0]
        # Approximate word count using SQL: count spaces + 1 per row
        c.execute("""
            SELECT COALESCE(SUM(LENGTH(source_text) - LENGTH(REPLACE(source_text, ' ', '')) + 1), 0) 
            FROM translations
        """)
        word_count = c.fetchone()[0]
    return {"total_translations": total, "languages_used": langs, "words_processed": word_count}


# ─── App ─────────────────────────────────────────────────────────────────────

# BUG-08 FIX: Use lifespan context manager instead of deprecated on_event
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print("✅ LinguaAI backend started — DB initialized")
    yield
    # Shutdown (cleanup if needed)

app = FastAPI(
    title="LinguaAI API",
    description="Real-time AI Translation API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "LinguaAI Translation API",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/translate")
async def translate(request: Request):
    body = await request.json()
    text = (body.get("text") or "").strip()
    source_lang = body.get("source_lang", "auto")
    target_lang = body.get("target_lang", "en")

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="Text exceeds 5000 character limit")

    # Detect language if auto
    detected_lang = None
    confidence = None
    if source_lang == "auto":
        try:
            # BUG-09 FIX: Use detect_langs for real confidence scores
            detections = detect_langs(text)
            if detections:
                best = detections[0]
                detected_lang = best.lang
                confidence = round(best.prob, 3)
            else:
                detected_lang = "en"
                confidence = 0.5
            source_lang = detected_lang
        except LangDetectException:
            detected_lang = "en"
            confidence = 0.5
            source_lang = "en"

    # Skip translation if same language
    if source_lang == target_lang:
        return JSONResponse({
            "source_text": text,
            "translated_text": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "detected_language": detected_lang,
            "confidence": confidence or 1.0,
            "translation_id": None,
        })

    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Translation service error: {str(e)}")

    if not translated:
        raise HTTPException(status_code=500, detail="Empty translation result")

    record_id = save_translation(
        source_text=text,
        translated_text=translated,
        source_lang=source_lang,
        target_lang=target_lang,
        detected_lang=detected_lang,
        confidence=confidence
    )

    return JSONResponse({
        "source_text": text,
        "translated_text": translated,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "detected_language": detected_lang,
        "confidence": confidence,
        "translation_id": record_id,
    })


@app.get("/api/history")
async def history(limit: int = 50):
    if limit > 200:
        limit = 200
    return JSONResponse({"history": get_history(limit)})


@app.delete("/api/history/{translation_id}")
async def delete_translation(translation_id: int):
    with _db_lock:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM translations WHERE id = ?", (translation_id,))
            conn.commit()
            affected = c.rowcount
    if affected == 0:
        raise HTTPException(status_code=404, detail="Translation not found")
    return JSONResponse({"deleted": True, "id": translation_id})


@app.delete("/api/history")
async def clear_history():
    with _db_lock:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM translations")
            conn.commit()
    return JSONResponse({"cleared": True})


@app.get("/api/stats")
async def stats():
    return JSONResponse(get_stats())


@app.post("/api/summarize")
async def summarize(request: Request):
    body = await request.json()
    entries = body.get("entries", [])
    duration_ms = body.get("duration_ms", 0)

    if not entries:
        return JSONResponse({"summary": "No conversation data to summarize."})

    speakers = {}
    total_words = 0
    languages_detected = set()

    for e in entries:
        sp = e.get("speaker", "Unknown")
        speakers[sp] = speakers.get(sp, 0) + 1
        total_words += len(e.get("original", "").split())
        if e.get("detectedLang"):
            languages_detected.add(e["detectedLang"])

    mins = int(duration_ms / 60000)
    secs = int((duration_ms % 60000) / 1000)

    lines = [
        f"📊 Conversation Summary",
        f"Duration: {mins}m {secs}s",
        f"Total utterances: {len(entries)}",
        f"Total words: {total_words}",
        f"Speakers: {len(speakers)}",
    ]
    for sp, count in speakers.items():
        lines.append(f"  • {sp}: {count} utterances")
    if languages_detected:
        lines.append(f"Languages detected: {', '.join(languages_detected)}")

    # Key phrases (longest utterances)
    sorted_entries = sorted(entries, key=lambda e: len(e.get("original", "")), reverse=True)
    key_phrases = sorted_entries[:3]
    if key_phrases:
        lines.append("\nKey phrases:")
        for kp in key_phrases:
            lines.append(f'  "{kp.get("original", "")[:80]}"')

    return JSONResponse({"summary": "\n".join(lines)})
