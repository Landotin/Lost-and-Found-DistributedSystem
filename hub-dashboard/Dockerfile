# Build stage
FROM node:22-alpine AS build
ARG VITE_HUB_API_URL
ARG VITE_HUB_WS_URL
ARG VITE_ADMIN_SECRET

ENV VITE_HUB_API_URL=$VITE_HUB_API_URL
ENV VITE_HUB_WS_URL=$VITE_HUB_WS_URL
ENV VITE_ADMIN_SECRET=$VITE_ADMIN_SECRET

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5005
CMD ["nginx", "-g", "daemon off;"]