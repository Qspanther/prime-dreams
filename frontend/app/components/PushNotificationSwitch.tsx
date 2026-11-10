'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiDelete, apiPost } from '../lib/api';

// Browser support guard
const supportsPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export default function PushNotificationSwitch() {
  const { token } = useAuth();
  const [supported] = useState(supportsPush);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const checkState = useCallback(async () => {
    if (!token || !supported) return;
    try {
      const res = await apiGet('/notifications/subscriptions', token);
      setEnabled(Number(res?.count) > 0);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [token, supported]);

  useEffect(() => {
    if (supported) setLoading(true);
    checkState();
  }, [checkState, supported]);

  const getVapidPublicKey = async (): Promise<string | null> => {
    try {
      const res = await apiGet('/notifications/push/public-key', token);
      return res?.publicKey || null;
    } catch {
      return null;
    }
  };

  const enablePush = async () => {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const swReg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMsg({ type: 'error', text: 'Notification permission blocked by the browser.' });
        return;
      }

      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        setMsg({ type: 'error', text: 'Push is not configured on the server yet.' });
        return;
      }

      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await apiPost('/notifications/subscribe', { subscription }, token);
      setEnabled(true);
      setMsg({ type: 'success', text: 'Push notifications enabled ✓' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Could not enable push notifications.' });
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => null);
      const subscription = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      if (subscription?.endpoint) {
        try {
          await apiDelete(`/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, token);
        } catch { /* ignore server errors on teardown */ }
        await subscription.unsubscribe().catch(() => {});
      }
      setEnabled(false);
      setMsg({ type: 'success', text: 'Push notifications disabled' });
    } catch {
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
        <p className="text-xs font-bold text-[#64748B] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#F59E0B]" /> Push notifications are not supported by this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-green-100 text-green-700' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
            {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-black text-[#0F172A]">Push Notifications</p>
            <p className="text-[10px] text-[#64748B] font-bold">Get alerts when matches go live &amp; contests lock</p>
          </div>
        </div>
        <button
          onClick={enabled ? disablePush : enablePush}
          disabled={busy || loading}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase transition disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled
              ? 'bg-red-50 text-red-700 border-2 border-red-300 hover:bg-red-100'
              : 'prime-btn-3d px-4 py-2 text-xs'
          }`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
      {msg.text && (
        <div className={`mt-3 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}

// Convert base64url public key (VAPID) to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new ArrayBuffer(rawData.length);
  const outputBytes = new Uint8Array(outputArray);
  for (let i = 0; i < rawData.length; ++i) {
    outputBytes[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
