import { useRef, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

import UserMap from './components/UserMap';
import ResourceSheet from './components/ResourceSheet';
import { initializeStorage, writeJsonFile } from './services/storage/fileSystem';
import { runFullSyncCycle } from './services/sync/syncManager';
import { initializeBleHardware, stopP2PNetwork } from './services/sync/bleManager';

const POLL_INTERVAL_MS = 30 * 60 * 1000;



function App() {
  const pollingRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(runFullSyncCycle, POLL_INTERVAL_MS);
      console.log('[App] Polling started.');
    };

    const stopPolling = () => {
      if (!pollingRef.current) return;
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      console.log('[App] Polling stopped.');
    };

    const resume = async () => {
      await runFullSyncCycle();
      startPolling();
    };

    const pause = async () => {
      stopPolling();
      await stopP2PNetwork();
    };

    const boot = async () => {
      try {
        console.log('[App] Initializing local storage...');
        await initializeStorage();

        console.log('[App] Initializing Bluetooth...');
        const bleReady = await initializeBleHardware();
        if (!bleReady) {
          console.warn('[App] Bluetooth not ready; continuing without the mesh.');
        }

        console.log('[App] Running initial sync...');
        await resume();
      } catch (error) {
        console.error('[App] Critical error during boot:', error);
      } finally {
        setReady(true);
      }
    };

    boot();

    // const listenerHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    //   if (isActive) {
    //     console.log('[App] Foreground: resuming sync.');
    //     resume();
    //   } else {
    //     console.log('[App] Background: pausing sync to save battery.');
    //     pause();
    //   }
    // });

    return () => {
      stopPolling();
      stopP2PNetwork();
      listenerHandle.then((listener) => listener.remove());
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#111111] text-sm text-white/70">
        Starting up…
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[#111111] overflow-hidden">
      <div className="absolute inset-0 z-0">
        <UserMap />
      </div>

      <ResourceSheet />
    </div>
  );
}

export default App;