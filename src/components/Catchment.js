import {Layer, Source} from "react-map-gl";

const Catchment = ({data}) => {
    const sourceId = "catchments-geojson";

    if (!data) {
        return null;
    }

    const fillColor = '#169eff';

    return (
        <Source id={sourceId} type="geojson" data={data}>
            <Layer
                id="catchments-fill"
                type="fill"
                paint={{
                    'fill-color': fillColor,
                    'fill-opacity': 0.25,
                }}
            />
            <Layer
                id="catchments-outline"
                type="line"
                paint={{
                    'line-color': fillColor,
                    'line-width': 3
                }}
            />
        </Source>
    )
}

export default Catchment;