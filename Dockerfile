FROM nginx:alpine
COPY . /usr/share/nginx/html/
RUN rm -rf /usr/share/nginx/html/.git /usr/share/nginx/html/task.md /usr/share/nginx/html/walkthrough.md /usr/share/nginx/html/implementation_plan.md
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
