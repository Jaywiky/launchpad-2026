import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import ResourceCard from './ResourceCard';
import { emptyStorage, readJsonFile, writeJsonFile } from '../services/storage/fileSystem';

const typeFilters = ['All', 'food_bank', 'toilet'];

async function deleteData() {
    await emptyStorage();
    window.dispatchEvent(new Event('meshSyncUpdated'));
}

async function seedFakeData() {
    try {
        const envelope = {
            version: 200,
            datasets: [
                { data: 'hash_food_123', translations: { en: 'hash_food_en', ur: 'hash_food_ur', pl: 'hash_food_pl' } },
                { data: 'hash_toil_999', translations: { en: 'hash_toilet_en', ur: 'hash_toil_ur' } },
            ],
            signature: 'ed25519_sig_over_above_fields',
        };

        const dataByHash = {
            hash_food_123: [
                {
                    id: 'givefood_1',
                    name: 'Ladywood Fuck Bank',
                    type: 'food_bank',
                    notes: 'Pay me needed',
                    extended: { referral_required: true },
                },
            ],
            hash_toil_999: [
                {
                    id: 'toiletmap_1',
                    name: "Fucking mc fuck's Broad Street",
                    type: 'toilet',
                    notes: 'Orgy use only',
                    extended: { accessible: true },
                },
            ],
        };

        await writeJsonFile('envelope.json', envelope);

        for (const dataset of envelope.datasets) {
            await writeJsonFile(`json_data/${dataset.data}.json`, dataByHash[dataset.data] || []);

            for (const [locale, hash] of Object.entries(dataset.translations || {})) {
                await writeJsonFile(`json_data/${hash}.json`, { locale, placeholder: true });
            }
        }

        alert('Fake data seeded. You are now on version 200');
        window.dispatchEvent(new Event('meshSyncUpdated'));
    } catch (error) {
        console.error('[ResourceSheet] Failed to seed data:', error);
        alert('Error seeding data.');
    }
}

export default function ResourceSheet() {
    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeCategory, setActiveCategory] = useState('All');
    const [isExpanded, setIsExpanded] = useState(false);

    const sheetY = useMotionValue(0);
    const dragRef = useRef({ startY: 0, startVal: 0, lastY: 0, lastTime: 0 });

    const minY = -(window.innerHeight * 0.55);
    const maxY = 0;

    useEffect(() => {
        async function loadLocalResources() {
            try {
                const envelope = await readJsonFile('envelope.json');
                let loadedResources = [];

                if (envelope && Array.isArray(envelope.datasets)) {
                    for (const dataset of envelope.datasets) {
                        const hash = dataset?.data;
                        if (!hash) continue;
                        try {
                            const data = await readJsonFile(`json_data/${hash}.json`);
                            if (Array.isArray(data)) {
                                loadedResources = [...loadedResources, ...data];
                            }
                        } catch (fileErr) {
                            console.error(`[ResourceSheet] Missing data file for hash: ${hash}`);
                        }
                    }
                }

                setResources(loadedResources);
            } catch (err) {
                console.log('[ResourceSheet] No envelope yet; waiting for first sync.');
                setResources([]);
            } finally {
                setIsLoading(false);
            }
        }

        loadLocalResources();

        const handleSyncUpdate = () => {
            console.log('[ResourceSheet] Mesh data updated; refreshing.');
            loadLocalResources();
        };

        window.addEventListener('meshSyncUpdated', handleSyncUpdate);
        return () => window.removeEventListener('meshSyncUpdated', handleSyncUpdate);
    }, []);

    const filteredResources = resources.filter((resource) => {
        if (activeCategory === 'All') return true;
        return activeCategory === resource.type;
    });

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        dragRef.current = {
            startY: touch.clientY,
            startVal: sheetY.get(),
            lastY: touch.clientY,
            lastTime: Date.now(),
        };
    };

    const handleTouchMove = (e) => {
        const touch = e.touches[0];
        const delta = touch.clientY - dragRef.current.startY;
        const newY = Math.min(maxY, Math.max(minY, dragRef.current.startVal + delta));

        dragRef.current.lastY = touch.clientY;
        dragRef.current.lastTime = Date.now();

        sheetY.set(newY);
    };

    const handleTouchEnd = () => {
        const velocity = dragRef.current.lastY - dragRef.current.startY;
        const currentY = sheetY.get();
        const shouldExpand = velocity < -50 || currentY < minY / 2;

        animate(sheetY, shouldExpand ? minY : maxY, { type: 'spring', damping: 30, stiffness: 300 });
        setIsExpanded(shouldExpand);
    };

    const handleTap = () => {
        const next = !isExpanded;
        animate(sheetY, next ? minY : maxY, { type: 'spring', damping: 30, stiffness: 300 });
        setIsExpanded(next);
    };

    return (
        <motion.div
            className="absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-[#222222] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 flex flex-col"
            style={{
                height: '85vh',
                y: sheetY,
                top: '70vh',
            }}
        >
            <div
                className="p-4 pt-6 flex flex-col items-center shrink-0 touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleTap}
            >
                <div className="w-12 h-1.5 bg-gray-500 rounded-full mb-4"></div>
                <h1 className="text-2xl font-bold w-full text-white">Ladywood Resources</h1>

                <button
                    onClick={seedFakeData}
                    className="absolute top-4 left-4 z-50 rounded bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-lg"
                >
                    Seed fake data (v200)
                </button>

                <button
                    onClick={deleteData}
                    className="absolute top-4 right-4 z-50 rounded bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-lg"
                >
                    DELETE ALL DATA
                </button>
            </div>

            <div className="px-4 mb-4 flex gap-2 shrink-0 overflow-x-auto">
                {typeFilters.map((category) => (
                    <button
                        key={category}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveCategory(category);
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeCategory === category
                            ? 'bg-[#e2f0d9] text-green-900'
                            : 'bg-[#333333] text-gray-400 hover:bg-[#444444]'
                            }`}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className="px-4 pb-8 overflow-y-auto flex-1 space-y-4">
                {isLoading && (
                    <p className="text-gray-400 text-center mt-10">Loading local data...</p>
                )}

                {!isLoading && filteredResources.length === 0 && (
                    <div className="text-center mt-10">
                        <p className="text-gray-400">No resources found.</p>
                        <p className="text-gray-600 text-sm mt-2">Waiting to sync with nearby peers...</p>
                    </div>
                )}

                {!isLoading && filteredResources.map((resource, index) => (
                    <ResourceCard
                        key={resource.id || index}
                        name={resource.name}
                        type={resource.type}
                        notes={resource.notes}
                        extended={resource.extended}
                    />
                ))}
            </div>
        </motion.div>
    );
}