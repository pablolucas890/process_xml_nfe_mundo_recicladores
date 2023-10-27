FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk --no-cache add python3 make g++ libtool automake
RUN npm cache clean --force
RUN npm install
ENV PYTHON=/usr/bin/python3
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app ./
COPY . .
CMD ["npm", "start"]
