FROM nginx:alpine
COPY web-app.tar.gz /tmp/
RUN cd /usr/share/nginx/html && tar xzf /tmp/web-app.tar.gz && rm /tmp/web-app.tar.gz
EXPOSE 80
