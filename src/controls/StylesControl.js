import {Button} from "@blueprintjs/core";
import MapControl from "./MapControl";

const MapStyleButton = ({mapStyle, onClick}) => {
    const handleClick = () => onClick(mapStyle.id);
    return (
        <Button fill onClick={handleClick}>
            <div>{mapStyle.label}</div>
        </Button>
    )
}

const StylesControl = ({position, mapStyles, onChange}) => {
    return (
        <MapControl position={position}>
            <div style={{display: "flex"}}>
                {mapStyles.map(mapStyle =>
                    <MapStyleButton key={mapStyle.label} mapStyle={mapStyle} onClick={onChange}/>
                )}
            </div>
        </MapControl>
    )
}


export default StylesControl;