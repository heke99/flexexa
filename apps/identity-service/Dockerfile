ARG IDENTITY_BASE_IMAGE=cgr.dev/chainguard/node@sha256:ca6e654a852f7efc8ba126df701af3894b92e7100b482f638a6823be4e9bc99b
FROM node:24.22.1-alpine3.23@sha256:0468540aa58203ff9e40c2aab3907c52644ab818af6176b1c70a026137dc92a2 AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/api-contracts/package.json ./packages/api-contracts/package.json
COPY apps/identity-service/package.json ./apps/identity-service/package.json
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @flexexa/identity-service...
FROM ${IDENTITY_BASE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Explicit source allowlist: no workspace credentials, fixtures, or build dependencies.
COPY country-packs/package.json country-packs/registry.ts ./country-packs/
COPY country-packs/se/v1.json ./country-packs/se/v1.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/domain/src ./packages/domain/src
COPY packages/api-contracts/package.json ./packages/api-contracts/package.json
COPY packages/api-contracts/src ./packages/api-contracts/src
COPY apps/identity-service/package.json ./apps/identity-service/package.json
COPY apps/identity-service/src ./apps/identity-service/src
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/identity-service/node_modules ./apps/identity-service/node_modules
USER 0:0
RUN ["/usr/bin/node", "-e", "const fs=require('node:fs');fs.mkdirSync('node_modules/@flexexa',{recursive:true});for(const p of ['domain','api-contracts'])fs.symlinkSync('../../packages/'+p,'node_modules/@flexexa/'+p)"]
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 CMD ["/usr/bin/node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live',{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/node", "--experimental-strip-types"]
CMD ["apps/identity-service/src/main.ts"]
