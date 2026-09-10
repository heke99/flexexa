FROM node:24.19.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Explicit source allowlist: no workspace credentials, fixtures, or build dependencies.
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/domain/src ./packages/domain/src
COPY packages/api-contracts/package.json ./packages/api-contracts/package.json
COPY packages/api-contracts/src ./packages/api-contracts/src
COPY apps/identity-service/package.json ./apps/identity-service/package.json
COPY apps/identity-service/src ./apps/identity-service/src
RUN mkdir -p node_modules/@flexexa && ln -s ../../packages/domain node_modules/@flexexa/domain && ln -s ../../packages/api-contracts node_modules/@flexexa/api-contracts
USER node
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live',{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "apps/identity-service/src/main.ts"]
