FROM ubuntu:22.04

WORKDIR /bun

RUN apt-get update
RUN apt-get install libjemalloc-dev -y
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so
RUN apt-get install curl unzip -y
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install curl unzip nodejs -y
RUN npm install -g pnpm bun

WORKDIR /app
RUN addgroup --gid 101 --system appuser && adduser --uid 101 --system appuser
RUN chown -R 101:101 /app && chmod -R g+w /app
USER appuser
COPY . ./

RUN pnpm install
CMD bun start
