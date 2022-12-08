import {Button, Icon} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import MapControl from "./MapControl";
import {useState} from "react";

const StylesControl = ({position, mapStyles, initialSelected, onChange}) => {

    const [selected, setSelected] = useState(initialSelected);

    const handleClick = (e) => {
        const selectedId = e.currentTarget.id;
        onChange(selectedId);
        setSelected(selectedId);
    }

    return (
        <MapControl position={position} component={
            <Popover2
                interactionKind="hover"
                position="left-bottom"
                content={
                    <div className="map-styles-control">
                        {mapStyles.map(mapStyle => {
                                const isSelected = selected === mapStyle.id;
                                return (
                                    <Button key={mapStyle.id} id={mapStyle.id}
                                            className={isSelected ? "selected" : null}
                                            minimal outlined
                                            onClick={handleClick}>
                                        <img alt={mapStyle.label} src={`/images/tiles/${mapStyle.id}.png`}/>
                                        <div>{mapStyle.label}</div>
                                    </Button>
                                )
                            }
                        )}
                    </div>
                }>
                <Button large minimal className="map-styles-control-button">
                    <Icon size={20} icon="layers"/>
                </Button>
            </Popover2>
        }/>
    )
}


export default StylesControl;