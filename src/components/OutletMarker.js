import {Marker} from "react-map-gl";
import mapboxgl from "mapbox-gl";

const OutletMarker = ({outlet, draggable, onDragEnd}) => {
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

export default OutletMarker;