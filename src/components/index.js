import mapboxgl from "mapbox-gl";
import {Layer, Marker, Source} from "react-map-gl";

export const OutletMarker = ({outlet, draggable, onDragEnd}) => {
    const handleMoveOutlet = ({lngLat}) => {
        const {lng, lat} = lngLat;
        const newOutlet = {
            ...outlet,
            geometry: {
                ...outlet.geometry,
                coordinates: [lng, lat]
            }
        }
        onDragEnd(newOutlet);
    }
    const coords = outlet.geometry.coordinates;
    return (
        <Marker
            longitude={coords[0]}
            latitude={coords[1]}
            draggable={draggable}
            mapboxgl={mapboxgl}
            onDragEnd={handleMoveOutlet}
            offset={[0, 0]}
            anchor="bottom"
        />
    )
}

export const CatchmentSource = ({data}) => {
    const sourceId = "catchments-geojson";

    if (!data) {
        return null;
    }

    return (
        <Source id={sourceId} type="geojson" data={data}>
            <Layer
                id="catchments-fill"
                type="fill"
                paint={{
                    'fill-color': '#4E3FC8',
                    'fill-opacity': 0.5,
                }}
            />
            <Layer
                id="catchments-outline"
                type="line"
                paint={{
                    'line-color': '#4E3FC8',
                    'line-width': 3
                }}
            />
        </Source>
    )
}

export const ExternalLink = ({children, ...props}) => <a {...props} target="_blank" rel="noreferrer">{children}</a>
