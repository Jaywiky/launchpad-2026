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
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Ladywood Resources</h1>
      

      {resources.map(resource => (
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