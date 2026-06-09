import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// Predefined visual configurations for important resource attributes
const extendedStyles = {
    referral_required: { icon: '⚠️', label: 'Referral Required', bg: 'bg-[#fadbe9]', text: 'text-[#5c133a]' },
    accessible: { icon: '♿', label: 'Wheelchair Accessible', bg: 'bg-[#1e3a8a]/30', text: 'text-blue-200' },
    membership_required: { icon: '💳', label: 'Membership Required', bg: 'bg-purple-900/40', text: 'text-purple-200' },
    women_only: { icon: '🚺', label: 'Women Only', bg: 'bg-pink-900/40', text: 'text-pink-200' },
};

// Utility to convert unexpected/dynamic snake_case keys into readable Title Case
const formatUnknownKey = (key) => {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

function ResourceCard({ id, name, type, address, opening_hours, notes, extended, distance, isExpanded, onToggle, onMapClick }) {
    const { t } = useTranslation();

    return (
        <div
            onClick={() => {
                onToggle();
                // Only pan the map if the user is opening the card, not closing it
                if (!isExpanded && onMapClick) onMapClick();
            }}
            className="bg-[#2d2d2d] p-4 rounded-xl border border-gray-700 space-y-3 hover:border-blue-500/50 cursor-pointer transition-all active:scale-[0.99]"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-white">{name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{notes}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="px-2 py-1 bg-[#e2f0d9] text-green-900 text-xs font-medium rounded-full whitespace-nowrap">
                        {t(type.toLowerCase())}
                    </span>
                    {distance !== null && (
                        <span className="text-xs text-blue-400 font-semibold tracking-wide bg-blue-950/40 border border-blue-900/40 px-2 py-0.5 rounded-md">
                            {distance.toFixed(1)} km
                        </span>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="flex flex-col gap-3 border-t border-gray-700 pt-3"
                    >
                        {address && (
                            <div className="flex items-start gap-2 text-sm text-gray-300">
                                <span>📍</span>
                                <p>{address}</p>
                            </div>
                        )}

                        {opening_hours && (
                            <div className="flex items-start gap-2 text-sm text-blue-400">
                                <span>🕒</span>
                                <p>{opening_hours}</p>
                            </div>
                        )}
                        {extended && Object.entries(extended).map(([key, value]) => {
                            if (value === false) return null;
                            if (extendedStyles[key]) return null;
                            const displayValue = value === true ? '' : `: ${value}`;
                            return (
                                <div key={key} className="flex items-start gap-2 text-sm text-gray-300 mt-1">
                                    <p className="leading-relaxed">
                                        <span className="font-semibold text-gray-200">{formatUnknownKey(key)}</span>
                                        {displayValue}
                                    </p>
                                </div>
                            );
                        })}

                        {extended && Object.entries(extended).map(([key, value]) => {
                            if (value === false) return null;

                            const style = extendedStyles[key];
                            if (style) {
                                return (
                                    <p key={key} className={`${style.bg} ${style.text} p-3 rounded-lg text-sm mt-1`}>
                                        {style.icon} {style.label}
                                    </p>
                                );
                            }
                            return null;
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
export default ResourceCard;