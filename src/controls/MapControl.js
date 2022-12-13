import React from 'react';
import {cloneElement} from "react";
// import ReactDOM from "react-dom/client";
import {createPortal} from "react-dom";
import {useControl} from "react-map-gl";
import classNames from "classnames";

class CustomControl {

    constructor({className}) {
        this._container = document.createElement('div');
        this._container.className = classNames('mapboxgl-ctrl', 'mapboxgl-ctrl-group', className);
    }


    onAdd(map) {
        this._map = map;
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

const MapControl = ({position, className, component}) => {

    const ctrl = useControl(() => {
        return new CustomControl({className});
    }, {position});

    const map = ctrl.getMap();

    return map && createPortal(cloneElement(component), ctrl.getElement());
}

export default React.memo(MapControl);