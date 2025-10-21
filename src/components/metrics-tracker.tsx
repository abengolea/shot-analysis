'use client';

import { useEffect } from 'react';

function getOrCreateSessionId(): string {
  try {
    const key = 'metrics_session_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, sid);
    return sid;
  } catch {
    return `${Date.now()}`;
  }
}

export function MetricsTracker() {
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const path = window.location.pathname + window.location.search;
    const userAgent = navigator.userAgent;

    const send = (payload: any) => {
      try {
        navigator.sendBeacon('/api/metrics/track', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {
        fetch('/api/metrics/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      }
    };

    // page_view
    send({ sessionId, type: 'page_view', path, ts: Date.now(), userAgent });

    // heartbeat cada 15s
    const interval = setInterval(() => {
      send({ sessionId, type: 'heartbeat', path, ts: Date.now() });
    }, 15000);

    // tiempo de permanencia básico
    const start = performance.now();
    const onUnload = () => {
      const durationMs = Math.max(0, performance.now() - start);
      send({ sessionId, type: 'duration', path, durationMs, ts: Date.now() });
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  return null;
}

