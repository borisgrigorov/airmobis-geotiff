import "./style.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature.js";
import Geolocation from "ol/Geolocation.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import Point from "ol/geom/Point.js";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style.js";
import { Vector as VectorSource } from "ol/source.js";
import { Vector as VectorLayer } from "ol/layer.js";
import WebGlTile from "ol/layer/WebGLTile.js";
import { fromUrl } from "geotiff";
import proj4 from "proj4";
import { register } from "ol/proj/proj4.js";
import { createEmpty, extend, getCenter } from "ol/extent.js";
import { transformExtent } from "ol/proj.js";

// Hard coded URL to the geotiff image
const geotiffUrl = "http://localhost:5173/odm_orthophoto_rgba.tif";

// Define the projection for EPSG:32633 (UTM Zone 33N)
proj4.defs(
    "EPSG:32633",
    "+proj=utm +zone=33 +ellps=WGS84 +datum=WGS84 +units=m +no_defs"
);

// Define the projection for EPSG:3857 (Web Mercator)
proj4.defs(
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs"
);
// Register the projection so OpenLayers can use it:
register(proj4);

// Define the geotiff source
const geotiffSource = new GeoTIFF({
    sources: [
        {
            url: geotiffUrl,
        },
    ],
});
// Define the geotiff layer
let geotiffLayer = new WebGlTile({
    source: geotiffSource,
});
// Define the map
const map = new Map({
    // HTML element defined with id="map"
    target: "map",
    units: "m",
    layers: [
        new TileLayer({
            source: new OSM(),
        }),
        geotiffLayer,
    ],
    // Transform the extent of the geotiff to EPSG:3857
    view: geotiffSource.getView().then(function (options) {
        const projection = "EPSG:3857";
        const extent = createEmpty();
        extend(
            extent,
            transformExtent(options.extent, options.projection, projection)
        );
        return {
            projection: projection,
            center: getCenter(extent),
            zoom: 0,
            // Uncommenting this will zoom the map to the extent of the geotiff
            // extent: extent,
        };
    }),
});

// Define the geolocation
const geolocation = new Geolocation({
    // enableHighAccuracy must be set to true to have the heading value.
    trackingOptions: {
        enableHighAccuracy: true,
    },
    projection: map.getView().getProjection(),
});

// Function to get the element with the given id
function el(id) {
    return document.getElementById(id);
}

// Handle geolocation toggle
el("track").addEventListener("change", function () {
    geolocation.setTracking(this.checked);
    zoomedToLocation = false;
});

// This variable is used to prevent the map to zoom to the location on every change
let zoomedToLocation = false;
// Handle geolocation change
geolocation.on("change", function () {
    // Only zoom to location on the first change
    if (!zoomedToLocation) {
        map.getView().setCenter(
            geolocation.getPosition(),
            "EPSG:4326",
            "EPSG:3857"
        );
        zoomedToLocation = true;
    }
    map.getView().setZoom(16);
});

// Handle geolocation error.
geolocation.on("error", function (error) {
    const info = document.getElementById("info");
    info.innerHTML = error.message;
    info.style.display = "";
});

// Handle geolocation accuracy change
const accuracyFeature = new Feature();
geolocation.on("change:accuracyGeometry", function () {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
});

// Define the position feature and style
const positionFeature = new Feature();
positionFeature.setStyle(
    new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({
                color: "#3399CC",
            }),
            stroke: new Stroke({
                color: "#fff",
                width: 2,
            }),
        }),
    })
);

geolocation.on("change:position", function () {
    const coordinates = geolocation.getPosition();
    positionFeature.setGeometry(coordinates ? new Point(coordinates) : null);
});

// Define the vector layer for the geolocation
new VectorLayer({
    map: map,
    source: new VectorSource({
        features: [accuracyFeature, positionFeature],
    }),
});

// Variables to store the coordinates in EPSG:32633 and EPSG:3857
var epsg32633Coords;
var epsg3857Coords;

// Function to get the coordinates of geotiff image and add a marker to the map
(async function () {
    const lerp = (a, b, t) => (1 - t) * a + t * b;
    // Load the GeoTIFF from a URL:
    const tiff = await fromUrl(geotiffUrl);
    const image = await tiff.getImage();

    // Convert a GPS coordinate to a pixel coordinate in our tile:
    const [gx1, gy1, gx2, gy2] = image.getBoundingBox();
    const lat = lerp(gy1, gy2, Math.random());
    const long = lerp(gx1, gx2, Math.random());
    console.log(`Looking up GPS coordinate (${lat},${long})`);

    // Transform EPSG:32633 to EPSG:3857:
    // EPSG:32633 coordinates
    epsg32633Coords = [long, lat];
    // Perform the coordinate transformation
    epsg3857Coords = translateCoordinates(epsg32633Coords);

    // Add marker to map:
    const marker = new Feature({
        geometry: new Point(epsg3857Coords),
    });
    const markerLayer = new VectorLayer({
        source: new VectorSource({
            features: [marker],
        }),
    });
    // Add the marker layer to the map
    map.addLayer(markerLayer);
})();

// Function to transform EPSG:32633 to EPSG:3857
function translateCoordinates(coord) {
    // Transform EPSG:32633 to EPSG:3857:

    // Example EPSG:32633 coordinates (long, lat)
    var epsg32633Coords = coord;

    // Perform the coordinate transformation
    var epsg3857Coords = proj4("EPSG:32633", "EPSG:3857", epsg32633Coords);

    return epsg3857Coords;
}

// Function to zoom to the geotiff image
function zoomToGeotiff() {
    map.getView().setCenter(epsg3857Coords, "EPSG:4326", "EPSG:3857");
    map.getView().setZoom(16);
}
// Bind the zoomToGeotiff function to the button
el("zoomToGeotiff").addEventListener("click", zoomToGeotiff);
