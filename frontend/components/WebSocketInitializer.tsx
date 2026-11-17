'use client';

import { useEffect } from 'react';
import { wsManager } from '@/lib/ws-manager';

export default function WebSocketInitializer() {
  useEffect(() => {
    wsManager.connect();
  }, []);

  return null;
}
