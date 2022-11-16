import {useRef} from "react";
import {useControl} from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

const DrawControl = ({position, onUpdate, ...props}) => {
    // const points = useRef([]);
    // const handleCreate = ({features}) => {
    //     points.current = [...points.current, ...features];
    //     const newOutlets = {
    //         type: 'FeatureCollection',
    //         features: points.current
    //     }
    //     onUpdate(newOutlets);
    // }
    useControl(({map}) => {
        // map.on('draw.create', handleCreate);
        return new MapboxDraw(props)
    }, {position});
    return null;
}

export default DrawControl;