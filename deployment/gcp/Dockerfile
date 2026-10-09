FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY src/backend/database/prisma ./src/backend/database/prisma
RUN npm ci --include=dev
COPY . .
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_APP_URL
ENV DEPLOYMENT_TARGET=cloud-run NEXT_PUBLIC_AUTH_PROVIDER=identity-platform
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./.next/standalone
COPY --from=build --chown=node:node /app/.next/static ./.next/standalone/.next/static
COPY --from=build --chown=node:node /app/public ./.next/standalone/public
COPY --from=build --chown=node:node /app/scripts/gcp-start.mjs ./scripts/gcp-start.mjs
COPY --from=build --chown=node:node /app/src/shared/config/gcp-environment.mjs ./src/shared/config/gcp-environment.mjs
USER node
EXPOSE 8080
CMD ["node", "scripts/gcp-start.mjs"]

# A separate migration/job image includes CLI/dev tooling; never run it as the service.
FROM build AS tooling
CMD ["node", "scripts/gcp-migrate.mjs"]
