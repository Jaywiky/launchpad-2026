import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';

function RecenterMap({ pos }) {
  const map = useMap();
  useEffect(() => {
    map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

export default function UserMap() {
  const [userPos, setUserPos] = useState(null);

  useEffect(() => {
    let watchId;

    const start = async () => {
      await Geolocation.requestPermissions();
      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (position, err) => {
          if (position) {
            setUserPos([position.coords.latitude, position.coords.longitude]);
          }
        }
      );
    };

    start();
    return () => { if (watchId) Geolocation.clearWatch({ id: watchId }); };
  }, []);

  return (
    <MapContainer
      center={userPos ?? [51.505, -0.09]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-64 mb-6 rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userPos && (
        <>
          <RecenterMap pos={userPos} />
          <CircleMarker
            center={userPos}
            radius={20}
            pathOptions={{ fillColor: '#4285F4', fillOpacity: 0.15, color: '#4285F4', weight: 1, opacity: 0.3 }}
          />
          <CircleMarker
            center={userPos}
            radius={8}
            pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#ffffff', weight: 3 }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );
}