/**
 * useVoiceRecognition — Continuous speech recognition hook
 * Supports wake word detection, command listening, and continuous modes
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export default function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const shouldRestartRef = useRef(false)
  const callbackRef = useRef(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const createRecognition = useCallback((options = {}) => {
    if (!isSupported) return null
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = options.continuous ?? true
    recognition.interimResults = options.interimResults ?? true
    recognition.lang = options.lang || 'en-US'
    recognition.maxAlternatives = 1
    return recognition
  }, [isSupported])

  const startListening = useCallback((options = {}) => {
    if (!isSupported) {
      setError('Speech recognition not supported. Use Chrome.')
      return
    }

    // Stop existing
    if (recognitionRef.current) {
      shouldRestartRef.current = false
      recognitionRef.current.abort()
    }

    const recognition = createRecognition(options)
    if (!recognition) return

    callbackRef.current = options.onResult || null
    shouldRestartRef.current = options.continuous ?? true

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        setTranscript(final)
        setInterimTranscript('')
        if (callbackRef.current) callbackRef.current(final, true)
      }
      if (interim) {
        setInterimTranscript(interim)
        if (callbackRef.current) callbackRef.current(interim, false)
      }
    }

    recognition.onerror = (e) => {
      // "no-speech" and "aborted" are not real errors in continuous mode
      if (e.error === 'no-speech' || e.error === 'aborted') {
        return
      }
      setError(e.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-restart in continuous mode
      if (shouldRestartRef.current) {
        restartTimerRef.current = setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            // Ignore — may already be started
          }
        }, 200)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e) {
      setError(e.message)
    }
  }, [isSupported, createRecognition])

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    setTranscript,
    setInterimTranscript,
  }
}
