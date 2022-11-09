import {useControl} from "react-map-gl";

class FitAllControlClass {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-geolocate';
        // button.textContent = 'H';
        button.type = 'button';
        this._container.append(button);

        const span = document.createElement('span');
        span.className = 'mapboxgl-ctrl-icon';
        button.append(span);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

const FitAllControl = ({position}) => {
    useControl(({map}) => {
        return new FitAllControlClass();
    }, {position});
}

export default FitAllControl;