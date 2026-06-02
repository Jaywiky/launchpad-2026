import { useRef, useEffect, useState, act } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useTranslation as useI18nTranslation } from 'react-i18next';

import UserMap from './components/UserMap';
import ResourceSheet from './components/ResourceSheet';
import Settings from './components/Settings';
import { initializeStorage, writeJsonFile } from './services/storage/fileSystem';
import { runFullSyncCycle } from './services/sync/syncManager';
import { initializeBleHardware, stopP2PNetwork } from './services/sync/bleManager';

const POLL_INTERVAL_MS = 30 * 60 * 1000;



function App() {
  const { t } = useI18nTranslation();
  const pollingRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(['All']);

  const [userPos, setUserPos] = useState(null);
  const [selectedPos, setSelectedPos] = useState(null);

  useEffect(() => {
    async function fetchGlobalResources() {
      try {

        const response = await fetch('http://localhost:3001/api/resources');
        const json = await response.json();

        if (json.status === 'ok' && Array.isArray(json.data)) {
          setResources(json.data);
        }
      } catch (err) {
        console.error('[Parent] Error fetching shared resources:', err);
      } finally {
        setIsLoading(false);
      }
    }

    const handleSyncUpdate = () => {
      console.log('[ResourceSheet] Mesh data updated; refreshing.');
      fetchGlobalResources();
    };

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

    fetchGlobalResources();
    window.addEventListener('meshSyncUpdated', handleSyncUpdate);
    boot();

    const listenerHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[App] Foreground: resuming sync.');
        resume();
      } else {
        console.log('[App] Background: pausing sync to save battery.');
        pause();
      }
    });

    return () => {
      window.removeEventListener('meshSyncUpdated', handleSyncUpdate);
      stopPolling();
      stopP2PNetwork();
      listenerHandle.then((listener) => listener.remove());
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#111111] text-sm text-white/70">
        {t('starting_up')}
      </div>
    );
  }

  if (activePage === 'settings') {
    return <Settings onClose={() => setActivePage('home')} />;
  }

  return (
    <div className="relative h-screen w-full bg-[#111111] overflow-hidden">
      <button
        onClick={() => setActivePage('settings')}
        className="absolute top-4 left-4 z-50 bg-[#222222] border border-[#444444] text-white p-3 rounded-full shadow-lg"
      >
        ⚙️
      </button>

      <div className="absolute inset-0 z-0">
        <UserMap 
          resources={resources} 
          activeCategory={activeCategory} 
          onLocationUpdate={setUserPos} 
          selectedPos={selectedPos}
        />
      </div>

      <ResourceSheet 
        resources={resources} 
        isLoading={isLoading} 
        activeCategory={activeCategory} 
        setActiveCategory={setActiveCategory} 
        userPos={userPos}
        onCardClick={setSelectedPos}
      />
    </div>
  );
}

export default App;