import {useEffect, useRef, useState} from "react";
import axios from "axios";
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
import CircularProgress from '@mui/material/CircularProgress';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import Icon from '@mui/material/Icon';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
    Marker
} from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import {HotTable} from '@handsontable/react';
import FileSaver from 'file-saver';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'handsontable/dist/handsontable.full.min.css';

import './App.css';

const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:8000/' : process.env.REACT_APP_API_ENDPOINT
    // timeout: 1000,
    // headers: {'X-Custom-Header': 'foobar'}
});


const mapboxAccessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const round = (x, n) => Math.round(x * n) / n;

const DrawControl = ({position, onUpdate, ...props}) => {
    const points = useRef([]);
    const handleCreate = ({features}) => {
        points.current = [...points.current, ...features];
        onUpdate(points.current);
    }
    useControl(({map}) => {
        map.on('draw.create', handleCreate);
        return new MapboxDraw(props)
    }, {position});
    return null;
}

const SearchControl = ({position}) => {
    useControl(({map}) => {
        return new MapboxGeocoder({
            accessToken: mapboxAccessToken,
        });
    }, {position})
}

const TilesControl = ({position}) => {
    // useControl(({map})) => {
    //
    // }
}

const CatchmentSource = ({data}) => {
    if (!data) {
        return null;
    }
    return (
        <Source id="catchments-geojson" type="geojson" data={data}>
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

    const [mapStyle, setMapStyle] = useState("streets-v11")
    const [outlet, setOutlet] = useState(null);
    const [resolution, setResolution] = useState(15);
    const [outlets, setOutlets] = useState([]);
    const [manualMode, setManualMode] = useState(false);
    const [catchments, setCatchments] = useState(null);
    const [catchment, setCatchment] = useState(null);
    const [working, setWorking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [viewState, setViewState] = useState(() => {
        let initialViewState = {
            longitude: -116.1,
            latitude: 37.7,
            zoom: 5,
            bearing: 0
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
    const [streamlinesOpacity, setStreamlinesOpacity] = useState(50)
    const [streamlinesTiles, setStreamlinesTiles] = useState();

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
            setWorking(false);
            setSuccess(true);
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

    const handleChangeThreshold = (e, value) => {
        setStreamlinesThreshold(value);
    }

    const handleChangeOpacity = (e, value) => {
        setStreamlinesOpacity(value);
    }

    const handleChangeResolution = (e, value) => {
        setResolution(value);
    }

    const changeMode = () => {
        setManualMode(!manualMode);
    }

    const handleDownloadGeoJSON = () => {
        const blob = new Blob([JSON.stringify(manualMode ? catchments : catchment, null, 2)], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, "catchment.json");
    }

    const sidebarWidth = 350;
    const sidebarPadding = 20;
    const navbarHeight = 42;

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
                    <Link color="inherit" href={process.env.REACT_APP_DONATE_LINK} target="_blank" variant="button"
                          style={{marginRight: 10}}>Donate</Link>
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
                    mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
                    mapboxAccessToken={mapboxAccessToken}
                    projection="globe"
                >
                    <SearchControl position="top-left"/>
                    <NavigationControl/>
                    <GeolocateControl/>
                    {manualMode && <DrawControl
                        position="top-left"
                        displayControlsDefault={false}
                        controls={{point: true, trash: true}}
                        onUpdate={setOutlets}
                    />}
                    <TilesControl position="bottom-left"/>
                    <ScaleControl position="bottom-right"/>
                    <Source key={streamlinesTiles} id="streamlines-raster" type="raster" tiles={[streamlinesTiles]}>
                        <Layer
                            source="streamlines-raster"
                            type="raster"
                            paint={{
                                "raster-opacity": streamlinesOpacity / 100
                            }}
                        />
                    </Source>
                    <CatchmentSource data={manualMode ? catchments : catchment}/>
                    {/*{outlet && <Source id="outlet-geojson" type="geojson" data={outlet}>*/}
                    {/*    <Layer*/}
                    {/*        id="outlet"*/}
                    {/*        type="symbol"*/}
                    {/*        paint={{}}*/}
                    {/*    />*/}
                    {/*</Source>}*/}
                    {outlet && !manualMode && <Marker longitude={outletCoords[0]} latitude={outletCoords[1]} draggable
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
                        <FormControl style={{width: "100%"}}>
                            <FormLabel>Resolution</FormLabel>
                            <RadioGroup row value={resolution} onChange={handleChangeResolution}>
                                {resolutions.map(res => <FormControlLabel key={res} value={res} control={<Radio/>}
                                                                          label={res}/>)}
                            </RadioGroup>
                            <FormLabel>Streamlines</FormLabel>
                            <FormControlLabel
                                control={<Checkbox checked={showStreamlines} onChange={toggleStreamlines}/>}
                                label={("Show streamlines")}/>
                            {showStreamlines &&
                                <div>
                                    <FormLabel>Streamline density</FormLabel>
                                    <Slider defaultValue={streamlinesThreshold} step={5} marks={thresholdMarks} min={0}
                                            max={100}
                                            style={{width: "100%"}}
                                            valueLabelDisplay="auto" onChangeCommitted={handleChangeThreshold}/>
                                    <FormLabel>Streamline opacity</FormLabel>
                                    <Slider defaultValue={streamlinesOpacity} step={5} marks={opacityMarks} min={0}
                                            max={100} style={{width: "100%"}}
                                            valueLabelDisplay="auto" onChangeCommitted={handleChangeOpacity}/>
                                </div>}
                        </FormControl>
                        <div>
                            <FormGroup>
                                <FormLabel>Input mode</FormLabel>
                                <FormHelperText>Manual mode allows you to create multiple
                                    catchments/subcatchments.</FormHelperText>
                                <FormControlLabel control={<Switch checked={manualMode} onChange={changeMode}/>}
                                                  label={("Manual mode")}/>
                            </FormGroup>
                        </div>
                        {manualMode && <div>
                            <div>
                                {outlets.length ?
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
                            <Alert onClose={hideSuccess} severity="success" sx={{width: '100%'}}>Success!</Alert>
                        </Snackbar>
                        {catchments && <div className="download">
                            {/*<Button variant="contained">Shapefile</Button>*/}
                            <Button variant="contained" onClick={handleDownloadGeoJSON}>Download GeoJSON</Button>
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
