import Gun from "gun";
import fetch from 'node-fetch';
import { config } from './config.js';

async function set_clip_text(id, text) {
    if (!id) return;
    try {
        const response = await fetch(`${config.arena_url}/api/v1/composition/clips/by-id/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                "video": {
                    "sourceparams": {
                        "Text": text
                    }
                }
            }),
        });
        if (!response.ok) {
            console.error("Arena: PUT failed");
        }
    } catch (error) {
        console.error("Arena: Connection error", error);
    }
}

async function set_video_opacity(id, value) {
    if (!id) return;
    try {
        const response = await fetch(`${config.arena_url}/api/v1/composition/clips/by-id/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ "video": { "opacity": value } }),
        });
        if (!response.ok) {
            console.error("Arena: PUT failed", response);
        }
    } catch (error) {
        console.error("Arena: Connection error", error);
    }
}

let gun = Gun(config.gun_peers);
let overlay = gun.get('bible').get(config.namespace || demo);
let clips = {
    "line1": 0,
    "line2": 0,
}

const response = await fetch(`${config.arena_url}/api/v1/composition`)
const data = await response.json();
for (let i=0; i<data.layers.length; i++) {
    const layer = data.layers[i].clips;
    for (let j=0; j<layer.length; j++) {
        if (layer[j].name.value == "line1" || layer[j].name.value == "line2") {
            clips[layer[j].name.value] = layer[j].id;
        }
    }
}
console.log("clips", clips)

overlay.get('line1').on(function(data, key){
    set_clip_text(clips.line1, data);
    console.log(key, data);
});
overlay.get('line2').on(function(data, key){
    set_clip_text(clips.line2, data);
    console.log(key, data);
});
overlay.get('show').on(function(data, key){
    if (data) {
        set_video_opacity(clips.line1, 1);
        set_video_opacity(clips.line2, 1);
    } else {
        set_video_opacity(clips.line1, 0);
        set_video_opacity(clips.line2, 0);
    }
    console.log(key, data);
});
