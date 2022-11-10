import ReactDOM from "react-dom/client";
import {useControl} from "react-map-gl";

class MapControlClass {

    constructor(element) {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        const root = ReactDOM.createRoot(this._container);
        root.render(element);
    }

    onAdd(map) {
        this._map = map;
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

const MapControl = ({position, children}) => {
    useControl(({map}) => {
        return new MapControlClass(children);
    }, {position});
}

export default MapControl;