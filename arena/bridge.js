import Gun from "gun";
import fetch from 'node-fetch';
import { config } from './config.js';

async function connectClip(id) {
    if (!id) return;
    try {
        const response = await fetch(`${config.arena_url}/api/v1/composition/clips/by-id/${id}/connect`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(true),
        });
        if (!response.ok) {
            console.error("Arena: POST failed", await response.text());
        }
    } catch (error) {
        console.error("connect clip error", error);
    }
}

async function putClip(id, data) {
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
        console.error("put clip error", error);
    }
}

async function setClipText(id, text) {
    await putClip(id, {"video": {"sourceparams": {"Text": text}}})
}

async function setvideoOpacity(id, value) {
    await putClip(id, {"video": {"opacity": value}})
}

async function findClips() {
    try {
        var response = await fetch(`${config.arena_url}/api/v1/composition`)
    } catch (error) {
        console.log("find clips error", error.code);
        return;
    }
    const data = await response.json();
    data.layers.forEach((layer) => {
        layer.clips.forEach((clip) => {
            [...clip.name.value.matchAll(/#gab-([\w\d]+)-([ab])/g)].forEach((match) => {
                if      (match[2] == 'a') clipsA[match[1]] = clip.id;
                else if (match[2] == 'b') clipsB[match[1]] = clip.id;
            })
        })
    })
    console.log("AB", clipsA, clipsB)
}

async function updateState(data, key) {
    if (state[key] != data) {
        state[key] = data;
        console.log(key, '=', data);
        if (!timeout) timeout = setTimeout(connectNextClip, 50);
    }
}

async function connectNextClip() {
    timeout = null;
    await setClipText(nextClips.line1, state.line1);
    await setClipText(nextClips.line2, state.line2);
    await setvideoOpacity(nextClips.line1, +state.show);
    await setvideoOpacity(nextClips.line2, +state.show);
    await connectClip(nextClips.line1)
    await connectClip(nextClips.line2)
    if (nextClips == clipsA) nextClips = clipsB;
    else nextClips = clipsA;
}

let gun = Gun(config.gun_peers);
let overlay = gun.get('bible').get(config.namespace || demo);
let clipsA = {};
let clipsB = {};
let nextClips = clipsA;
const state = {};
let timeout = null;

await findClips();
setInterval(findClips, 10101);
overlay.get('line1').on(updateState);
overlay.get('line2').on(updateState);
overlay.get('show').on(updateState);