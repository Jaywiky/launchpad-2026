import { useState, useRef, useEffect } from "react";
import ResourceCard from './components/ResourceCard';
import { App as CapacitorApp } from '@capacitor/app';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet'

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
  const filteredResources = resources.filter(resource => {
    if (activeCategory === 'All') {
      return true;
    }
    return activeCategory === resource.type
  })

  const categories = ['All', 'food_bank', 'toilet'];
  return (
    <div className="min-h-screen bg-[#222222] text-white max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Ladywood Resources</h1>
      <div className="flex gap-2 mb-6">
        {categories.map(category => (
          <button key={category} onClick={() => setActiveCategory(category)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeCategory === category
            ? 'bg-[#e2f0d9] text-green-900'
            : 'bg-[#333333] text-gray-400 hover:bg-[#444444]'
            }`}>{category}</button>
        ))}
      </div>

      <MapContainer center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[51.505, -0.09]}>
          <Popup>
            A pretty CSS3 popup. <br /> Easily customizable.
          </Popup>
        </Marker>
      </MapContainer>

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
  );
}

export default App