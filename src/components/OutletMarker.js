import {Marker} from "react-map-gl";
import mapboxgl from "mapbox-gl";
import {ContextMenu2} from "@blueprintjs/popover2";
import {Button, Icon} from "@blueprintjs/core";

const OutletMarker = ({index, outlet, draggable, onDragEnd, onDelete}) => {

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
    const handleDelete = () => {
        onDelete(index);
    }
    const coords = outlet.geometry.coordinates;
    const [lon, lat] = coords;
    const size = 30;
    return (
        <Marker
            longitude={lon}
            latitude={lat}
            draggable={draggable}
            mapboxgl={mapboxgl}
            onDragEnd={handleMoveOutlet}
            offset={[0, size / 2]}
            anchor="bottom"
        >
            <ContextMenu2
                position="top"
                content={
                    <div style={{padding: 5}}>
                        <Button onClick={handleDelete} small icon="trash" intent="danger">Delete</Button>
                    </div>
                }>
                <Icon size={size} color="red" icon="target"/>
            </ContextMenu2>
        </Marker>
    )
}

export default OutletMarker;