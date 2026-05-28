import { useRef, useEffect } from "react";
import { App as CapacitorApp } from '@capacitor/app';
import UserMap from './components/UserMap';
import ResourceSheet from './components/ResourceSheet';

import { initializeStorage } from './services/storage/fileSystem';
import { runFullSyncCycle } from './services/sync/syncManager';

function App() {
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const bootSequence = async () => {
      try {
        console.log("App booting: Initializing local storage");
        await initializeStorage();
        console.log("Storage ready. Running initial sync");
        await runFullSyncCycle();
        startPolling();
      } catch (error) {
        console.error("Critical error during boot:", error);
      }
    };

    bootSequence();

    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log("App brought to foreground. Resuming sync...");
        runFullSyncCycle();
        startPolling();
      } else {
        console.log("App pushed to background. Pausing sync to save battery.");
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      appStateListener.then(listener => listener.remove());
    };
  }, []);

  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    console.log("Starting background polling interval...");
    pollingIntervalRef.current = setInterval(() => {
      runFullSyncCycle();
    }, 30 * 60 * 1000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("Polling interval stopped.");
    }
  };

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