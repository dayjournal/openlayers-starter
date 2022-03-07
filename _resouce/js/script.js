import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';

const map = new Map({
    target: 'map',
    layers: [
        new TileLayer({
            source: new XYZ({
                url: 'https://tile.mierune.co.jp/mierune_mono/{z}/{x}/{y}.png',
                attributions:
                    'Maptiles by <a href="http://mierune.co.jp" target="_blank">MIERUNE</a>, under CC BY. Data by <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors, under ODbL.',
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
