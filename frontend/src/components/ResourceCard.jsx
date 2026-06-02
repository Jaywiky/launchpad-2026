import { useTranslation } from 'react-i18next';

function ResourceCard({ name, type, notes, extended, distance, onClick }) {
    const { t } = useTranslation();

    return (
        <div 
            onClick={onClick}
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
            {extended && extended.referral_required && <p className="bg-[#fadbe9] text-[#5c133a] p-3 rounded-lg text-sm">⚠️ Referral Required</p>}
            {extended && extended.accessible && <p>♿ Wheelchair Accessible</p>}
        </div>
    );
}

export default ResourceCard;