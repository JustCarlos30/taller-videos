FROM node:22.23.4-bookworm-slim@sha256:ea11b74b986d520137cdef9a5346e447a00f275ecc4abc0055b7151226231e09
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
    libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
    libpango-1.0-0 libcairo2 libcups2 fonts-dejavu-core ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx --no-install remotion browser ensure \
    && chmod -R a+rX /app
COPY runtime ./runtime
COPY tsconfig.json ./
ENV HOME=/tmp BROWSER=none
CMD ["node", "runtime/launch.mjs", "studio"]
