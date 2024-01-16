# Use an official Node.js runtime as the base image
FROM node:bullseye-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

RUN apt update && apt -y dist-upgrade && \
    apt install -y dirmngr && \
    echo "deb http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list && \
    echo "deb-src http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com AD3DD469 && \
    apt update -y && apt install --assume-yes nextcloud-desktop-cmd && \
    apt install -y ldap-utils && \
    apt autoremove && apt clean && rm -rf /var/lib/apt/lists/*

# Copy app
COPY backend/utils/nextcloud-migration/src/** ./src/
COPY backend/utils/nextcloud-migration/.nvmrc ./
COPY backend/utils/nextcloud-migration/*.json ./
COPY backend/utils/nextcloud-migration/rollup.config.js ./

RUN npm i && npm run build && npm cache clean --force && rm -rf node_modules && \
    perl -i -ne 'print unless/prestart/' package.json

# Run the Node.js application
CMD ["npm", "run", "start"]
