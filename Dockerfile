FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY game.js /usr/share/nginx/html/game.js
COPY media__1780202545083.jpg /usr/share/nginx/html/media__1780202545083.jpg
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
