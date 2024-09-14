# Web Overlays
Simple and powerfull remote controlled html pages useful for overlays in OBS Studio, CasperCG, XSplit or simply fullscreen browser.

## Features
- server holds overlay state
- on refresh or reconnect, state is updated from server for overlay and controller so you don't loose texts etc.
- multiple overlay-controller groups on 1 server instance (via different websocket paths)
- server is needed only for first connect, both controller and overlay holds state info

# Install
NodeJS is needed. You can download it from https://nodejs.org/en/

    npm install

# Run
## 1. Open controller
Open in browser `scoreboard/controller.html`.

## 2. Open overlay
Open in browser `scoreboard/overlay.html` on other PC or display.

# Setup in playout software
Setting you might need to change is websocket URI in `overlay.html` and `controller.html` in directory `your-overlay/`.
Set it to the same IP address and port as your server is running on, (i.e. `http://127.0.0.1:3000/gun`).

## OBS Studio
1. Click the plus button under Sources
2. Select BrowserSource
3. Name the source and click "OK"
4. Check the "Local file" box
5. Click the "Browse" button on the right and select the client.html you want to use
6. Set the Resolution to 1920x1080 (Width: 1920; Height: 1080) or the overlay resolution
7. Set FPS to you stream FPS (examples: 25, 30, 50, 60)

## Caspar CG
https://github.com/CasparCG/help/wiki/Media:-HTML-Templates

## ProPresenter
ProPresenter browser capabilities in versions 6 and 7 are very limited, and this overlays are not usable.
https://learn.renewedvision.com/propresenter6/the-features-of-propresenter/web-view

## XSplit
https://www.xsplit.com/broadcaster/manual/sources/webpage

# New overlays
You can create your own overlay and associated controller without implementing server.

# Self-hosted server

    HOST=0.0.0.0 PORT=8089 node server-ws.cjs
    or 
    HOST=0.0.0.0 PORT=3000 node server-gun.cjs
    or 
    HOST=0.0.0.0 PORT=8081 node server-mqtt.cjs

## Server API
https://gun.eco/docs/API

## Developing
Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:
```bash
npm run dev
# or start the server and open the app in a new browser tab
npm run dev -- --open
```
## Building
To create a production version of your app:
```bash
npm run build
```
You can preview the production build with `npm run preview`.
> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.


# Thanks
This project was inspired by
- https://github.com/lebaston100/htmlOverlayFramework
- https://github.com/hberntsen/websocket-png-overlayer
- https://github.com/Scrxtchy/ts3-overlay-ws
- https://github.com/slugalisk/win-loss-overlay
- https://github.com/filiphanes/websocket-overlays
- https://github.com/ak5/svelte-gun-example

# TODO
- more overlays
