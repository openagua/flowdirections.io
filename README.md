[flowdirections.io](https://flowdirections.io) helps you delineate one or more watersheds (aka catchments).

# Overview

The purpose of flowdirections.io is to provide a range of tools to delineate one or more watersheds globally, relatively quickly. While this feature may be expanded in the future, for now this remains the core motivation. As noted below, other tools exist with some limited delineation capabilities, yet the delineation capabilities of these tools are generally not smooth, or relatively slow, or are limited in coverage (i.e., to the United States). This app aims to overcome these limitations, while providing other useful (and fun!) related functionality.

# Quick start

While it is best to just play with the app to figure out how to use it, here are some tips for basic usage:

* To quickly delineate a single catchment, just click a point. That's it! Once the catchment is delineated, you may then download the catchment as a GeoJSON file.
* To delineate multiple catchments, turn off "Quick mode" under the "Home" tab, click the map where you want your outlets, then click "Delineate".
* NOTE: Click on one of the blue reference lines to properly delineate a catchment. There is currently no auto-snap feature.

# Settings

* Resolution: By default, the app uses the HydroSHEDS 30" dataset (90m at the equator). This can be changed to 15", for somewhat higher resolution. **NOTE:** Not yet, actually! This has temporarily been turned off, as 15" requires a bit more memory, and crashes the server.
* Reference lines: Use the sliders to adjust the density and opacity of the reference lines.
* Autozoom: Turn on Autozoom to automatically zoom to generated catchments. Note that this cannot be enabled if the map's "globe" mode is on.

# Map settings

* Change the base map settings--including base tiles, globe mode, and 3-D mode--by hovering over the layers icon in the lower left.

# Other relevant tools

Here are some other online tools that you may find useful/interesting.

## Watershed delineation, and more:
* [SCALGO Live](https://scalgo.com/live/global) - One of the inspirations for flowdirections.io, SCALGO Live includes a range of surface water mapping tools based on SRTM and HydroSHEDS, including point-based rapid watershed delineation (and it is quite rapid!). However, SCALGO Live is a bit finicky, offering no visual markers to reliably facilitate delineation, and does not offer the ability to create subwatersheds. Nonetheless, it has some nice features and is worth exploring. Be warned, however: please do not use SRTM for watershed delineation; that's where HydroSHEDS comes in.
* [USGS StreamStats](https://streamstats.usgs.gov/ss/) - U.S.-only stream info, including delineation.
* [ModelMyWatershed](https://modelmywatershed.org/) - Watershed analysis with watershed delineation for the continental U.S. and, with higher resolution, for the Delaware River basin in the Eastern U.S. These delineations are for the purpose of further watershed analysis, not only delineation, so can take some time to complete.

## Water-related

* [River Runner](https://river-runner-global.samlearner.com/) - "Tap to drop a raindrop anywhere in the world and watch where it ends up" - A very nice 3-D river exploration tool!

## Geospatial shapes

* [mapshaper](https://www.mapshaper.org) - View and simplify geospatial shapes.
* [geojson.io](https://www.geojson.io) - View and manipulate GeoJSON files.

# Source code

The source code for flowdirections.io--which also includes this help--is on GitHub: https://www.github.com/openagua/flowdirections.io.git. The source code for the backend API is likewise at https://www.github.com/openagua/flowdirections-api.
