import {useEffect, useRef, useState} from "react";
import axios from "axios";
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import classNames from "classnames";
import {round, snapToCenter} from "./utils";
import debounce from "debounce";
import {
    Button,
    FormGroup,
    H5,
    Navbar,
    NavbarGroup,
    Radio,
    RadioGroup,
    Slider,
    Switch,
    Tab,
    Tabs,
    Toaster,
    Spinner,
    Icon,
} from "@blueprintjs/core";
import Map, {
    GeolocateControl,
    Source,
    Layer,
    NavigationControl,
    ScaleControl,
} from 'react-map-gl';
import {HotTable} from '@handsontable/react';
import FileSaver from 'file-saver';

import SearchControl from "./controls/SearchControl";
import StylesControl from "./controls/StylesControl";

import {OutletMarker, CatchmentSource, ExternalLink, Panel} from "./components";

import MapControl from "./controls/MapControl";

// STYLES

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css";

import 'mapbox-gl/dist/mapbox-gl.css';
// import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'handsontable/dist/handsontable.full.min.css';

import './App.scss';
import {DARK} from "@blueprintjs/core/lib/esnext/common/classes";

const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000/' : process.env.REACT_APP_API_ENDPOINT,
    withCredentials: false,
    // timeout: 1000,
    // headers: {'X-Custom-Header': 'foobar'}
});

const mapStyles = [
    {
        id: 'mapbox-streets',
        label: 'Streets',
        url: 'mapbox://styles/mapbox/streets-v11',
    }, {
        id: 'mapbox-satellite',
        label: 'Satellite',
        url: 'mapbox://styles/mapbox/satellite-v9'
    }, {
        id: 'mapbox-satellite-streets',
        label: 'Satellite Streets',
        url: 'mapbox://styles/mapbox/satellite-streets-v12'
    }, {
        id: 'mapbox-outdoors',
        label: 'Outdoors',
        url: 'mapbox://styles/mapbox/outdoors-v12'
    }, {
        id: 'mapbox-light',
        label: 'Light',
        url: 'mapbox://styles/mapbox/light-v11'
    }, {
        id: 'mapbox-dark',
        label: 'Dark',
        url: 'mapbox://styles/mapbox/dark-v11'
    }
]

const mapboxAccessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const createOutlet = (lon, lat, id) => {
    return (
        {
            "type": "Feature",
            "properties": {
                "id": id,
                "marker-symbol": "monument"
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
    )
}

const resolutions = [15, 30];


class Toast {
    constructor() {
        this.toaster = Toaster.create({
            position: "bottom-left"
        });
    }

    success(message) {
        this.toaster.show({message, intent: "success"})
    }

    danger(message) {
        this.toaster.show({message, intent: "danger"})
    }

    warning(message) {
        this.toaster.show({message, intent: "warning"})
    }

    primary(message) {
        this.toaster.show({message, intent: "primary"})
    }
}

const notify = new Toast();

const App = () => {
    const map = useRef();
    const cursor = useRef();
    const originalCatchment = useRef();
    // const resizer = useRef();

    const smallScreen = window.screen.availWidth < 700;

    const [sidebarIsClosed, setSidebarIsClosed] = useState(smallScreen);
    const [projection, setProjection] = useState("globe");
    const [dark, setDark] = useState(false);
    const [mapStyle, setMapStyle] = useState(mapStyles[0]);
    const [outlet, setOutlet] = useState(null);
    const [resolution, setResolution] = useState(30);
    const [outlets, setOutlets] = useState();
    const [autoMode, setAutoMode] = useState(true);
    const [catchments, setCatchments] = useState(null);
    const [catchment, setCatchment] = useState(null);
    const [working, setWorking] = useState(false);
    const [snap] = useState(false);
    const [showTerrain, setShowTerrain] = useState(false);
    const [showStreamlines, setShowStreamlines] = useState(true);
    const [streamlinesThreshold, setStreamlinesThreshold] = useState(50);
    const [tempStreamlinesThreshold, setTempStreamlinesThreshold] = useState();
    const [streamlinesOpacity, setStreamlinesOpacity] = useState(50);
    // const [simplification, setSimplification] = useState(0);
    const [streamlinesTiles, setStreamlinesTiles] = useState();
    const [autoZoom, setAutoZoom] = useState(false);
    const [locked, setLocked] = useState(false);

    const [initialViewState] = useState(() => {
        let _initialViewState = {
            longitude: -116.1,
            latitude: 37.7,
            zoom: 5,
            // bearing: 0,
            // pitch: 0,
        };
        const parts = document.location.hash.split('=');
        if (parts.length === 2) {
            const locs = parts[1].split('/');
            if (locs.length === 5) {
                const [latitude, longitude, zoom, bearing, pitch] = locs;
                _initialViewState = {
                    longitude: Number(longitude),
                    latitude: Number(latitude),
                    zoom: Number(zoom),
                    bearing: Number(bearing),
                    pitch: Number(pitch),
                }
            }
        }
        return _initialViewState;
    })

    useEffect(() => {
        const resizer = new ResizeObserver(debounce(() => map.current && map.current.resize(), 0.5));
        const mapDiv = document.getElementById('map');
        resizer.observe(mapDiv);
        return () => {
            resizer.disconnect();
        }
    }, [])

    useEffect(() => {
        setStreamlinesTiles(null);
        if (showStreamlines) {
            const dataset = `WWF/HydroSHEDS/${resolution}ACC`;
            api.get('ee_tile', {params: {dataset, threshold: streamlinesThreshold}})
                .then(resp => {
                    setStreamlinesTiles(resp.data);
                })
        }
    }, [resolution, showStreamlines, streamlinesThreshold]);

    const toggleStreamlines = () => {
        setShowStreamlines(!showStreamlines);
    }

    const flyTo = (data) => {
        if (!autoZoom || projection === "globe") {
            return;
        }
        const bounds = new mapboxgl.LngLatBounds();
        data.features.forEach(feature => {
            feature.geometry.coordinates.forEach(coords => {
                coords.forEach(coord => {
                    bounds.extend(coord);
                })
            })
        })
        map.current.fitBounds([bounds._sw, bounds._ne], {
            padding: 20
        });
    }

    const handleChangeLocked = () => {
        const newLocked = !locked;
        setLocked(newLocked);
        if (newLocked) {
            setCursor('pointer');
        } else {
            setCursor('crosshair');
        }
    };

    const handleAddOutlet = ({lngLat}) => {
        const {lng: _lon, lat: _lat} = lngLat;
        const id = outlets ? outlets.features.length + 1 : 1;

        // =FLOOR(A5,B$2)+B$2/2
        const lon = snap ? snapToCenter(_lon, resolution) : _lon;
        const lat = snap ? snapToCenter(_lat, resolution) : _lat;
        const newOutlet = createOutlet(lon, lat, id);
        if (autoMode) {
            setOutlet(newOutlet);
            handleQuickDelineate(newOutlet);
        } else {
            const features = outlets ? [...outlets.features, newOutlet] : [newOutlet];
            setOutlets({
                type: 'FeatureCollection',
                features
            });
        }
    }

    const handleMoveOutlet = (updated) => {
        const [lon, lat] = updated.geometry.coordinates;
        const movedOutlet = {
            ...updated,
            geometry: {
                ...updated.geometry,
                coordinates: [
                    snap ? snapToCenter(lon, resolution) : lon,
                    snap ? snapToCenter(lat, resolution) : lat,
                ]
            }
        }
        if (autoMode) {
            setOutlet(movedOutlet);
            handleQuickDelineate(movedOutlet)
        } else {
            setOutlets({
                ...outlets,
                features: outlets.features.map(f => f.properties.id === movedOutlet.properties.id ? movedOutlet : f)
            });
        }
    }

    const handleQuickDelineate = (newOutlet) => {
        const [lon, lat] = newOutlet.geometry.coordinates;
        if (outlet) {
            const [_lon, _lat] = outlet.geometry.coordinates;
            if (_lon === lon && _lat === lat) {
                return;
            }
        }
        setWorking(true);
        setCatchment(null);
        api.get('catchment', {params: {lon, lat, res: resolution}})
            .then(({data}) => {
                setCatchment(data);
                originalCatchment.current = data;
                setWorking(false);
                notify.success("Success!")

                autoZoom && flyTo(data);
            })
            .catch(() => {
                setWorking(false);
                notify.danger("Uh-oh! Something went wrong.")
            });
    }

    const handleDelineateMany = () => {
        setWorking(true);
        setCatchments(null);
        api.post('delineate_catchments', outlets, {params: {res: resolution}}).then(({data}) => {
            setCatchments(data);
            originalCatchment.current = data;
            setWorking(false);
            notify.success("Success!");

            autoZoom && flyTo(data);
        });
    }

    const getCursor = () => map.current.getCanvas().style.cursor;

    const setCursor = (cursor) => {
        map.current.getCanvas().style.cursor = cursor;
    }

    const handleLoadMap = () => {
        setCursor('crosshair');
    }

    const handleMoveStart = () => {
        cursor.current = getCursor();
        setCursor('grab');
    }

    const handleMoveEnd = (e) => {
        setCursor(cursor.current);
        const {latitude, longitude, zoom, bearing, pitch} = e.viewState;
        const _lat = round(latitude, 1000);
        const _lon = round(longitude, 1000);
        const _zoom = round(zoom, 10);
        const _bearing = round(bearing, 10);
        const _pitch = round(pitch, 10);
        const newHash = `#map=${_lat}/${_lon}/${_zoom}/${_bearing}/${_pitch}`;
        const currentHash = document.location.hash;
        const newLocation = currentHash ? document.location.href.replace(currentHash, newHash) : document.location.href + newHash;
        window.history.replaceState({}, '', newLocation);
    }

    const toggleShowTerrain = () => {
        setShowTerrain(!showTerrain);
    }

    useEffect(() => {
        if (map.current) {
            setCursor('crosshair')
        }
    }, [map])

    useEffect(() => {
        if (!map.current) {
            return;
        }
        const terrainSourceID = 'mapbox-dem';
        const _map = map.current.getMap();
        if (showTerrain) {
            if (!_map.getSource(terrainSourceID)) {
                _map.addSource(terrainSourceID, {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });
            }

            // add the DEM source as a terrain layer with exaggerated height
            _map.setTerrain({'source': 'mapbox-dem', 'exaggeration': 1.5});

            // add sky styling with `setFog` that will show when the map is highly pitched
            _map.setFog({
                'horizon-blend': 0.3,
                'color': '#f8f0e3',
                'high-color': '#add8e6',
                'space-color': '#d8f2ff',
                'star-intensity': 0.0
            });
        } else {
            _map.setTerrain(null);
            _map.setFog(null);
        }
    }, [showTerrain]);

    const handleChangeThreshold = (value) => {
        setStreamlinesThreshold(Number(value));
        setTempStreamlinesThreshold();
    }

    const handleChangeTempThreshold = (value) => {
        setTempStreamlinesThreshold(Number(value));
    }

    const handleChangeOpacity = (value) => {
        setStreamlinesOpacity(value);
    }

    const handleChangeAutoZoom = () => {
        setAutoZoom(!autoZoom)
    }

    // const handleChangeSimplification = (e, value) => {
    //     setSimplification(value);
    //     const newFeatures = originalCatchment.current.features.map(feature => {
    //         const newCoordinates = feature.geometry.coordinates.map(coords => rdp(coords, value));
    //         return (
    //             {
    //                 ...feature,
    //                 geometry: {
    //                     ...feature.geometry,
    //                     coordinates: newCoordinates
    //                 }
    //             }
    //         )
    //     });
    //     setCatchment({
    //         ...catchment,
    //         features: newFeatures
    //     });
    // }

    const handleChangeResolution = (e) => {
        setResolution(Number(e.target.value));
    }

    const handleChangeMapStyle = (styleId) => {
        setMapStyle(mapStyles.find(s => s.id === styleId));
    }

    const changeMode = () => {
        setAutoMode(!autoMode);
    }

    const handleDownloadCatchments = () => {
        const blob = new Blob([JSON.stringify(autoMode ? catchment : catchments, null, 2)], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, "catchment.json");
    }

    const handleDownloadOutlets = () => {
        const blob = new Blob([JSON.stringify(autoMode ? outlet : outlets, null, 2)], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, `outlet${autoMode ? "" : "s"}.json`);
    }

    const handleClearWorkspace = () => {
        setOutlet(null);
        setOutlets(null);
        setCatchment(null);
        setCatchments(null);
    }

    // const changeSelectedTab = (e, value) => {
    //     setSelectedTab(value);
    // }

    // const simplifyMax = 0.01;

    return (
        <div className={classNames("app", {[DARK]: dark}, sidebarIsClosed ? "sidebar-closed" : "")}>
            <div className="spinner-wrapper" style={{display: working ? "flex" : "none"}}>
                <Spinner size={100} intent="none" className="spinner"/>
            </div>
            <Navbar>
                <NavbarGroup align="left">
                    <Navbar.Heading><a href="https://flowdirections.io">flowdirections.io</a></Navbar.Heading>
                    <Switch large label={"Lock editing"} style={{margin: 0, marginLeft: 10}} checked={locked}
                            onChange={handleChangeLocked}/>
                    <Button minimal icon={dark ? "flash" : "moon"} style={{marginLeft: 10}}
                            onClick={() => setDark(!dark)}/>
                </NavbarGroup>
                <NavbarGroup align="right">
                    <a href={process.env.REACT_APP_DONATE_LINK} target="_blank" rel="noreferrer"
                       style={{marginRight: 20}}>Donate</a>
                    {/*<a href="https://www.github.com/openagua/flowdirections.io"*/}
                    {/*   target="_blank" style={{display: "flex"}}><GitHubIcon/></a>*/}
                </NavbarGroup>
            </Navbar>
            <div className="main">
                <div id="map" className="map">
                    <Map
                        ref={map}
                        key={projection}
                        initialViewState={initialViewState}
                        maxPitch={85}
                        onLoad={handleLoadMap}
                        onClick={locked ? null : handleAddOutlet}
                        onMoveEnd={handleMoveEnd}
                        onMoveStart={handleMoveStart}
                        mapStyle={mapStyle.url}
                        mapboxAccessToken={mapboxAccessToken}
                        projection={projection}
                    >
                        <SearchControl accessToken={mapboxAccessToken} position="top-left"/>
                        <MapControl position="top-right" component={
                            <button onClick={() => setSidebarIsClosed(!sidebarIsClosed)}><Icon icon="menu"/>
                            </button>
                        }/>
                        <NavigationControl position="top-right"/>
                        {/*<FitAllControl position="top-right"/>*/}
                        <GeolocateControl/>
                        {/*{autoMode && <DrawControl*/}
                        {/*    position="top-left"*/}
                        {/*    displayControlsDefault={false}*/}
                        {/*    controls={{point: true, trash: true}}*/}
                        {/*    onUpdate={setOutlets}*/}
                        {/*/>}*/}
                        <StylesControl position="bottom-left" mapStyles={mapStyles} onChange={handleChangeMapStyle}
                                       initialSelected={mapStyle.id}/>
                        <ScaleControl position="bottom-right"/>
                        {streamlinesTiles &&
                            <Source key={streamlinesTiles} id="streamlines-raster" type="raster"
                                    tiles={[streamlinesTiles]}>
                                <Layer
                                    source="streamlines-raster"
                                    type="raster"
                                    paint={{
                                        "raster-opacity": streamlinesOpacity / 100
                                    }}
                                />
                            </Source>}
                        <CatchmentSource data={autoMode ? catchment : catchments}/>
                        {autoMode && outlet &&
                            <OutletMarker outlet={outlet} draggable={!locked} onDragEnd={handleMoveOutlet}/>}
                        {!autoMode && outlets && outlets.features.map(o =>
                            <OutletMarker key={o.properties.id} outlet={o} draggable={!locked}
                                          onDragEnd={handleMoveOutlet}/>)}
                    </Map>
                </div>
                <div className="map-sidebar">
                    <Tabs id="sidebar-tabs" large>
                        <Tab id="home" title="Home" panel={
                            <Panel>
                                <Button fill large icon="eraser" onClick={handleClearWorkspace}>
                                    {("Clear workspace")}</Button>
                                <br/>
                                <FormGroup
                                    helperText={("Auto mode will delineate a catchment as soon as you left-click a map.")}>
                                    <Switch large checked={autoMode} onChange={changeMode} label={("Auto mode")}/>
                                </FormGroup>
                                {!autoMode && <div>
                                    <div>
                                        {outlets && outlets.features.length ?
                                            <HotTable
                                                data={outlets.features.map(o => {
                                                    const coords = o.geometry.coordinates;
                                                    return ([coords[0], coords[1]])
                                                })}
                                                rowHeaders={true}
                                                colHeaders={["Lon", "Lat"]}
                                                height="auto"
                                                licenseKey="non-commercial-and-evaluation" // for non-commercial use only
                                            /> : <div>
                                                Add outlets by left-clicking on the map.
                                            </div>}
                                    </div>
                                    {outlets && <div style={{marginTop: 10, marginBottom: 10}}>
                                        <Button intent="primary" onClick={handleDelineateMany}>{("Submit")}</Button>
                                    </div>}
                                </div>}
                                <div className="bottom">
                                    {(catchment || catchments) &&
                                        <div>

                                            {/*<FormLabel>Simplify</FormLabel>*/}
                                            {/*<Slider defaultValue={0} step={simplifyMax/10} min={0} max={simplifyMax}*/}
                                            {/*        onChange={handleChangeSimplification}/>*/}

                                            {/*<Button variant="contained">Shapefile</Button>*/}
                                            <div className="download-area">
                                                {((autoMode && outlet) || outlets) &&
                                                    <div>
                                                        <H5>{autoMode ? ("Download outlet") : ("Download outlet(s)")}</H5>
                                                        <div>
                                                            <Button small
                                                                    onClick={handleDownloadOutlets}>GeoJSON</Button>
                                                            {/*<Button small*/}
                                                            {/*        onClick={handleDownloadOutlets}>Shapefile</Button>*/}
                                                        </div>
                                                    </div>
                                                }
                                                {((autoMode && catchment) || catchments) &&
                                                    <div>
                                                        <H5>{autoMode ? ("Download catchment") : ("Download catchment(s)")}</H5>
                                                        <div>
                                                            <Button small
                                                                    onClick={handleDownloadCatchments}>GeoJSON</Button>
                                                            {/*<Button small*/}
                                                            {/*        onClick={handleDownloadCatchments}>Shapefile</Button>*/}
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                        </div>}
                                </div>

                            </Panel>
                        }/>
                        <Tab id="settings" title={("Settings")} panel={
                            <Panel>
                                <RadioGroup label={("Resolution (arc seconds)")} large inline
                                            selectedValue={resolution} onChange={handleChangeResolution}>
                                    {resolutions.map(res => <Radio key={res} label={`${res}"`} value={res}/>)}
                                </RadioGroup>

                                <FormGroup
                                    label={<Switch large checked={showStreamlines} onChange={toggleStreamlines}
                                                   label={("Show streamlines")}/>}>

                                    {showStreamlines &&
                                        <div>
                                            <FormGroup label={("Streamline density")}>
                                                <Slider value={tempStreamlinesThreshold || streamlinesThreshold}
                                                        min={0}
                                                        max={100}
                                                        stepSize={5}
                                                        labelStepSize={25}
                                                        onChange={handleChangeTempThreshold}
                                                        onRelease={handleChangeThreshold}/>
                                            </FormGroup>
                                            <FormGroup label={("Streamline opacity")}>
                                                <Slider value={streamlinesOpacity}
                                                        min={0}
                                                        max={100}
                                                        stepSize={5}
                                                        labelStepSize={25}
                                                        onChange={handleChangeOpacity}/>
                                            </FormGroup>


                                        </div>}
                                </FormGroup>
                                <FormGroup inline label={("Projection")}>
                                    <RadioGroup selectedValue={projection} inline
                                                onChange={e => setProjection(e.currentTarget.value)}>
                                        {["Globe", "Mercator"].map(proj =>
                                            <Radio key={proj} value={proj.toLowerCase()} label={proj}/>)}
                                    </RadioGroup>
                                </FormGroup>
                                <Switch large checked={showTerrain} onChange={toggleShowTerrain}
                                        label={("Show 3-D terrain")}/>
                                <Switch large checked={projection !== "globe" ? autoZoom : false}
                                        disabled={projection === "globe"} onChange={handleChangeAutoZoom}
                                        label={("Autozoom")}/>
                            </Panel>
                        }/>
                        <Tab id="about" title={("About")} panel={
                            <Panel>
                                <p>
                                    This app is based on <ExternalLink href="https://mattbartos.com/pysheds/">pysheds
                                </ExternalLink>, with <ExternalLink
                                    href="https://www.hydrosheds.org">HydroSHEDS</ExternalLink> for the source
                                    grid data, and&nbsp;
                                    <ExternalLink href="https://www.mapbox.com">Mapbox</ExternalLink> for the
                                    mapping environment. <ExternalLink
                                    href="https://www.github.com/openagua/flowdirections.io#readme">Read
                                    more here</ExternalLink>. The app is also inspired by <ExternalLink
                                    href="https://geojson.io/">geojson.io</ExternalLink>, which you may find
                                    useful.
                                </p>
                                <p>
                                    "flowdirections" refers to a flow direction grid, a key intermediary in the
                                    catchment delineation process and other DEM-derived analyses. It also
                                    invokes mapping water and its movement ("hydrography" doesn't roll off the
                                    tongue as smoothly).
                                </p>
                                <h4>Other similar/related tools</h4>
                                <ul>
                                    <li><ExternalLink href="https://river-runner-global.samlearner.com/">River
                                        Runner</ExternalLink>: "Tap to drop a raindrop anywhere in the world and
                                        watch where it ends up"
                                    </li>
                                    <li><ExternalLink href="https://streamstats.usgs.gov/ss/">USGS
                                        StreamStats</ExternalLink>: U.S.-only stream info, including delineation
                                    </li>
                                </ul>
                                <h4>Feedback</h4>
                                <p>
                                    Would you like to submit a bug or have a suggestion for improvement? Please
                                    open an issue in the site's <ExternalLink
                                    href="https://github.com/openagua/flowdirections.io/issues">issue
                                    tracker</ExternalLink>!
                                </p>
                                <h4>Privacy</h4>
                                <p>None of your data is stored with flowdirections.io. The backend server only
                                    performs
                                    calculations (<ExternalLink
                                        href="https://www.github.com/openagua/flowdirections-api">source
                                        code</ExternalLink>), while the app that you are
                                    currently using does not use cookies, and only stores data on your computer,
                                    during your session
                                    (<ExternalLink
                                        href="https://www.github.com/openagua/flowdirections.io">source
                                        code</ExternalLink>). This
                                    may change in the future, in which case you will know about it.</p>
                            </Panel>
                        }/>
                        <Tabs.Expander/>
                        <Button small minimal onClick={() => setSidebarIsClosed(true)} icon="cross"/>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

export default App;
