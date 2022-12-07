import React from 'react';
import {cloneElement} from "react";
// import ReactDOM from "react-dom/client";
import {createPortal} from "react-dom";
import {useControl} from "react-map-gl";

class CustomControl {

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        return this._container;
    }

    onRemove() {
        this._container.remove();
        this._map = undefined;
    }

    getMap() {
        return this._map;
    }

    getElement() {
        return this._container;
    }
}

const MapControl = ({position, component}) => {
    const ctrl = useControl(() => {
        return new CustomControl();
    }, {position});

    const map = ctrl.getMap();

    return map && createPortal(cloneElement(component, {map}), ctrl.getElement());
}

export default React.memo(MapControl);