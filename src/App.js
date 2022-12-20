import {useEffect, useRef, useState} from "react";
import axios from "axios";
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import classNames from "classnames";
import {round, snapToCenter} from "./utils";
import debounce from "debounce";
import querystring from 'qs';
import {
    Button,
    FormGroup,
    H5,
    Icon,
    Menu,
    MenuItem,
    Navbar,
    NavbarGroup,
    Radio,
    RadioGroup,
    Slider,
    Spinner,
    Switch,
    Tab,
    Tabs,
    Toaster,
} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import Map, {GeolocateControl, Layer, NavigationControl, ScaleControl, Source,} from 'react-map-gl';
import {HotTable} from '@handsontable/react';
import FileSaver from 'file-saver';
import SearchControl from "./controls/SearchControl";
import StylesControl from "./controls/StylesControl";
import {CatchmentSource, ExternalLink, OutletMarker, Panel} from "./components";
import MapControl from "./controls/MapControl";

// import shpwrite from './libraries/shp-write';
// STYLES
import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css";

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'handsontable/dist/handsontable.full.min.css';

import './App.scss';
import {BUTTON, DARK, INTENT_WARNING} from "@blueprintjs/core/lib/esnext/common/classes";

const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000/' : process.env.REACT_APP_API_ENDPOINT,
    withCredentials: false,
    // timeout: 1000,
    // headers: {'X-Custom-Header': 'foobar'}
});

const COORD_PLACES = 1e6;

