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
        console.error("put clip error", error.code);
    }
}

async function set_clip_text(id, text) {
    await put_clip(id, { "video": { "sourceparams": { "Text": text } } })
}

async function set_video_opacity(id, value) {
    await put_clip(id, { "video": { "opacity": value } })
}

async function find_clips() {
    try {
        var response = await fetch(`${config.arena_url}/api/v1/composition`)
    } catch (error) {
        console.log("find clips error", error.code);
        return;
    }
    const data = await response.json();
    data.layers.forEach((layer) => {
        layer.clips.forEach((clip) => {
            if      (clip.name.value.includes("#line1")) clip_ids.line1 = clip.id;
            else if (clip.name.value.includes("#line2")) clip_ids.line2 = clip.id;
        })
    })
    console.log("clip_ids", clip_ids)
}

let clip_ids = {
    line1: 0,
    line2: 0,
}
let gun = Gun(config.gun_peers);
let overlay = gun.get('bible').get(config.namespace || demo);
await find_clips();
setInterval(find_clips, 10101);

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
