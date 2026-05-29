import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet'
import { Geolocation } from '@capacitor/geolocation'

function RecenterOnce({ pos }) {
  const map = useMap()
  const [hasRecentered, setHasRecentered] = useState(false)

  useEffect(() => {
    if (pos && !hasRecentered) {
      map.setView(pos, 15)
      setHasRecentered(true);
    }
  }, [pos, hasRecentered, map])

  return null
}



function LocateButton({ pos, loading, onLocate }) {
  const map = useMap()

  const handleClick = () => {
    if (pos) {
      map.flyTo(pos, 16, { duration: 0.5 })
    } else {
      onLocate()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="absolute top-4 right-4 z-[1000] bg-white rounded-full w-10 h-10 shadow-md flex items-center justify-center active:bg-gray-100"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={pos ? '#4285F4' : '#999'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      )}
    </button>
  )
}

export default function UserMap() {
  const [userPos, setUserPos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRealPos, setIsRealPos] = useState(false)

  const fetchLocation = async () => {
    setLoading(true)
    setError(null)

    try {
      await Geolocation.requestPermissions()

      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
        })
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setIsRealPos(true)
      } catch {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
        })
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setIsRealPos(true)
      }
    } catch (err) {
      console.error('Location error:', err)
      setError('Could not get location')
      setUserPos([52.475109, -1.922240])
      setIsRealPos(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocation()
  }, [])

  return (
    <div className="fixed inset-0 z-0">
      <style>{`
        .leaflet-right .leaflet-control-zoom {
          margin-top: 75px !important;
          margin-right: 18px !important; 
        }
      `}</style>
      {error && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
          <button onClick={fetchLocation} className="ml-2 underline">Retry</button>
        </div>
      )}

      <MapContainer
        center={[52.481346, -1.918235]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterOnce pos={userPos} />

        {userPos && (
          <>
            <CircleMarker
              center={userPos}
              radius={20}
              pathOptions={{
                fillColor: isRealPos ? '#4285F4' : '#999',
                fillOpacity: 0.15,
                color: isRealPos ? '#4285F4' : '#999',
                weight: 1,
                opacity: 0.3,
              }}
            />
            <CircleMarker
              center={userPos}
              radius={8}
              pathOptions={{
                fillColor: isRealPos ? '#4285F4' : '#999',
                fillOpacity: 1,
                color: '#ffffff',
                weight: 3,
              }}
            >
              <Popup>{isRealPos ? 'You are here' : 'Approximate location'}</Popup>
            </CircleMarker>
          </>
        )}

        <LocateButton pos={userPos} loading={loading} onLocate={fetchLocation} />
      </MapContainer>
    </div>
  )
}