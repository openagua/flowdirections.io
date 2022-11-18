import {useEffect, useRef, useState} from "react";
import axios from "axios";
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax


import {
    Button,
    FormGroup,
    H5,
    Menu,
    Navbar,
    NavbarGroup,
    Radio,
    RadioGroup,
    Slider,
    Switch,
    Tab,
    Tabs,
    Toaster,
    Spinner, ButtonGroup
} from "@blueprintjs/core";

import {MenuItem2, Popover2} from "@blueprintjs/popover2";

import Map, {
    GeolocateControl,
    Source,
    Layer,
    NavigationControl,
    ScaleControl,
    Marker,
} from 'react-map-gl';
import {HotTable} from '@handsontable/react';
import FileSaver from 'file-saver';

import SearchControl from "./controls/SearchControl";

import {rdp} from "./utils";

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';

import 'mapbox-gl/dist/mapbox-gl.css';
// import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'handsontable/dist/handsontable.full.min.css';

import './App.css';

const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:8000/' : process.env.REACT_APP_API_ENDPOINT
    // timeout: 1000,
    // headers: {'X-Custom-Header': 'foobar'}
});

const toast = Toaster.create({
    position: "bottom-left"
});

const styles = [{
    id: 'streets',
    label: 'Streets',
    styleUrl: 'mapbox://styles/mapbox/streets-v11',
}, {
    id: 'satellite',
    label: 'Satellite',
    styleUrl: 'mapbox://styles/mapbox/satellite-v9'
}]

const mapboxAccessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const round = (x, n) => Math.round(x * n) / n;

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

const OutletMarker = ({outlet, draggable, onDragEnd}) => {
    const handleMoveOutlet = ({lngLat}) => {
        const {lng, lat} = lngLat;
        const newOutlet = {
            ...outlet,
            geometry: {
                ...outlet.geometry,
                coordinates: [lng, lat]
            }
        }
        onDragEnd(newOutlet);
    }
    const coords = outlet.geometry.coordinates;
    return (
        <Marker
            longitude={coords[0]}
            latitude={coords[1]}
            draggable={draggable}
            mapboxgl={mapboxgl}
            onDragEnd={handleMoveOutlet}
            offset={[0, 0]}
            anchor="bottom"
        />
    )
}

const CatchmentSource = ({data}) => {
    const sourceId = "catchments-geojson";

    if (!data) {
        return null;
    }

    return (
        <Source id={sourceId} type="geojson" data={data}>
            <Layer
                id="catchments-fill"
                type="fill"
                paint={{
                    'fill-color': '#4E3FC8',
                    'fill-opacity': 0.5,
                }}
            />
            <Layer
                id="catchments-outline"
                type="line"
                paint={{
                    'line-color': '#4E3FC8',
                    'line-width': 3
                }}
            />
        </Source>
    )
}

const ExternalLink = (props) => <a {...props} target="_blank" rel="noreferrer"/>

const resolutions = [15, 30];

const Panel = ({children}) => <div style={{padding: 0}}>{children}</div>;

