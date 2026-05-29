import { useRef, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

import UserMap from './components/UserMap';
import ResourceSheet from './components/ResourceSheet';
import { initializeStorage, writeJsonFile } from './services/storage/fileSystem';
import { runFullSyncCycle } from './services/sync/syncManager';
import { initializeBleHardware, stopP2PNetwork } from './services/sync/bleManager';

const POLL_INTERVAL_MS = 30 * 60 * 1000;

async function seedFakeData() {
    try {
        const envelope = {
            version: 100,
            categories: {
                foodbanks: 'hash_food_123',
                toilets: 'hash_toil_456',
            },
        };

        const foodbanks = [
            {
                id: 'givefood_1',
                name: 'Ladywood Food Bank',
                type: 'food_bank',
                notes: 'Referral needed',
                extended: { referral_required: true },
            },
        ];

        const toilets = [
            {
                id: 'toiletmap_1',
                name: "McDonald's Broad Street",
                type: 'toilet',
                notes: 'Customer use only',
                extended: { accessible: true },
            },
        ];

        await writeJsonFile('envelope.json', envelope);
        await writeJsonFile('json_data/hash_food_123.json', foodbanks);
        await writeJsonFile('json_data/hash_toil_456.json', toilets);

        alert('Fake data seeded. You are now on version 100. Restart the app to broadcast it.');
    } catch (error) {
        console.error('[App] Failed to seed data:', error);
        alert('Error seeding data.');
    }
}

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
            {/* {import.meta.env.DEV && (
                <button
                    onClick={seedFakeData}
                    className="absolute top-4 left-4 z-50 rounded bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-lg"
                >
                    Seed fake data (v100)
                </button>
            )} */}

            <div className="absolute inset-0 z-0">
                <UserMap />
            </div>

            <ResourceSheet />
        </div>
    );
}

export default App;