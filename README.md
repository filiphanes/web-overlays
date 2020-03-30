# Gun Overlay
Simple and powerfull remote controlled html pages useful for overlays in OBS Studio, Casper CD, XSplit, ProPresenter or simply fullscreen browser.

## Features
- server holds overlay state
- on refresh or reconnect, state is updated from server for overlay and controller so you don't loose texts etc.
- multiple overlay-controller groups on 1 server instance (via different websocket paths)
- server is needed only for first connect, both controller and overlay holds state info

# Install
NodeJS is needed. You can download it from https://nodejs.org/en/

    npm install

# Run
## 1. Run websocket server
Node server:

    node server.js

## 2. Open controller
Open in browser `lower-third-simple/controller.html`.

## 3. Open overlay
Open in browser `lower-third-simple/overlay.html`

# Setup in playout software
Setting you might need to change is websocket URI in `overlay.html` and `controller.html` in directory `your-overlay/`.
Set it to the same IP address and port as your server is running on, (i.e. `http://127.0.0.1:8080/gun`).

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
https://learn.renewedvision.com/propresenter6/the-features-of-propresenter/web-view

## XSplit
https://www.xsplit.com/broadcaster/manual/sources/webpage

# New overlays
You can create your own overlay and associated controller without implementing server.

## Server API
https://gun.eco/docs/API

# Thanks
This project was inspired by
- https://github.com/lebaston100/htmlOverlayFramework
- https://github.com/hberntsen/websocket-png-overlayer
- https://github.com/Scrxtchy/ts3-overlay-ws
- https://github.com/slugalisk/win-loss-overlay
- https://github.com/filiphanes/websocket-overlays

# TODO
- more overlays
