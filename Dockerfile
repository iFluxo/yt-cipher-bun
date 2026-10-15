FROM oven/bun:1 AS builder

WORKDIR /usr/src/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Fetch the yt-dlp/ejs sources we depend on.
ARG EJS_COMMIT=cd4e87f52e87ab6d8b318fd3a817adda6fafa8dc
RUN git init ejs && \
    cd ejs && \
    git remote add origin https://github.com/yt-dlp/ejs.git && \
    git fetch --depth 1 origin "$EJS_COMMIT" && \
    git checkout --detach FETCH_HEAD && \
    cd .. && \
    rm -rf ./ejs/.git ./ejs/node_modules

# Install dependencies.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --omit=dev

COPY . .

FROM oven/bun:1 AS runner

WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=8001 \
    XDG_CACHE_HOME=/app/data

COPY --from=builder /usr/src/app /app

RUN mkdir -p /app/data

EXPOSE 8001

ENTRYPOINT ["bun", "server.ts"]
