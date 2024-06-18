# docker-serverless-proxy

A simple serverless proxy based on Hono.

Currently supports:
- Cloudflare Workers

## Usage

### Cloudflare Workers

#### Option 1: Fork and Deploy

1. Fork this repository.
2. Set up secrets ([See here if you don't know how](https://docs.github.com/en/actions/reference/encrypted-secrets#creating-encrypted-secrets-for-a-repository)).
   1. `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID. (You can find it in the Cloudflare dashboard.)
   2. `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token. ([See here if you don't know how to get one](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token))
   3. `DOMAIN`: Your domain. For example, `registry.example.com` is a proper value.
3. Enable GitHub Actions in your repository. The forked repository should have actions disabled by default.
   1. Go to the "Settings" tab.
   2. Go to the "Actions" tab.
   3. Enable actions.
4. Trigger the workflow manually.
5. Wait for the deployment to finish.

#### Option 2: [Cloudflare Workers Deploy](https://deploy.workers.cloudflare.com/?url=https://github.com/duskmoon314/docker-serverless-proxy)

I haven't tested this yet.