import {Layer, Source} from "react-map-gl";

const CatchmentSource = ({data}) => {
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

export default CatchmentSource;