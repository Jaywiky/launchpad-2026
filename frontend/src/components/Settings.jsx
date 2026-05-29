export default function Settings({ onClose }) {
  return (
    <div className="h-screen w-full bg-[#111111] text-white p-6 overflow-y-auto">
      <div className="flex items-center mb-8">
        <button 
          onClick={onClose}
          className="bg-[#333333] hover:bg-[#444444] text-white px-4 py-2 rounded-lg mr-4 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
        <div className="bg-[#222222] p-4 rounded-xl border border-[#333333]">
          <h2 className="text-lg font-semibold mb-2">Language Preferences</h2>
          <p className="text-sm text-gray-400 mb-4">Choose your preferred app language.</p>
          <div className="flex gap-2">
            <button className="bg-[#e2f0d9] text-green-900 px-4 py-2 rounded-lg font-medium text-sm">English</button>
            <button className="bg-[#333333] text-gray-400 px-4 py-2 rounded-lg font-medium text-sm">Polski</button>
            <button className="bg-[#333333] text-gray-400 px-4 py-2 rounded-lg font-medium text-sm">اردو</button>
          </div>
        </div>

        <div className="bg-[#222222] p-4 rounded-xl border border-[#333333]">
          <h2 className="text-lg font-semibold mb-2">Toggle P2P</h2>
          <p className="text-sm text-gray-400">Toggle the ability to download data from Bluetooth.</p>
          <button className="mt-4 bg-red-900/30 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg text-sm font-medium">
            Toggle P2P
          </button>
        </div>
      </div>
    </div>
  );
}