const mapStyles = [
    {
        id: 'mapbox-streets',
        label: 'Streets',
        url: 'mapbox://styles/mapbox/streets-v11',
    }, {
        id: 'mapbox-satellite',
        label: 'Satellite',
        url: 'mapbox://styles/mapbox/satellite-v9'
        // }, {
        //     id: 'mapbox-satellite-streets',
        //     label: 'Satellite Streets',
        //     url: 'mapbox://styles/mapbox/satellite-streets-v12'
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

// const FILETYPES = ['GeoJSON', 'Shapefile'];
const FILETYPES = ['GeoJSON'];

const mapboxAccessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const createOutlet = (lon, lat, id) => {
    return (
        {
            "type": "Feature",
            "properties": {
                "id": id,
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

const DownloadMenu = ({objecttype, data}) => {

    const handleDownload = (e) => {
        const {filetype} = e.currentTarget.dataset;
        let shape;
        switch (objecttype) {
            case "outlet":
                shape = data;
                break;
            case "catchment":
                shape = data;
                break;
            default:
                return;
        }
        const filenameBase = `${objecttype}${data.features && data.features.length > 1 ? "s" : ""}`
        switch (filetype) {
            case "geojson":
                const blob = new Blob([JSON.stringify(shape, null, 2)], {type: "text/plain;charset=utf-8"});
                FileSaver.saveAs(blob, `${filenameBase}.json`);
                break;
            // case "shapefile":
            //     const data = shape.type === 'FeatureCollection' ? shape : {
            //         type: 'FeatureCollection',
            //         features: [shape]
            //     };
            //     const options = {
            //         folder: filenameBase,
            //         type: 'blob',
            //         types: {
            //             point: filenameBase,
            //             polygon: filenameBase,
            //             line: filenameBase
            //         }
            //     }
            //     shpwrite.zip(data, options).then(blob => {
            //         FileSaver.saveAs(blob, `${filenameBase}.zip`);
            //     });
            //     break;
            default:
                return;
        }
    }

    const disabled = !data;

    return (
        <div>
            <Popover2 disabled={disabled} placement="bottom-start"
                      minimal content={
                <Menu>
                    {FILETYPES.map(filetype => (
                        <MenuItem key={filetype} data-filetype={filetype.toLowerCase()} small
                                  text={filetype} onClick={handleDownload}/>
                    ))}
                </Menu>
            }>
                <Button intent="primary" disabled={disabled} text={("Download")}
                        rightIcon="caret-down"/>
            </Popover2>

        </div>
    )
}

const App = () => {
    const map = useRef();
    const cursor = useRef();
    const originalCatchment = useRef();
    // const resizer = useRef();

    const smallScreen = window.screen.availWidth <= 768;

    const [sidebarIsClosed, setSidebarIsClosed] = useState(smallScreen);
    const [projection, setProjection] = useState("mercator");
    const [dark,] = useState(false);
    const [mapStyle, setMapStyle] = useState(mapStyles[0]);
    const [outlet, setOutlet] = useState(null);
    const [resolution, setResolution] = useState(30);
    const [removeSinks, setRemoveSinks] = useState(true);
    const [outlets, setOutlets] = useState();
    const [quickMode, setQuickMode] = useState(true);
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
    const [autoZoom, setAutoZoom] = useState(true);
    const [locked, setLocked] = useState(false);

    const [initialViewState] = useState(() => {
        const search = document.location.search;
        const {lat, lon, zoom, bearing, pitch} = search ? querystring.parse(search) : {};
        return {
            longitude: Number(lon) || -116.1,
            latitude: Number(lat) || 37.7,
            zoom: Number(zoom) || 5,
            bearing: Number(bearing),
            pitch: Number(pitch),
        };
    })

    const redrawMap = () => map.current && map.current.resize();

    useEffect(() => {
        debounce(redrawMap, 0.5)
    }, [projection])

    useEffect(() => {
        const resizer = new ResizeObserver(debounce(() => redrawMap(), 0.5));
        const mapDiv = document.getElementById('map');
        resizer.observe(mapDiv);
        return () => {
            resizer.disconnect();
        }
    }, [])

    useEffect(() => {
        setStreamlinesTiles(null);
        if (showStreamlines) {
            api.get('streamlines_raster', {params: {resolution, threshold: streamlinesThreshold}})
                .then(resp => {
                    setStreamlinesTiles(resp.data);
                })
        }
    }, [resolution, showStreamlines, streamlinesThreshold]);

    const toggleStreamlines = () => {
        setShowStreamlines(!showStreamlines);
    }

    const flyTo = (data) => {
        if (projection === "globe" || !data) {
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
            duration: 2000,
            padding: 30
        });
    }

    const fitAll = () => {
        flyTo(quickMode ? catchment : catchments);
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

    const roundCoord = (coord) => {
        return round(snap ? snapToCenter(coord, resolution) : coord, COORD_PLACES)
    }

    const handleAddOutlet = ({lngLat}) => {
        const {lng: _lon, lat: _lat} = lngLat;
        const id = outlets ? outlets.features.length + 1 : 1;

        const lon = roundCoord(_lon);
        const lat = roundCoord(_lat);
        const newOutlet = createOutlet(lon, lat, id);
        if (quickMode) {
            setOutlet(newOutlet);
            handleQuickDelineate(newOutlet, removeSinks);
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
                coordinates: [roundCoord(lon), roundCoord(lat)]
            }
        }
        if (quickMode) {
            setOutlet(movedOutlet);
            handleQuickDelineate(movedOutlet, removeSinks)
        } else {
            setOutlets({
                ...outlets,
                features: outlets.features.map(f => f.properties.id === movedOutlet.properties.id ? movedOutlet : f)
            });
        }
    }

    const handleDeleteOutlet = (index) => {
        if (quickMode) {
            setOutlet(null);
            setCatchment(null);
        } else {
            setOutlets({
                ...outlets,
                features: outlets.features.filter((outlet, i) => i !== index)
            });
        }
    }

    const handleShowContextMenu = (outlet) => {
        console.log('hi!!')
    }

    const handleQuickDelineate = (newOutlet, _removeSinks = true) => {
        const [lon, lat] = newOutlet.geometry.coordinates;
        if (outlet && _removeSinks === removeSinks) {
            const [_lon, _lat] = outlet.geometry.coordinates;
            if (_lon === lon && _lat === lat) {
                return;
            }
        }
        setWorking(true);
        setCatchment(null);
        api.get('catchment', {params: {lon, lat, res: resolution, remove_sinks: _removeSinks}})
            .then(({data}) => {
                setCatchment(data);
                originalCatchment.current = data;
                setWorking(false);
                // notify.success("Success!")

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
        const newSearch = '?' + querystring.stringify({
            lat: _lat,
            lon: _lon,
            zoom: _zoom,
            bearing: _bearing,
            pitch: _pitch
        });
        const currentSearch = document.location.search;
        const newLocation = currentSearch ? document.location.href.replace(currentSearch, newSearch) : document.location.href + newSearch;
        window.history.replaceState({}, '', newLocation);
    }

    const toggleShowTerrain = () => {
        setShowTerrain(!showTerrain);
    }

    const handleChangeProjection = () => {
        setProjection(projection === 'mercator' ? 'globe' : 'mercator');
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
        setQuickMode(!quickMode);
    }

    const toggleRemoveSinks = () => {
        setRemoveSinks(!removeSinks);
        if (quickMode) {
            outlet && handleQuickDelineate(outlet, !removeSinks);
        }
    }

    const handleClearWorkspace = () => {
        setOutlet(null);
        setOutlets(null);
        setCatchment(null);
        setCatchments(null);
    }

    // const canDownloadOutlets = (quickMode && outlet) || outlets;

    return (
        <div className={classNames("app", {[DARK]: dark}, sidebarIsClosed ? "sidebar-closed" : "")}>
            <div className="spinner-wrapper" style={{display: working ? "flex" : "none"}}>
                <Spinner size={100} intent="none" className="spinner"/>
            </div>
            <Navbar>
                <NavbarGroup align="left">
                    <Navbar.Heading className="navbar-heading"><a
                        href={document.location.origin}>{document.location.host}</a></Navbar.Heading>
                    <Switch large label={"Lock editing"} style={{margin: 0, marginLeft: 10}} checked={locked}
                            onChange={handleChangeLocked}/>
                    {/*<Button minimal icon={dark ? "flash" : "moon"} style={{marginLeft: 10}}*/}
                    {/*        onClick={() => setDark(!dark)}/>*/}
                </NavbarGroup>
                <NavbarGroup align="right">
                    <a className={classNames(BUTTON, INTENT_WARNING)} href={process.env.REACT_APP_DONATE_LINK}
                       target="_blank" rel="noreferrer">Donate</a>
                    {/*<a href="https://www.github.com/openagua/flowdirections.io"*/}
                    {/*   target="_blank" style={{display: "flex"}}><GitHubIcon/></a>*/}
                </NavbarGroup>
            </Navbar>
            <div className="main">
                <div id="map" className="map">
                    <Map
                        ref={map}
                        // key={projection}
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
                        <GeolocateControl position="top-right"/>
                        <MapControl position="top-right" component={
                            <button disabled={projection === 'globe' || (quickMode ? !catchment : !catchments)}
                                    onClick={fitAll}><Icon icon="clip"/></button>
                        }/>
                        {/*<MapControl position="top-right" className="autozoom" component={*/}
                        {/*    <Checkbox label={("Autozoom")} checked={projection !== "globe" ? autoZoom : false}*/}
                        {/*              onClick={handleChangeAutoZoom}/>*/}
                        {/*}/>*/}
                        <StylesControl position="bottom-left" mapStyles={mapStyles} showTerrain={showTerrain}
                                       projection={projection}
                                       onChangeProjection={handleChangeProjection}
                                       onChange={handleChangeMapStyle}
                                       onChangeTerrain={toggleShowTerrain}
                                       initialSelected={mapStyle.id}/>
                        <ScaleControl position="bottom-right"/>
                        {streamlinesTiles &&
                            <Source key={streamlinesTiles} id="streamlines-raster" type="raster"
                                    tiles={[streamlinesTiles]}>
                                <Layer
                                    source="streamlines-raster"
                                    type="raster"
                                    paint={{"raster-opacity": streamlinesOpacity / 100}}
                                />
                            </Source>}
                        <CatchmentSource data={quickMode ? catchment : catchments}/>
                        {quickMode && outlet &&
                            <OutletMarker id="outlet" outlet={outlet} draggable={!locked}
                                          onContextMenu={handleShowContextMenu}
                                          onDragEnd={handleMoveOutlet} onDelete={handleDeleteOutlet}/>}
                        {!quickMode && outlets && outlets.features.map((o, i) =>
                            <OutletMarker id="outlet" key={o.properties.id} outlet={o} draggable={!locked}
                                          index={i} onContextMenu={handleShowContextMenu} onDelete={handleDeleteOutlet}
                                          onDragEnd={handleMoveOutlet}/>)}
                    </Map>
                </div>
                <div className="map-sidebar">
                    <Tabs id="sidebar-tabs" large renderActiveTabPanelOnly>
                        <Tab id="home" title="Home" panel={
                            <Panel>
                                <Button fill large icon="eraser" onClick={handleClearWorkspace}>
                                    {("Clear workspace")}</Button>
                                <br/>
                                <FormGroup
                                    helperText={("Quick mode will delineate a single catchment as soon as you click on the map.")}>
                                    <Switch large checked={quickMode} onChange={changeMode} label={("Quick mode")}/>
                                </FormGroup>
                                <FormGroup helperText={"Uncheck this to show endorheic basins in the delineation."}>
                                    <Switch large checked={removeSinks} onChange={toggleRemoveSinks}
                                            label={("Fill sinks")}/>
                                </FormGroup>
                                <div>
                                    <H5>{quickMode ? ("Outlet") : ("Outlets")}</H5>
                                    {!quickMode &&
                                        <div>
                                            {outlets && outlets.features.length ?
                                                <HotTable
                                                    data={outlets.features.map(o => {
                                                        const coords = o.geometry.coordinates;
                                                        return ([coords[0], coords[1]])
                                                    })}
                                                    rowHeaders={true}
                                                    colHeaders={["Lon", "Lat"]}
                                                    width="320px"
                                                    height="auto"
                                                    licenseKey="non-commercial-and-evaluation" // for non-commercial use only
                                                /> : <div>
                                                    Add multiple outlets by clicking on the map.
                                                </div>}
                                        </div>}
                                    <div style={{marginTop: 10, marginBottom: 10, display: "flex"}}>
                                        {!quickMode &&
                                            <Button intent="primary" disabled={!outlets} style={{marginRight: 5}}
                                                    onClick={handleDelineateMany}>{("Delineate")}</Button>}
                                        <DownloadMenu objecttype="outlet"
                                                      data={quickMode ? outlet : outlets}/>
                                    </div>
                                </div>
                                <br/>
                                <div className="catchments">
                                    <H5>{quickMode ? ("Catchment") : ("Catchment(s)")}</H5>
                                    <DownloadMenu objecttype="catchment"
                                                  data={quickMode ? catchment : catchments}/>
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
                                        <div style={{paddingLeft: 5, paddingRight: 10}}>
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
                                    more here</ExternalLink>.
                                </p>
                                <p>
                                    "flowdirections" refers to a flow direction grid, a key intermediary in the
                                    catchment delineation process and other DEM-based hydrologic analyses. It also
                                    evokes the general movement of water.
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
