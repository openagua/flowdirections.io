import mapboxgl from 'mapbox-gl';
import {useControl} from "react-map-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

export const SearchControl = ({accessToken, position}) => {
    useControl(({map}) => {
        return new MapboxGeocoder({
            accessToken,
            mapboxgl
        });
    }, {position})
}

export default SearchControl;