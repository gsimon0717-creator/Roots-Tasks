FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# VITE_GOOGLE_CLIENT_ID is baked into the static frontend bundle at build
# time (Vite env vars aren't available at container runtime). Not a secret —
# OAuth Client IDs are public identifiers safe to ship in client-side code —
# so it's set here rather than requiring Cloud Build substitution config.
# Same Client ID as Arbor so both apps share one Google identity.
ENV VITE_GOOGLE_CLIENT_ID=672793982137-u4aul6kbj1039omj7hlit46siq9di1vm.apps.googleusercontent.com
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
