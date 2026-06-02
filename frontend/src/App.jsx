import { useRef, useEffect, useState, useCallback } from 'react'
import { App as CapacitorApp } from '@capacitor/app'

import UserMap from './components/UserMap'
import ResourceSheet from './components/ResourceSheet'
import Settings from './components/Settings'
import { initializeStorage, readJsonFile } from './services/storage/fileSystem'
import { startSyncManager, stopSyncManager } from './services/sync/syncManager'
import { collectHashes, loadLocalEnvelope } from './services/sync/syncEngine'
import { useBleSync } from './hooks/useBleSync'

function App() {
  const [ready, setReady] = useState(false)
  const [activePage, setActivePage] = useState('home')
  const [resources, setResources] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(['All'])

  const { isActive, toggleSync } = useBleSync(true)

  const activePageRef = useRef(activePage)
  useEffect(() => { activePageRef.current = activePage }, [activePage])

  const updateResources = useCallback(async () => {
    try {
      setIsLoading(true)
      const env = await loadLocalEnvelope()
      const hashes = Array.from(collectHashes(env))
      const promises = hashes.map(hash => readJsonFile(`json_data/${hash}.json`))
      const results = await Promise.all(promises)
      const combined = results.flat()
      setResources(combined)
    } catch (error) { console.error('[App] Failed to update local resources:', error) }
    finally { setIsLoading(false) }
  }, [])

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
        Starting up…
      </div>
    )
  }

  // 3. Settings page is an overlay controlled by App state
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
        <UserMap resources={resources} activeCategory={activeCategory} />
      </div>

      <ResourceSheet
        resources={resources}
        isLoading={isLoading}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />
    </div>
  )
}

export default App