FROM node:current-alpine

COPY server/gun.js /app/server.js
# because plain 'npm i gun' didnt worked
RUN npm install -g pnpm; cd /app/; pnpm i gun
EXPOSE 3000
