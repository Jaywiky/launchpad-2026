import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import ResourceCard from './ResourceCard';

const categories = ['All', 'food_bank', 'toilet'];

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
                const envelopeResult = await Filesystem.readFile({
                    path: 'envelope.json',
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                });
                
                const envelope = JSON.parse(envelopeResult.data);
                let loadedResources = [];

                if (envelope && envelope.categories) {
                    for (const [categoryName, hash] of Object.entries(envelope.categories)) {
                        try {
                            const fileResult = await Filesystem.readFile({
                                path: `json_data/${hash}.json`,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            });

                            console.log("FUCKCKCKCKCKCKCKCKCKC")
                            
                            const categoryData = JSON.parse(fileResult.data);
                            console.log("FUCKCKCKCKCKCKCKCKCKC2")

                            loadedResources = [...loadedResources, ...categoryData];
                            console.log("FUCKCKCKCKCKCKCKCKCKC3", JSON.stringify(loadedResources, null, 2))

                        } catch (fileErr) {
                            console.error(`Missing data file for hash: ${hash}`);
                        }
                    }
                }

                setResources(loadedResources);
            } catch (err) {
                console.log("No envelope.json found. Device is likely waiting for first sync.");
                setResources([]);
            } finally {
                setIsLoading(false);
            }
        }

        loadLocalResources();

        const handleSyncUpdate = () => {
            console.log("UI detected new mesh data! Refreshing cards...");
            loadLocalResources();
        };

        window.addEventListener('meshSyncUpdated', handleSyncUpdate);

        return () => {
            window.removeEventListener('meshSyncUpdated', handleSyncUpdate);
        };
    }, []);

    const filteredResources = resources.filter(resource => {
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

        if (shouldExpand) {
            animate(sheetY, minY, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(true);
        } else {
            animate(sheetY, maxY, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(false);
        }
    };

    const handleTap = () => {
        if (isExpanded) {
            animate(sheetY, maxY, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(false);
        } else {
            animate(sheetY, minY, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(true);
        }
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
            </div>

            <div className="px-4 mb-4 flex gap-2 shrink-0 overflow-x-auto">
                {categories.map(category => (
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