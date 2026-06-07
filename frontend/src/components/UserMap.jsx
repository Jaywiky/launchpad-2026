import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet'
import { Geolocation } from '@capacitor/geolocation'
import { App as CapacitorApp } from '@capacitor/app'
import { useTranslation } from 'react-i18next'

const getMarkerColor = (type, colorBlind) => {
  if (colorBlind) {
    switch (type) {
      case 'food_bank': return '#E69F00';
      case 'toilet': return '#56B4E9';
      case 'library': return '#009E73';
      case 'recycling': return '#F0E442';
      case 'green_space': return '#CC79A7';
      default: return '#757575';
    }
  } else {
    switch (type) {
      case 'food_bank': return '#2E7D32';
      case 'toilet': return '#1565C0';
      case 'library': return '#EF6C00';
      case 'recycling': return '#00838F';
      case 'green_space': return '#558B2F';
      default: return '#757575';
    }
  }
}

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

function FlyToSelectedResource({ pos }) {
  const map = useMap()

  useEffect(() => {
    if (pos) {
      const targetZoom = 16;
      const targetPoint = map.project(pos, targetZoom);
      const yOffset = window.innerHeight * 0.25;
      targetPoint.y += yOffset;
      const offsetLatLng = map.unproject(targetPoint, targetZoom);

      map.flyTo(offsetLatLng, targetZoom, { duration: 0.8 });

      map.eachLayer((layer) => {
        if (layer.getLatLng && typeof layer.openPopup === 'function') {
          const layerLatLng = layer.getLatLng();

          if (
            Math.abs(layerLatLng.lat - pos[0]) < 0.0001 &&
            Math.abs(layerLatLng.lng - pos[1]) < 0.0001
          ) {
            layer.openPopup();
          }
        }
      });
    }
  }, [pos, map])

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

export default function UserMap({ resources = [], activeCategory = ['All'], onLocationUpdate, selectedPos, colorBlind }) {
  const { t } = useTranslation()
  const [userPos, setUserPos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRealPos, setIsRealPos] = useState(false)

  const fetchLocation = async () => {
    setLoading(true)

    try {
      await Geolocation.requestPermissions()

      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
        })
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords)
        setIsRealPos(true)
        if (onLocationUpdate) onLocationUpdate(coords)
      } catch {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
        })
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords)
        setIsRealPos(true)
        if (onLocationUpdate) onLocationUpdate(coords)
      }
    } catch (err) {
      const fallbackCoords = [52.483, -1.913];
      setUserPos(fallbackCoords)
      setIsRealPos(false)
      if (onLocationUpdate) onLocationUpdate(fallbackCoords)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocation()

    const listenerHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[UserMap] App returned to foreground, refreshing location data')
        fetchLocation()
      }
    })

    return () => {
      listenerHandle.then(l => l.remove())
    }
  }, [])

  const visibleMarkers = resources.filter((item) => {
    if (!item) return false;
    if (activeCategory.includes('All')) return true;
    return activeCategory.includes(item.type);
  });

  return (
    <div className="fixed inset-0 z-0">
      <style>{`
        .leaflet-right .leaflet-control-zoom {
          margin-top: 75px !important;
          margin-right: 18px !important; 
        }
      `}</style>

      <MapContainer
        center={[52.481346, -1.918235]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterOnce pos={userPos} />
        <FlyToSelectedResource pos={selectedPos} />

        {visibleMarkers.map((item) => {
          if (!item || !item.lat || !item.lng) return null;

          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;

          return (
            <CircleMarker
              key={item.id}
              center={[Number(item.lat), Number(item.lng)]}
              radius={9}
              pathOptions={{
                fillColor: getMarkerColor(item.type, colorBlind),
                fillOpacity: 0.85,
                color: '#FFFFFF',
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-black font-sans min-w-[160px]">
                  <h3 className="font-bold text-sm leading-tight mb-0.5">{item.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">
                    {t(item.type.toLowerCase())}
                  </span>

                  {item.address && (
                    <p className="text-xs text-gray-600 mt-1.5 border-t border-gray-100 pt-1">
                      📍 {item.address}
                    </p>
                  )}

                  {item.opening_hours && (
                    <p className="text-xs text-blue-700 font-medium mt-1">
                      🕒 {item.opening_hours}
                    </p>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center w-full bg-[#4285F4] hover:bg-[#3367D6] !text-white py-1.5 rounded text-xs font-semibold transition-colors shadow-sm"
                  >
                    {t('get_directions', 'Get Directions')}
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

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
            />
          </>
        )}

        <LocateButton pos={userPos} loading={loading} onLocate={fetchLocation} />
      </MapContainer>
    </div>
  )
}