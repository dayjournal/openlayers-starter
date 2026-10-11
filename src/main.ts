import './style.css';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import { ScaleLine } from 'ol/control';

const map = new Map({
    target: 'map',
    layers: [
        new TileLayer({
            source: new XYZ({
                url: 'https://tile.mierune.co.jp/mierune_mono/{z}/{x}/{y}.png',
                attributions:
                    '<a href="https://mierune.co.jp">MIERUNE Inc.</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
                attributionsCollapsible: false,
                tileSize: [256, 256],
                minZoom: 0,
                maxZoom: 18,
            }),
        }),
    ],
    view: new View({
        center: fromLonLat([139.767, 35.681]),
        zoom: 11,
    }),
});

map.addControl(
    new ScaleLine({
        units: 'metric',
    })
);
