[![Netlify Status](https://api.netlify.com/api/v1/badges/3904b96f-f6b2-4e10-aabd-44f74873b9a2/deploy-status)](https://app.netlify.com/sites/flowdirections/deploys)

[flowdirections.io](https://flowdirections.io) helps delineate catchments using pysheds + HydroSHEDS.

For help using the app, see [docs.flowdirections.io](https://docs.flowdirections.io).

# Environment variables

This app uses several environment variables to run. The (mostly) essential functional ones include:

* `REACT_APP_API_ENDPOINT` http://localhost:8000
* `REACT_APP_MAPBOX_ACCESS_TOKEN` - Needed for mapping. Get yours at: www.mapbox.com. Alternatively, you might be able to try [MapLibre](https://maplibre.org/maplibre-gl-js-docs/api/), a fork of Mapbox v1 that doesn't require an access token to use. However, the map tiles used in flowdirections.io also are from Mapbox, so alternative tiles are needed too.
* `REACT_APP_API_KEY` - The API key needed to interact with the backend API, by default [api.flowdirections.io](https://github.com/openagua/flowdirections-api). If you have your own web service, of course you can modify this or even omit it if desired. This will get sent in the request header as `x-api-key`.

Additionally, the app uses `REACT_APP_DONATE_LINK`, a donation link for coffee money (:).