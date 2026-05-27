import { useState } from 'react'
import ResourceCard from './components/ResourceCard';

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
          <button key={category} onClick={() => setActiveCategory(category)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
      activeCategory === category 
        ? 'bg-[#e2f0d9] text-green-900' 
        : 'bg-[#333333] text-gray-400 hover:bg-[#444444]'
    }`}>{category}</button>
        ))} 
        </div>

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