const App = () => {
    const map = useRef();
    const cursor = useRef();
    const originalCatchment = useRef();

    const [menuOpen, setMenuOpen] = useState(false);
    const [mapStyle, setMapStyle] = useState(styles[0]);
    const [outlet, setOutlet] = useState(null);
    const [resolution, setResolution] = useState(30);
    const [outlets, setOutlets] = useState();
    const [autoMode, setAutoMode] = useState(false);
    const [catchments, setCatchments] = useState(null);
    const [catchment, setCatchment] = useState(null);
    const [working, setWorking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [selectedTab, setSelectedTab] = useState("home");
    const [showTerrain, setShowTerrain] = useState(false);
    const [showStreamlines, setShowStreamlines] = useState(true);
    const [streamlinesThreshold, setStreamlinesThreshold] = useState(50);
    const [tempStreamlinesThreshold, setTempStreamlinesThreshold] = useState();
    const [streamlinesOpacity, setStreamlinesOpacity] = useState(50);
    const [simplification, setSimplification] = useState(0);
    const [streamlinesTiles, setStreamlinesTiles] = useState();
    const [autoZoom, setAutoZoom] = useState(false);
    const [locked, setLocked] = useState(false);

    const [viewState, setViewState] = useState(() => {
        let initialViewState = {
            longitude: -116.1,
            latitude: 37.7,
            zoom: 5,
            bearing: 0,
        };
        const parts = document.location.hash.split('=');
        if (parts.length === 2) {
            const locs = parts[1].split('/');
            if (locs.length === 4) {
                const [latitude, longitude, zoom, bearing] = locs;
                initialViewState = {
                    longitude: Number(longitude),
                    latitude: Number(latitude),
                    zoom: Number(zoom),
                    bearing: Number(bearing)
                }
            }
        }
        return initialViewState;
    })

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

    const hideSuccess = () => {
        setSuccess(false);
    }

    const toggleStreamlines = () => {
        setShowStreamlines(!showStreamlines);
    }

    const flyTo = (data) => {
        const bounds = new mapboxgl.LngLatBounds();
        data.features.forEach(feature => {
            feature.geometry.coordinates.forEach(coords => {
                coords.forEach(coord => {
                    bounds.extend(coord);
                })
            })
        })
        map.current.fitBounds(bounds, {
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
        const {lng: lon, lat} = lngLat;
        const id = outlets ? outlets.features.length + 1 : 1;
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
        if (autoMode) {
            setOutlet(updated);
            handleQuickDelineate(updated)
        } else {
            setOutlets({
                ...outlets,
                features: outlets.features.map(f => f.properties.id === updated.properties.id ? updated : f)
            });
        }
    }

    const handleQuickDelineate = (newOutlet) => {
        setWorking(true);
        setCatchment(null);
        const coords = newOutlet.geometry.coordinates;
        api.get('catchment', {params: {lat: coords[1], lon: coords[0], res: resolution}}).then(({data}) => {
            setCatchment(data);
            originalCatchment.current = data;
            setWorking(false);
            setSuccess(true);
            toast.show({message: "Success!", intent: "success"});

            autoZoom && flyTo(data);
        });
    }

    const handleDelineateMany = () => {
        setWorking(true);
        setCatchments(null);
        api.post('delineate_catchments', outlets, {params: {res: resolution}}).then(({data}) => {
            setCatchments(data);
            originalCatchment.current = data;
            setWorking(false);
            toast.show();

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
        const newHash = `#map=${round(latitude, 1000)}/${round(longitude, 1000)}/${round(zoom, 10)}/${round(bearing, 10)}`;
        const newLocation = document.location.href.replace(document.location.hash, newHash);
        window.history.replaceState({}, 'test', newLocation);
    }

    const toggleShowTerrain = () => {
        setShowTerrain(!showTerrain);
    }

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

    const handleChangeSimplification = (e, value) => {
        setSimplification(value);
        const newFeatures = originalCatchment.current.features.map(feature => {
            const newCoordinates = feature.geometry.coordinates.map(coords => rdp(coords, value));
            return (
                {
                    ...feature,
                    geometry: {
                        ...feature.geometry,
                        coordinates: newCoordinates
                    }
                }
            )
        });
        setCatchment({
            ...catchment,
            features: newFeatures
        });
    }

    const handleChangeResolution = (e) => {
        setResolution(Number(e.target.value));
    }

    const handleChangeStyle = (styleId) => {
        setMapStyle(styles.find(s => s.id === styleId));
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

    const changeSelectedTab = (e, value) => {
        setSelectedTab(value);
    }

    const sidebarWidth = 350;
    const sidebarPadding = 0;
    const navbarHeight = 50;

    // const simplifyMax = 0.01;

    return (
        <div className="">
            <div style={{
                display: working ? "flex" : "none",
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                background: "rgba(0,0,0,0.5)"
            }}>
                <Spinner size={150} intent="none" style={{margin: "auto"}}/>
            </div>
            <Navbar>
                <NavbarGroup align="left">
                    <Navbar.Heading>flowdirections.io</Navbar.Heading>
                    {/*<Popover2 position="bottom-left" minimal content={*/}
                    {/*    <Menu>*/}
                    {/*        <MenuItem2 text={("Download outlets")}>*/}
                    {/*            <MenuItem2 text={("GeoJSON")}/>*/}
                    {/*            <MenuItem2 text={("Shapefile")}/>*/}
                    {/*        </MenuItem2>*/}
                    {/*    </Menu>*/}
                    {/*}>*/}
                    {/*    <Button intent="primary" minimal>{("File")}</Button>*/}
                    {/*</Popover2>*/}
                    <Switch large label={"Lock editing"} style={{margin: 0, marginLeft: 10}} checked={locked}
                            onChange={handleChangeLocked}/>
                </NavbarGroup>
                <NavbarGroup align="right">
                    <a href={process.env.REACT_APP_DONATE_LINK} target="_blank" rel="noreferrer"
                       style={{marginRight: 20}}>Donate</a>
                    {/*<a href="https://www.github.com/openagua/flowdirections.io"*/}
                    {/*   target="_blank" style={{display: "flex"}}><GitHubIcon/></a>*/}
                </NavbarGroup>
            </Navbar>
            <div style={{
                position: "fixed",
                top: navbarHeight,
                bottom: 0,
                left: 0,
                right: 0
            }}>
                <Map
                    ref={map}
                    initialViewState={viewState}
                    maxPitch={85}
                    onLoad={handleLoadMap}
                    onClick={locked ? null : handleAddOutlet}
                    onMoveEnd={handleMoveEnd}
                    onMoveStart={handleMoveStart}
                    style={{
                        position: 'absolute',
                        height: "100%",
                        left: 0,
                        width: null,
                        right: sidebarWidth,
                    }}
                    mapStyle={mapStyle.styleUrl}
                    mapboxAccessToken={mapboxAccessToken}
                    projection="globe"
                >
                    <SearchControl accessToken={mapboxAccessToken} position="top-left"/>
                    <NavigationControl position="top-right"/>
                    {/*<FitAllControl position="top-right"/>*/}
                    <GeolocateControl/>
                    {/*{autoMode && <DrawControl*/}
                    {/*    position="top-left"*/}
                    {/*    displayControlsDefault={false}*/}
                    {/*    controls={{point: true, trash: true}}*/}
                    {/*    onUpdate={setOutlets}*/}
                    {/*/>}*/}
                    {/*<StylesControl position="bottom-left" styles={styles} onChange={handleChangeStyle}/>*/}
                    <ScaleControl position="bottom-right"/>
                    {streamlinesTiles &&
                        <Source key={streamlinesTiles} id="streamlines-raster" type="raster" tiles={[streamlinesTiles]}>
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
                <div
                    style={{
                        position: 'absolute',
                        height: "100%",
                        right: 0,
                        width: sidebarWidth - sidebarPadding * 2,
                        padding: sidebarPadding
                    }}
                >
                    <div style={{padding: 10}}>
                        <Tabs id="sidebar-tabs" large>
                            <Tab id="home" title="Home" panel={
                                <Panel>
                                    <Button fill large icon="eraser" onClick={handleClearWorkspace}>
                                        {("Clear workspace")}</Button>
                                    <br/>
                                    <FormGroup
                                        helperText={("Auto mode will delineate a catchment as soon as you left-click a map")}>
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
                                            <Button onClick={handleDelineateMany}>{("Submit")}</Button>
                                        </div>}
                                    </div>}
                                    {working && <div>Processing...</div>}
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
                                                            <H5>Download outlets</H5>
                                                            <div>
                                                                <Button small
                                                                        onClick={handleDownloadOutlets}>GeoJSON</Button>
                                                                <Button small
                                                                        onClick={handleDownloadOutlets}>Shapefile</Button>
                                                            </div>
                                                        </div>
                                                    }
                                                    {((autoMode && catchment) || catchments) &&
                                                        <div>
                                                            <H5>Download catchments</H5>
                                                            <div>
                                                                <Button small
                                                                        onClick={handleDownloadCatchments}>GeoJSON</Button>
                                                                <Button small
                                                                        onClick={handleDownloadCatchments}>Shapefile</Button>
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
                                    <Switch large checked={showTerrain} onChange={toggleShowTerrain}
                                            label={("Show 3-D terrain")}/>
                                    <Switch large checked={autoZoom} onChange={handleChangeAutoZoom}
                                            label={("Autozoom")}/>
                                </Panel>
                            }/>
                            <Tab id="about" title={("About")} panel={
                                <Panel>
                                    <p>
                                        This app is built with <ExternalLink
                                        href="https://www.hydrosheds.org">HydroSHEDS</ExternalLink> for the source
                                        grid data, <ExternalLink href="https://mattbartos.com/pysheds/">pysheds
                                    </ExternalLink> for the
                                        delineation,
                                        and&nbsp;
                                        <ExternalLink href="https://www.mapbox.com">Mapbox</ExternalLink> for the
                                        mapping
                                        environment. <ExternalLink
                                        href="https://www.github.com/openagua/flowdirections.io#readme">Read
                                        more here</ExternalLink>. The app is also inspired by <ExternalLink
                                        href="https://geojson.io/">geojson.io</ExternalLink>, which you may find
                                        useful.
                                    </p>
                                    <p>
                                        "flowdirections" refers to a flow direction grid, a key intermediary in the
                                        catchment delineation process and other DEM-derived analyses. It also
                                        invokes
                                        mapping water and its movement ("hydrography" doesn't roll off the tongue
                                        as smoothly).
                                    </p>
                                    <h4>Feedback</h4>
                                    <p>
                                        Would you like to submit a bug or have a suggestion for improvement? Please
                                        open
                                        an issue in the site's <ExternalLink
                                        href="https://github.com/openagua/flowdirections.io/issues">issue
                                        tracker</ExternalLink>!
                                    </p>
                                    <h4>Privacy</h4>
                                    <p>None of your data is stored with flowdirections.io. The backend server only
                                        performs
                                        calculations (<ExternalLink
                                            href="https://www.github.com/openagua/rapidsheds-api">source
                                            code</ExternalLink>), while the app that you are
                                        currently using does not use cookies, and only stores data during your
                                        session
                                        (<ExternalLink
                                            href="https://www.github.com/openagua/flowdirections.io">source
                                            code</ExternalLink>). This
                                        may change in the future, in which case you will know about it.</p>
                                </Panel>
                            }/>
                        </Tabs>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
