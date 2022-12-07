import React from 'react';
import {cloneElement} from "react";
import ReactDOM from "react-dom/client";
import {createPortal} from "react-dom";
import {useControl} from "react-map-gl";

class MapControlClass {

    constructor(element) {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        const root = ReactDOM.createRoot(this._container);
        root.render(element);
        createPortal(element, this._container);
    }

    onAdd(map) {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._map = map;
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    getMap() {
        return this._map;
    }

    getElement() {
        return this._container;
    }
}

const MapControl = ({position, children, ...otherProps}) => {
    const ctrl = useControl(() => {
        return new MapControlClass();
    }, {position});

    const map = ctrl.getMap();

    return map && createPortal(cloneElement(children, otherProps), ctrl.getElement());
}

export default React.memo(MapControl);