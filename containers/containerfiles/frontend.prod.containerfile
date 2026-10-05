FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable
WORKDIR /app
COPY . /app

FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS build
RUN pnpm run build

FROM alpine
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /www && echo 'dist ready'"]
