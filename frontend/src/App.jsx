import { useRef, useEffect, useState, useCallback } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { useTranslation as useI18nTranslation } from 'react-i18next';

import UserMap from './components/UserMap'
import ResourceSheet from './components/ResourceSheet'
import Settings from './components/Settings'
import { initializeStorage, readJsonFile } from './services/storage/fileSystem'
import { startSyncManager, stopSyncManager } from './services/sync/syncManager'
import { collectHashes, loadLocalEnvelope } from './services/sync/syncEngine'
import { useBleSync } from './hooks/useBleSync'

function App() {
  const pollingRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(['All']);

  useEffect(() => {
    const boot = async () => {
      try {
        console.log("[App] Initalising storage")
        await initializeStorage()
        console.log("[App] Starting Sync Manager")
        await startSyncManager()
        console.log("[App] Loading inital resources")
        await updateResources()
      } catch (error) { console.error('[App] Critical error during boot:', error) }
      finally { setReady(true) }
    }

    boot()

    const listenerHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) startSyncManager()
      else stopSyncManager()
    })

    window.addEventListener('resourceUpdated', updateResources)

    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      if (activePageRef.current === 'settings') setActivePage('home')
      else CapacitorApp.exitApp()
    })

    return () => {
      stopSyncManager()
      window.removeEventListener('resourceUpdated', updateResources)
      listenerHandle.then(l => l.remove())
      backButtonListener.then(l => l.remove())
    }
  }, [updateResources])

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#111111] text-sm text-white/70">
        {t('starting_up')}
      </div>
    )
  }

  if (activePage === 'settings') {
    return (
      <Settings
        onClose={() => setActivePage('home')}
        isActive={isActive}
        toggleSync={toggleSync}
      />
    )
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

      <ResourceSheet resources={resources} isLoading={isLoading} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
    </div>
  )
}

export default App