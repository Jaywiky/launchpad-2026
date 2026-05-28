import { useState, useRef, useEffect } from "react";
import ResourceCard from './components/ResourceCard';
import { App as CapacitorApp } from '@capacitor/app';
import UserMap from './components/UserMap';

import { initializeStorage } from './services/storage/fileSystem';
import { runFullSyncCycle } from './services/sync/syncManager'

const resources = [
  {
    id: "givefood_1",
    name: "Ladywood Food Bank",
    type: "food_bank",
    notes: "Referral needed",
    extended: { referral_required: true }
  },
  {
    id: "toiletmap_1",
    name: "McDonald's Broad Street",
    type: "toilet",
    notes: "Customer use only",
    extended: { accessible: true }
  }
];

function App() {
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const bootSequence = async () => {
      try {
        console.log("App booting: Initializing local storage")
        await initializeStorage()

        console.log("Storage ready. Running initial sync")
        await runFullSyncCycle()

        startPolling();
      } catch (error) {
        console.error("Critical error during boot:", error);
      }
    };

    // Start the boot sequence
    bootSequence();

    // 2. The Capacitor Background/Foreground Listener
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

  const [activeCategory, setActiveCategory] = useState('All')
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const filteredResources = resources.filter(resource => {
    if (activeCategory === 'All') {
      return true;
    }
    return activeCategory === resource.type
  })

  const categories = ['All', 'food_bank', 'toilet'];
  return (
    <div className="relative h-screen w-full bg-[#111111] overflow-hidden">
      <div className="absolute inset-0 z-0">
        <UserMap />
      </div>
      <div className={`absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-[#222222] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out z-10 flex flex-col ${isSheetExpanded ? "h-[85vh]" : "h-[30vh]"
        }`}>
        <div
          className="p-4 pt-6 cursor-pointer flex flex-col items-center shrink-0"
          onClick={() => setIsSheetExpanded(!isSheetExpanded)}
        >
          <div className="w-12 h-1.5 bg-gray-500 rounded-full mb-4"></div>
          <h1 className="text-2xl font-bold w-full text-white">Ladywood Resources</h1>
        </div>
        <div className="px-4 mb-4 flex gap-2 shrink-0 overflow-x-auto">
          {categories.map(category => (
            <button key={category} onClick={(e) => {
              e.stopPropagation();
              setActiveCategory(category)
            }} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeCategory === category
              ? 'bg-[#e2f0d9] text-green-900'
              : 'bg-[#333333] text-gray-400 hover:bg-[#444444]'
              }`}>{category}</button>
          ))}
        </div>
        <div className="px-4 pb-8 overflow-y-auto flex-1 space-y-4">
          {filteredResources.map(resource => (
            <ResourceCard
              key={resource.id}
              name={resource.name}
              type={resource.type}
              notes={resource.notes}
              extended={resource.extended}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App