import { useState, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import ResourceCard from './ResourceCard';

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
    },
    {
        id: "toiletmap_1",
        name: "McDonald's Broad Street",
        type: "toilet",
        notes: "Customer use only",
        extended: { accessible: true }
    },
    {
        id: "toiletmap_1",
        name: "McDonald's Broad Street",
        type: "toilet",
        notes: "Customer use only",
        extended: { accessible: true }
    },
    {
        id: "toiletmap_1",
        name: "McDonald's Broad Street",
        type: "toilet",
        notes: "Customer use only",
        extended: { accessible: true }
    }
];

const categories = ['All', 'food_bank', 'toilet'];

export default function ResourceSheet() {
    const [activeCategory, setActiveCategory] = useState('All');
    const [isExpanded, setIsExpanded] = useState(false);

    const sheetY = useMotionValue(0);
    const dragRef = useRef({ startY: 0, startVal: 0, lastY: 0, lastTime: 0 });

    const minY = -(window.innerHeight * 0.55);
    const maxY = 0;

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
        </motion.div>
    );
}