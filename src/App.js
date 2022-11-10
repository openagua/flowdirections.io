import {useEffect, useRef, useState} from "react";
import axios from "axios";
import mapboxgl from "mapbox-gl";
import {
    Button,
    FormControlLabel,
    FormGroup,
    Snackbar,
    Alert,
    Switch,
    Slider,
    Checkbox,
    FormControl,
    RadioGroup,
    Radio,
    FormLabel,
} from "@mui/material";

import AppBar from '@mui/material/AppBar';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import Icon from '@mui/material/Icon';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import GitHubIcon from '@mui/icons-material/GitHub';

import Map, {
    GeolocateControl,
    Source,
    Layer,
    NavigationControl,
    ScaleControl,
    useControl,
    Marker,
    useMap
} from 'react-map-gl';
import {HotTable} from '@handsontable/react';
import FileSaver from 'file-saver';

import DrawControl from "./controls/DrawControl";
import SearchControl from "./controls/SearchControl";
import MapControl from "./controls/MapControl";

import {rdp} from "./utils";

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'handsontable/dist/handsontable.full.min.css';

import './App.css';
import StylesControl from "./controls/StylesControl";

const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:8000/' : process.env.REACT_APP_API_ENDPOINT
    // timeout: 1000,
    // headers: {'X-Custom-Header': 'foobar'}
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

const Panel = (props) => <TabPanel style={{padding: 15}} {...props}/>;

const ExternalLink = (props) => <Link {...props} target="_blank"/>

const resolutions = [15, 30];

const nThresholdMarks = 5;
const thresholdMarks = [...new Array(nThresholdMarks)].map((v, i) => {
    const value = i * 100 / (nThresholdMarks - 1);
    return ({
        value,
        label: `${value}`
    })
});

const nOpacityMarks = 5;
const opacityMarks = [...new Array(nOpacityMarks)].map((v, i) => {
    const value = i * 100 / (nOpacityMarks - 1);
    return ({
        value,
        label: `${value}%`
    })
});

