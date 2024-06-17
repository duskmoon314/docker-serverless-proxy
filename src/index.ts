import { Hono } from "hono";

const registries: { [key: string]: string } = {
  docker: "registry-1.docker.io",
  gcr: "gcr.io",
  ghcr: "ghcr.io",
  quay: "quay.io",
};

type Bindings = {
  MODE: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Listen for all requests
app.all("/*", async (c) => {
  const url = new URL(c.req.url);

  // Get the upstream registry
  const registry =
    c.env.MODE === "prod"
      ? registries[url.hostname.split(".")[0]]
      : "registry-1.docker.io";
  if (!registry) {
    return c.notFound();
  }

  // docker needs to modify scope and package name
  const isDocker = registry === "registry-1.docker.io";

  if (url.pathname === "/v2/") {
    // This is the basic request to the registry
    const req = new Request(`https://${registry}/v2/`, {
      method: "GET",
      headers: new Headers({
        Authorization: c.req.header("Authorization") || "",
      }),
      redirect: "follow",
    });
    const res = await fetch(req);

    // Check if we need to authenticate
    if (res.status === 401) {
      return new Response(
        JSON.stringify({
          errors: [
            {
              code: "UNAUTHORIZED",
              message: "authentication required",
              detail: res.headers.get("WWW-Authenticate"),
            },
          ],
        }),
        {
          status: 401,
          headers: new Headers({
            "WWW-Authenticate": `Bearer realm="${
              c.env.MODE === "prod" ? "https" : "http"
            }://${url.host}/v2/auth",service="docker-serverless-proxy"`,
          }),
        }
      );
    } else {
      return res;
    }
  } else if (url.pathname === "/v2/auth") {
    // This is an additional proxy endpoint to handle authentication

    const req = new Request(`https://${registry}/v2/`, {
      method: "GET",
      redirect: "follow",
    });
    const res = await fetch(req);
    if (res.status !== 401) {
      return res;
    }

    const auth_challenge = res.headers.get("WWW-Authenticate");
    if (!auth_challenge) {
      return res;
    }

    // Extract realm, service, and scope from the challenge
    // Sample challenge: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
    // scope is provided in req, so just get it from url
    const re = /Bearer realm="([^"]+)",service="([^"]+)/;
    const match = auth_challenge.match(re);
    if (!match) {
      return c.text("Invalid auth challenge", 500);
    }

    const auth_url = new URL(match[1]);
    if (match[2].length) {
      auth_url.searchParams.set("service", match[2]);
    }
    if (url.searchParams.has("scope")) {
      // Modify the scope for docker official images
      // repository:ubuntu:pull -> repository:library/ubuntu:pull
      const scope = url.searchParams.get("scope")!.split(":");
      if (isDocker && scope.length === 3 && !scope[1].includes("/")) {
        scope[1] = `library/${scope[1]}`;
      }
      auth_url.searchParams.set("scope", scope.join(":"));
    }

    // Fetch the token
    const auth_req = new Request(auth_url, {
      method: "GET",
      headers: c.req.raw.headers,
    });
    const auth_res = await fetch(auth_req);
    return auth_res;
  } else {
    // Forward the request to the upstream

    // Modify the path for docker official images
    // /v2/ubuntu -> /v2/library/ubuntu
    const req_path = url.pathname.split("/");
    const req_url = new URL(`https://${registry}${url.pathname}`);
    if (
      isDocker &&
      req_path.length > 3 &&
      ["blobs", "manifests", "tags"].includes(req_path[3])
    ) {
      req_path.splice(2, 0, "library");
      req_url.pathname = req_path.join("/");
    }

    const req = new Request(req_url, {
      method: c.req.method,
      headers: new Headers({
        Authorization: c.req.header("Authorization") || "",
      }),

      redirect: "follow",
    });

    const res = await fetch(req);

    return res;
  }
});

export default app;
