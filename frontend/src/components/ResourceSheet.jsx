import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ResourceCard from './ResourceCard';
import { emptyStorage, writeJsonFile } from '../services/storage/fileSystem';

const typeFilters = ['All', 'food_bank', 'toilet', 'recycling', 'library', 'green_space'];
const specificCategories = ['food_bank', 'toilet', 'recycling', 'library', 'green_space'];

// Calculates great-circle distance using the Haversine formula (returns kilometers)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

async function deleteData() {
    await emptyStorage();
    window.dispatchEvent(new Event('resourceUpdated'));
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
                    name: 'Ladywood Food Bank',
                    type: 'food_bank',
                    lat: 52.4814,
                    lng: -1.9123,
                    notes: 'Referral needed',
                    extended: { referral_required: true },
                },
            ],
            hash_toil_999: [
                {
                    id: 'toiletmap_1',
                    name: "Broad Street Public Restrooms",
                    type: 'toilet',
                    lat: 52.4782,
                    lng: -1.9101,
                    notes: 'Customer use only',
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
        window.dispatchEvent(new Event('resourceUpdated'));
    } catch (error) {
        console.error('[ResourceSheet] Failed to seed data:', error);
        alert('Error seeding data.');
    }
}

export default function ResourceSheet({ resources, isLoading, activeCategory, setActiveCategory, userPos, onCardClick }) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedCardId, setExpandedCardId] = useState(null);

    const headerRef = useRef(null);
    const filterRef = useRef(null);
    const cardsRef = useRef(null);

    // Track the Y translation of the bottom sheet for fluid drag animations
    const sheetY = useMotionValue(0);
    const dragRef = useRef({ startY: 0, startVal: 0, lastY: 0, lastTime: 0 });

    // Defines the boundaries of the bottom sheet's movement
    const minY = -(window.innerHeight * 0.55);
    const maxY = 0;

    // Dynamically adjusts the bottom sheet's position to accommodate an expanded card's content without overflowing
    useEffect(() => {
        if (expandedCardId !== null && headerRef.current && filterRef.current && cardsRef.current) {
            // setTimeout ensures Framer Motion has started rendering the newly expanded card before we measure DOM heights
            setTimeout(() => {
                if (!headerRef.current || !filterRef.current || !cardsRef.current) return;

                const headerH = headerRef.current.offsetHeight;
                const filterH = filterRef.current.offsetHeight;
                const cardsH = cardsRef.current.scrollHeight;
                const totalRequiredHeight = headerH + filterH + cardsH + 24; 

                const defaultPeekHeight = window.innerHeight * 0.3;
                const targetTranslationY = defaultPeekHeight - totalRequiredHeight;

                // Ensure the sheet doesn't push down below resting (0) or pull up past maximum (minY)
                const clampedY = Math.max(minY, Math.min(0, targetTranslationY));

                animate(sheetY, clampedY, { type: 'spring', damping: 30, stiffness: 300 });
                setIsExpanded(true);
            }, 60);
        } else if (expandedCardId === null) {
            // Reset to resting position when all cards are collapsed
            animate(sheetY, 0, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(false);
        }
    }, [expandedCardId, minY, sheetY]);

    const filteredResources = resources.filter((resource) => {
        if (!resource) return false;
        if (activeCategory.includes('All')) return true;
        return activeCategory.includes(resource.type);
    });

    // Append user distance to each resource and sort closest-first
    const sortedResources = filteredResources.map((resource) => {
        if (!resource || !resource.lat || !resource.lng || !userPos) {
            return { ...resource, distance: null };
        }
        const dist = calculateDistance(userPos[0], userPos[1], Number(resource.lat), Number(resource.lng));
        return { ...resource, distance: dist };
    }).sort((a, b) => {
        // Items missing coordinates get pushed to the bottom of the list
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
    });

    const handleFilterClick = (category) => {
        if (category === 'All') {
            setActiveCategory(['All']);
            return;
        }

        let newSelection = activeCategory.filter(c => c !== 'All');

        // Toggle the specific category on/off
        if (newSelection.includes(category)) {
            newSelection = newSelection.filter(c => c !== category);
        } else {
            newSelection.push(category);
        }

        // If the user deselected everything OR manually selected every individual category, reset to 'All'
        if (newSelection.length === 0 || newSelection.length === specificCategories.length) {
            setActiveCategory(['All']);
        } else {
            setActiveCategory(newSelection);
        }
    };

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
        // Calculate drag velocity to support "flick" gestures for expanding/collapsing
        const velocity = dragRef.current.lastY - dragRef.current.startY;
        const currentY = sheetY.get();
        // Expand if user flicked upwards fast enough, OR if they dragged it past the halfway point
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
                ref={headerRef}
                className="p-4 pt-6 flex flex-col items-center shrink-0 touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleTap}
            >
                <div className="w-12 h-1.5 bg-gray-500 rounded-full mb-4"></div>
                <h1 className="text-2xl font-bold w-full text-white">{t('ladywood_resources')}</h1>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        seedFakeData();
                    }}
                    className="absolute top-4 left-4 z-50 rounded bg-red-500 px-2 py-1 text-xs font-medium text-white shadow-lg"
                >
                    Seed (v200)
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        deleteData();
                    }}
                    className="absolute top-4 right-4 z-50 rounded bg-red-500 px-2 py-1 text-xs font-medium text-white shadow-lg"
                >
                    WIPE DATA
                </button>
            </div>

            <div ref={filterRef} className="px-4 mb-4 flex gap-2 shrink-0 overflow-x-auto">
                {typeFilters.map((category) => {
                    const isActive = activeCategory.includes(category);

                    return (
                        <button
                            key={category}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFilterClick(category);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${isActive
                                    ? 'bg-[#e2f0d9] text-green-900'
                                    : 'bg-[#333333] text-gray-400 hover:bg-[#444444]'
                                }`}
                        >
                            {t(category.toLowerCase())}
                        </button>
                    );
                })}
            </div>

            <div ref={cardsRef} className="px-4 pb-8 overflow-y-auto flex-1 space-y-4">
                {isLoading && (
                    <p className="text-gray-400 text-center mt-10">{t('loading_local_data')}</p>
                )}

                {!isLoading && sortedResources.length === 0 && (
                    <div className="text-center mt-10">
                        <p className="text-gray-400">{t('no_resources_found')}</p>
                        <p className="text-gray-600 text-sm mt-2">{t('waiting_to_sync')}</p>
                    </div>
                )}

                {!isLoading && sortedResources.map((resource, index) => {
                    const uniqueId = resource.id || index;

                    return (
                        <ResourceCard
                            key={uniqueId}
                            id={uniqueId}
                            name={resource.name}
                            type={resource.type}
                            address={resource.address}
                            opening_hours={resource.opening_hours}
                            notes={resource.notes}
                            extended={resource.extended}
                            distance={resource.distance}
                            isExpanded={expandedCardId === uniqueId}
                            onToggle={() => {
                                const isOpening = expandedCardId !== uniqueId;
                                setExpandedCardId(isOpening ? uniqueId : null);
                            }}
                            onMapClick={() => {
                                if (resource.lat && resource.lng && onCardClick) {
                                    onCardClick([Number(resource.lat), Number(resource.lng)]);
                                }
                            }}
                        />
                    );
                })}
            </div>
        </motion.div>
    );
}