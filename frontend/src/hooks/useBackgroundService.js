/**
 * useBackgroundService — Keeps the app alive in background tabs
 * 
 * Techniques used:
 * 1. Silent audio loop — prevents browser from suspending the tab
 * 2. Wake Lock API — prevents screen from sleeping (when supported)
 * 3. Page Visibility API — detects background/foreground transitions
 * 4. Web Notifications — alerts user when wake word detected in background
 * 5. Web Locks API — prevents tab from being discarded
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export default function useBackgroundService() {
  const [isBackgroundActive, setIsBackgroundActive] = useState(false)
  const [notificationsGranted, setNotificationsGranted] = useState(false)
  const [isInBackground, setIsInBackground] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)

  const silentCtxRef = useRef(null)
  const silentOscRef = useRef(null)
  const wakeLockRef = useRef(null)
  const webLockRef = useRef(null)

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      setNotificationsGranted(true)
      return true
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission()
      const granted = result === 'granted'
      setNotificationsGranted(granted)
      return granted
    }
    return false
  }, [])

  // Start silent audio to keep tab alive in background
  const startSilentAudio = useCallback(() => {
    if (silentCtxRef.current) return // Already running

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      
      // Create a silent oscillator (gain = 0 = no sound, but browser thinks audio is playing)
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      gainNode.gain.value = 0.001 // Near-silent but enough to keep tab alive
      oscillator.frequency.value = 1 // Ultra-low frequency, inaudible
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start()

      silentCtxRef.current = ctx
      silentOscRef.current = oscillator
      console.log('🔇 Silent audio started — tab will stay alive in background')
    } catch (e) {
      console.warn('Failed to start silent audio:', e)
    }
  }, [])

  // Stop silent audio
  const stopSilentAudio = useCallback(() => {
    if (silentOscRef.current) {
      try { silentOscRef.current.stop() } catch(e) {}
      silentOscRef.current = null
    }
    if (silentCtxRef.current) {
      silentCtxRef.current.close().catch(() => {})
      silentCtxRef.current = null
    }
  }, [])

  // Acquire Wake Lock (keeps screen on)
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockActive(true)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false)
      })
      console.log('🔒 Wake Lock acquired — screen will stay on')
    } catch (e) {
      console.warn('Wake Lock failed:', e)
    }
  }, [])

  // Release Wake Lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release() } catch(e) {}
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  // Acquire Web Lock (prevents tab discard)
  const acquireWebLock = useCallback(() => {
    if (!('locks' in navigator)) return
    // Web Locks API keeps the tab from being discarded by the browser
    navigator.locks.request('lexa-background-lock', { mode: 'exclusive' }, () => {
      return new Promise((resolve) => {
        webLockRef.current = resolve
        console.log('🔐 Web Lock acquired — tab won\'t be discarded')
      })
    }).catch(() => {})
  }, [])

  // Release Web Lock
  const releaseWebLock = useCallback(() => {
    if (webLockRef.current) {
      webLockRef.current()
      webLockRef.current = null
    }
  }, [])

  // Show notification when wake word detected in background
  const showWakeNotification = useCallback((message) => {
    if (!notificationsGranted || !isInBackground) return
    
    try {
      const notification = new Notification('🤖 Hey Lexa!', {
        body: message || 'Lexa is awake and ready for your command',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'lexa-wake',
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
      })

      // Focus the tab when notification is clicked
      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000)
    } catch (e) {
      console.warn('Notification failed:', e)
    }
  }, [notificationsGranted, isInBackground])

  // Show background task notification
  const showTaskNotification = useCallback((title, body) => {
    if (!notificationsGranted) return
    try {
      const n = new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: 'lexa-task',
        silent: true,
      })
      setTimeout(() => n.close(), 5000)
    } catch(e) {}
  }, [notificationsGranted])

  // Start background service (all persistence techniques)
  const startBackgroundService = useCallback(async () => {
    await requestNotificationPermission()
    startSilentAudio()
    acquireWebLock()
    await acquireWakeLock()
    setIsBackgroundActive(true)
    console.log('🟢 Background service started — Hey Lexa will work even when tab is hidden')
  }, [requestNotificationPermission, startSilentAudio, acquireWebLock, acquireWakeLock])

  // Stop background service
  const stopBackgroundService = useCallback(() => {
    stopSilentAudio()
    releaseWebLock()
    releaseWakeLock()
    setIsBackgroundActive(false)
    console.log('🔴 Background service stopped')
  }, [stopSilentAudio, releaseWebLock, releaseWakeLock])

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden
      setIsInBackground(hidden)
      
      if (hidden) {
        console.log('📱 App moved to background — listener staying active')
      } else {
        console.log('📱 App returned to foreground')
        // Re-acquire wake lock when returning to foreground (it gets released on hide)
        if (isBackgroundActive && !wakeLockRef.current) {
          acquireWakeLock()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isBackgroundActive, acquireWakeLock])

  // Auto-start on mount if previously active
  useEffect(() => {
    const wasActive = localStorage.getItem('lexa_bg_service') === 'true'
    if (wasActive) {
      startBackgroundService()
    }
    return () => {
      // Don't stop on unmount — we want it to persist
    }
  }, [])

  // Persist state
  useEffect(() => {
    localStorage.setItem('lexa_bg_service', isBackgroundActive ? 'true' : 'false')
  }, [isBackgroundActive])

  return {
    isBackgroundActive,
    isInBackground,
    notificationsGranted,
    wakeLockActive,
    startBackgroundService,
    stopBackgroundService,
    showWakeNotification,
    showTaskNotification,
    requestNotificationPermission,
  }
}
