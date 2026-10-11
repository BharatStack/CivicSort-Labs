import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { BBMP_WARDS, BBMP_ZONES, BANGALORE_CENTER, findNearestWard, type BBMPWard } from '@/data/bbmpWards';
import { MapPin, Navigation } from 'lucide-react';

// Fix default marker icon issue in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface BBMPMapProps {
  issues?: Array<{
    id: string;
    title: string;
    latitude: number | null;
    longitude: number | null;
    status: string | null;
    category?: string | null;
    ward_id?: number | null;
    ward_name?: string | null;
  }>;
  onWardClick?: (ward: BBMPWard) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedWardId?: number | null;
  userLocation?: { lat: number; lng: number } | null;
  userWard?: BBMPWard | null;
  height?: string;
  showIssuePins?: boolean;
  interactive?: boolean;
  pinLocation?: { lat: number; lng: number } | null;
}

// Basemap: OpenFreeMap vector tiles — free, no API key, no usage limits (openfreemap.org)
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

// Vector tiles need WebGL; very old Android WebViews fall back to OSM raster tiles
const HAS_WEBGL = (() => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
})();

function VectorBasemap() {
  const map = useMap();
  useEffect(() => {
    const layer = maplibreGL({
      style: OPENFREEMAP_STYLE,
      attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

// Tap/click on the map moves the report pin
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

// Component to handle map events and flying to locations
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    // setView (not flyTo): the MapLibre basemap layer doesn't redraw after flyTo animations
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Ward issue count badge
function getIssueCountForWard(wardId: number, issues: BBMPMapProps['issues']): number {
  if (!issues) return 0;
  return issues.filter(i => i.ward_id === wardId).length;
}

const BBMPMap: React.FC<BBMPMapProps> = ({
  issues = [],
  onWardClick,
  onMapClick,
  selectedWardId,
  userLocation,
  userWard,
  height = '100%',
  showIssuePins = true,
  interactive = true,
  pinLocation,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(BANGALORE_CENTER);
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(14);
    }
  }, [userLocation]);

  // Group issues by ward for counts
  const wardIssueCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    issues.forEach(issue => {
      if (issue.ward_id) {
        counts[issue.ward_id] = (counts[issue.ward_id] || 0) + 1;
      }
    });
    return counts;
  }, [issues]);

  // Status color for issue pins
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'resolved': return '#22c55e';
      case 'in_progress': return '#f59e0b';
      case 'pending': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ height, width: '100%', position: 'relative' }} className="rounded-2xl overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={true}
      >
        {HAS_WEBGL ? (
          <VectorBasemap />
        ) : (
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        )}

        <MapController center={mapCenter} zoom={mapZoom} />
        {interactive && onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* Ward markers — zone-colored circles */}
        {BBMP_WARDS.map((ward) => {
          const zoneInfo = BBMP_ZONES[ward.zone];
          const isSelected = selectedWardId === ward.ward_id;
          const isUserWard = userWard?.ward_id === ward.ward_id;
          const issueCount = wardIssueCounts[ward.ward_id] || 0;
          const radius = Math.max(6, Math.min(14, 6 + issueCount * 1.5));

          return (
            <CircleMarker
              key={ward.ward_id}
              center={[ward.latitude, ward.longitude]}
              radius={isSelected || isUserWard ? radius + 4 : radius}
              pathOptions={{
                fillColor: zoneInfo?.color || '#6b7280',
                fillOpacity: isSelected ? 1 : isUserWard ? 0.9 : 0.7,
                color: isSelected ? '#f59e0b' : isUserWard ? '#3b82f6' : 'white',
                weight: isSelected ? 3 : isUserWard ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onWardClick?.(ward),
              }}
            >
              <Popup>
                <div className="font-sans p-1">
                  <p className="font-bold text-sm">{ward.ward_name}</p>
                  <p className="text-xs text-gray-500">{ward.zone} Zone · Ward #{ward.ward_id}</p>
                  {issueCount > 0 && (
                    <p className="text-xs mt-1 font-medium text-orange-600">{issueCount} issue{issueCount > 1 ? 's' : ''} reported</p>
                  )}
                  <p className="text-xs mt-1 text-gray-600">MLA: {ward.mla_name} ({ward.mla_party})</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Issue pins */}
        {showIssuePins && issues.map((issue) => {
          if (!issue.latitude || !issue.longitude) return null;
          return (
            <CircleMarker
              key={issue.id}
              center={[issue.latitude, issue.longitude]}
              radius={5}
              pathOptions={{
                fillColor: getStatusColor(issue.status),
                fillOpacity: 0.9,
                color: '#fff',
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="font-sans p-1">
                  <p className="font-bold text-xs">{issue.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{issue.status || 'pending'}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* User location pulsing dot */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={300}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                color: '#3b82f6',
                weight: 1,
              }}
            />
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 1,
                color: '#ffffff',
                weight: 3,
              }}
            >
              <Popup>
                <div className="font-sans p-1">
                  <p className="font-bold text-xs">📍 You are here</p>
                  {userWard && (
                    <p className="text-xs text-gray-500">{userWard.ward_name} · {userWard.zone} Zone</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Draggable pin for report submission */}
        {pinLocation && (
          <Marker
            position={[pinLocation.lat, pinLocation.lng]}
            draggable={interactive}
            eventHandlers={{
              dragend: (e) => {
                const latlng = e.target.getLatLng();
                onMapClick?.(latlng.lat, latlng.lng);
              },
            }}
          />
        )}
      </MapContainer>

      {/* Zone Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 border border-gray-200">
        <p className="text-[10px] font-bold text-gray-700 mb-2 uppercase tracking-wider">BBMP Zones</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(BBMP_ZONES).map(([zone, info]) => (
            <div key={zone} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: info.color }}
              />
              <span className="text-[10px] text-gray-600 whitespace-nowrap">{info.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User ward banner */}
      {userWard && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-4 py-2 border border-emerald-200 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-700">
            You are in <span className="font-bold text-emerald-700">{userWard.ward_name}</span> · {userWard.zone} Zone
          </span>
        </div>
      )}
    </div>
  );
};

export default BBMPMap;
