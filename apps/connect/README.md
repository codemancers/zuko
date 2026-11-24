# Zuko Connect

Zuko's connections service is a [Kosha](https://github.com/codemancers/kosha)
app. Kosha stores third-party credentials encrypted and proxies provider
requests without returning those credentials to Zuko.

This deployment intentionally installs only the Apollo.io integration.

## Local setup

```bash
createdb zuko_connect
cp apps/connect/.env.example apps/connect/.env

# Fill KOSHA_SECRET and KOSHA_ENCRYPTION_KEY in apps/connect/.env, then:
pnpm --filter @zuko/connect migrate
pnpm --filter @zuko/connect start
```

Open `http://localhost:3333`. The admin UI is served at `/`, and the API is
served below `/api`.

After signing up in the admin UI:

1. Select the environment Zuko will use.
2. Create an Apollo configuration with the slug `apollo`.
3. Create an environment API key for Zuko's server-side Kosha client.

Apollo does not use OAuth. Each Zuko user connects by supplying an Apollo API
key. The key must be allowed to call `GET /users/api_profile`, which Kosha uses
to validate it before storing it. Apollo API keys act as the Apollo workspace's
longest-standing active admin, so prefer an endpoint-scoped key when the Apollo
plan supports one.

## Deploying

Build from the repository root:

```bash
docker build -f apps/connect/Dockerfile -t zuko-connect .
docker run --env-file apps/connect/.env -p 3333:3333 zuko-connect
```

Set `KOSHA_PUBLIC_URL` to the deployment's public HTTPS origin and point
`DATABASE_URL` at a dedicated Postgres database. Pass all secrets at runtime;
the image does not include `.env`.
