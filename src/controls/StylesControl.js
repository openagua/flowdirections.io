import {Button} from "@mui/material";
import MapControl from "./MapControl";

const StyleButton = ({mapStyle: style, onClick}) => {
    const handleClick = () => onClick(style.id);
    return (
        <Button style={{width: "100%", padding: 5, display: "flex"}} onClick={handleClick}>{style.label}</Button>
    )
}

const StylesControl = ({position, styles, onChange}) => {
    return (
        <MapControl position={position}>
            <div>
                {styles.map(style =>
                    <StyleButton key={style.label} mapStyle={style} onClick={onChange}/>
                )}
            </div>
        </MapControl>
    )
}


export default StylesControl;