const App = () => {
    const map = useRef();
    const cursor = useRef();
    const originalCatchment = useRef();

    const [mapStyle, setMapStyle] = useState(styles[0]);
    const [outlet, setOutlet] = useState(null);
    const [resolution, setResolution] = useState(30);
    const [outlets, setOutlets] = useState([]);
    const [manualMode, setManualMode] = useState(false);
    const [catchments, setCatchments] = useState(null);
    const [catchment, setCatchment] = useState(null);
    const [working, setWorking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [selectedTab, setSelectedTab] = useState("home");
    const [showTerrain, setShowTerrain] = useState(false);

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

    const [showStreamlines, setShowStreamlines] = useState(true);
    const [streamlinesThreshold, setStreamlinesThreshold] = useState(50);
    const [tempStreamlinesThreshold, setTempStreamlinesThreshold] = useState();
    const [streamlinesOpacity, setStreamlinesOpacity] = useState(50);
    const [simplification, setSimplification] = useState(0);
    const [streamlinesTiles, setStreamlinesTiles] = useState();
    const [autoZoom, setAutoZoom] = useState(true);

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

    const handleQuickDelineate = ({lngLat}) => {
        const {lng: lon, lat} = lngLat;
        setOutlet({
            "type": "Feature",
            "properties": {
                "marker-symbol": "monument"
            },
            "geometry": {
                "coordinates": [lon, lat],
                "type": "Point"
            }
        })
        setWorking(true);
        setCatchment(null);
        api.get('delineate', {params: {lat, lon, res: resolution}}).then(({data}) => {
            setCatchment(data);
            originalCatchment.current = data;
            setWorking(false);
            setSuccess(true);

            autoZoom && flyTo(data);
        });
    }

    const outletCoords = outlet ? outlet.geometry.coordinates : null;

    useEffect(() => {
        if (map.current) {
            if (manualMode) {
                map.current.getCanvas().style.cursor = 'pointer';
            } else {
                map.current.getCanvas().style.cursor = 'crosshair';
            }
        }
    }, [manualMode])

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
        const _map = map.current.getMap();
        if (showTerrain) {
            _map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
            });

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
            _map.removeSource('mapbox-dem')
        }
    }, [showTerrain]);

    const handleChangeThreshold = (e, value) => {
        setStreamlinesThreshold(value);
        setTempStreamlinesThreshold();
    }

    const handleChangeOpacity = (e, value) => {
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

    const handleChangeResolution = (e, value) => {
        setResolution(value);
    }

    const handleChangeStyle = (styleId) => {
        setMapStyle(styles.find(s => s.id === styleId));
    }

    const changeMode = () => {
        setManualMode(!manualMode);
    }

    const handleDownloadGeoJSON = () => {
        const blob = new Blob([JSON.stringify(manualMode ? catchments : catchment, null, 2)], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, "catchment.json");
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
    const navbarHeight = 42;

    // const simplifyMax = 0.01;

    return (
        <div className="app">
            <Backdrop
                sx={{color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1}}
                open={working}
                // onClick={handleCloseBackgrop}
            >
                <CircularProgress color="inherit"/>
            </Backdrop>
            <AppBar position="static" style={{boxShadow: "none"}}>
                <Toolbar style={{height: navbarHeight, minHeight: navbarHeight}}>
                    <Typography variant="h6" component="div" sx={{flexGrow: 1}}>flowdirections.io</Typography>
                    <Typography variant="h6" component="div" sx={{flexGrow: 1}}>NORTH AMERICA ONLY!</Typography>
                    <Link color="inherit" href={process.env.REACT_APP_DONATE_LINK} target="_blank" variant="button"
                          style={{marginRight: 20}}>Donate</Link>
                    <Link href="https://www.github.com/openagua/flowdirections.io" variant="button" color="inherit"
                          target="_blank" style={{display: "flex"}}><GitHubIcon/></Link>
                </Toolbar>
            </AppBar>
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
                    onClick={manualMode ? null : handleQuickDelineate}
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
                    {manualMode && <DrawControl
                        position="top-left"
                        displayControlsDefault={false}
                        controls={{point: true, trash: true}}
                        onUpdate={setOutlets}
                    />}
                    <StylesControl position="bottom-left" styles={styles} onChange={handleChangeStyle}/>
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
                    <CatchmentSource data={manualMode ? catchments : catchment}/>
                    {!manualMode && outlet && <Marker longitude={outletCoords[0]} latitude={outletCoords[1]} draggable
                                                      mapboxgl={mapboxgl}
                                                      onDragEnd={handleQuickDelineate} offset={[0, 0]}
                                                      anchor="bottom"/>}
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
                    <div>
                        <TabContext value={selectedTab}>
                            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                                <Tabs value={selectedTab} onChange={changeSelectedTab}>
                                    <Tab value="home" label={("Home")}/>
                                    <Tab value="settings" label={"Settings"}/>
                                    <Tab value="about" label={("About")}/>
                                </Tabs>
                            </Box>

                            <Panel value="home">
                                <Button style={{width: "100%"}} variant="outlined" color="error"
                                        onClick={handleClearWorkspace}>Clear
                                    workspace</Button>

                                <div>
                                    <FormGroup>
                                        <br/>
                                        <FormLabel>Input mode</FormLabel>
                                        <FormHelperText>Manual mode allows you to create multiple
                                            catchments/subcatchments.</FormHelperText>
                                        <FormControlLabel control={<Switch checked={manualMode} onChange={changeMode}/>}
                                                          label={("Manual mode")}/>
                                    </FormGroup>
                                </div>
                                {manualMode && <div>
                                    <div>
                                        {outlets && outlets.length ?
                                            <HotTable
                                                data={outlets.map(o => {
                                                    const coords = o.geometry.coordinates;
                                                    return ([coords[0], coords[1]])
                                                })}
                                                rowHeaders={true}
                                                colHeaders={["Lon", "Lat"]}
                                                height="auto"
                                                licenseKey="non-commercial-and-evaluation" // for non-commercial use only
                                            /> : <div>
                                                Add outlets using the tools on the left.
                                            </div>}
                                    </div>
                                    <div style={{marginTop: 10, marginBottom: 10}}>
                                        <Button variant="contained">{("Submit")}</Button>
                                    </div>
                                </div>}
                                {working && <div>Processing...</div>}
                                <Snackbar open={success} onClose={hideSuccess} autoHideDuration={5000}>
                                    <Alert onClose={hideSuccess} severity="success"
                                           sx={{width: '100%'}}>Success!</Alert>
                                </Snackbar>
                                <div className="bottom">
                                    {(catchment || catchments) &&
                                        <div>

                                            {/*<FormLabel>Simplify</FormLabel>*/}
                                            {/*<Slider defaultValue={0} step={simplifyMax/10} min={0} max={simplifyMax}*/}
                                            {/*        onChange={handleChangeSimplification}/>*/}

                                            {/*<Button variant="contained">Shapefile</Button>*/}
                                            <Button variant="contained" onClick={handleDownloadGeoJSON}>Download
                                                GeoJSON</Button>
                                        </div>}
                                </div>

                            </Panel>

                            <Panel value="settings">
                                <FormControl style={{width: "100%", marginTop: 15}}>
                                    <FormLabel>Resolution (arc seconds)</FormLabel>
                                    <RadioGroup row value={resolution} onChange={handleChangeResolution}>
                                        {resolutions.map(res => <FormControlLabel key={res} value={res}
                                                                                  control={<Radio/>}
                                                                                  label={`${res}"`}/>)}
                                    </RadioGroup>
                                    <FormLabel>Streamlines</FormLabel>
                                    <FormControlLabel
                                        control={<Checkbox checked={showStreamlines} onChange={toggleStreamlines}/>}
                                        label={("Show streamlines")}/>
                                    {showStreamlines &&
                                        <div>
                                            <FormLabel>Streamline density</FormLabel>
                                            <Slider value={tempStreamlinesThreshold || streamlinesThreshold} step={5}
                                                    marks={thresholdMarks}
                                                    min={0} max={100} style={{width: "100%"}}
                                                    valueLabelDisplay="auto"
                                                    onChange={(e, value) => setTempStreamlinesThreshold(value)}
                                                    onChangeCommitted={handleChangeThreshold}/>
                                            <FormLabel>Streamline opacity</FormLabel>
                                            <Slider step={5} marks={opacityMarks} min={0} max={100}
                                                    style={{width: "100%"}} value={streamlinesOpacity}
                                                    valueLabelDisplay="auto" onChange={handleChangeOpacity}/>


                                        </div>}
                                    <FormControlLabel
                                        control={<Switch checked={showTerrain} onChange={toggleShowTerrain}/>}
                                        label={("Show 3-D terrain")}/>
                                    <FormControlLabel
                                        control={<Switch checked={autoZoom} onChange={handleChangeAutoZoom}/>}
                                        label={("Autozoom")}/>
                                </FormControl>
                            </Panel>

                            <Panel value="about">
                                <p>
                                    This app is built with <ExternalLink
                                    href="https://www.hydrosheds.org">HydroSHEDS</ExternalLink> for the source grid
                                    data, <ExternalLink
                                    href="https://mattbartos.com/pysheds/">pysheds</ExternalLink> for the delineation,
                                    and&nbsp;
                                    <ExternalLink href="https://www.mapbox.com">Mapbox</ExternalLink> for the mapping
                                    environment. <ExternalLink
                                    href="https://www.github.com/openagua/flowdirections.io#readme">Read
                                    more here</ExternalLink>. The app is also inspired by <ExternalLink
                                    href="https://geojson.io/">geojson.io</ExternalLink>, which you may find useful.
                                </p>
                                <p>
                                    "flowdirections" refers to a flow direction grid, a key intermediary in the
                                    catchment delineation process and other DEM-derived analyses. It also invokes
                                    mapping water and its movement ("hydrography" doesn't roll off the tongue
                                    as smoothly).
                                </p>
                                <h4>Feedback</h4>
                                <p>
                                    Would you like to submit a bug or have a suggestion for improvement? Please open
                                    an issue in the site's <ExternalLink
                                    href="https://github.com/openagua/flowdirections.io/issues">issue
                                    tracker</ExternalLink>!
                                </p>
                                <h4>Privacy</h4>
                                <p>None of your data is stored with flowdirections.io. The backend server only performs
                                    calculations (<ExternalLink
                                        href="https://www.github.com/openagua/rapidsheds-api">source
                                        code</ExternalLink>), while the app that you are
                                    currently using does not use cookies, and only stores data during your session
                                    (<ExternalLink
                                        href="https://www.github.com/openagua/flowdirections.io">source
                                        code</ExternalLink>). This
                                    may change in the future, in which case you will know about it.</p>
                            </Panel>

                        </TabContext>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
