function ResourceCard({ name, type, notes, extended }) {
    return (
        <div className="bg-[#2d2d2d] p-4 rounded-xl border border-gray-700 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-white">{name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{notes}</p>
                </div>
                <span className="px-2 py-1 bg-[#e2f0d9] text-green-900 text-xs font-medium rounded-full">
                    {type}
                </span>
            </div>
                {extended.referral_required && <p className="bg-[#fadbe9] text-[#5c133a] p-3 rounded-lg text-sm">⚠️ Referral Required</p>}
                {extended.accessible && <p>♿ Wheelchair Accessible</p>}
        </div>
    )
}

export default ResourceCard;