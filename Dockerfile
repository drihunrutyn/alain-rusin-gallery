FROM oven/bun:1.3.14
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run --cwd packages/web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "packages/web/src/server.ts"]