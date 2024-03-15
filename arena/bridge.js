import Gun from "gun";
import fetch from 'node-fetch';
import { config } from './config.js';

async function put_clip(id, data) {
    if (!id) return;
    try {
        const response = await fetch(`${config.arena_url}/api/v1/composition/clips/by-id/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            console.error("Arena: PUT failed", await response.text());
        }
    } catch (error) {
        console.error("Arena: Connection error", error);
    }
}

async function set_clip_text(id, text) {
    await put_clip(id, { "video": { "sourceparams": { "Text": text } } })
}

async function set_video_opacity(id, value) {
    await put_clip(id, { "video": { "opacity": value } })
}

// Init Arena clips
let clip_ids = {
    line1: 0,
    line2: 0,
}
const response = await fetch(`${config.arena_url}/api/v1/composition`)
const data = await response.json();
for (let i=0; i<data.layers.length; i++) {
    const layer = data.layers[i].clips;
    for (let j=0; j<layer.length; j++) {
        clip_ids[layer[j].name.value] = layer[j].id;
    }
}
console.log("clips", clip_ids)

let gun = Gun(config.gun_peers);
let overlay = gun.get('bible').get(config.namespace || demo);

overlay.get('line1').on(function(data, key){
    set_clip_text(clip_ids.line1, data.trim());
    console.log(key, data);
});
overlay.get('line2').on(function(data, key){
    set_clip_text(clip_ids.line2, data.trim());
    console.log(key, data);
});
overlay.get('show').on(function(data, key){
    set_video_opacity(clip_ids.line1, +data);
    set_video_opacity(clip_ids.line2, +data);
    console.log(key, data);
});
