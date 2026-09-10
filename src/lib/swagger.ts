import "server-only";
import { createSwaggerSpec } from "next-swagger-doc";

export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Cycle Network Grow API",
        version: "0.1.0",
        description:
          "Route Handlers under app/api — see docs/ARCHITECTURE.md §3. Mutations that don't need a browser-callable REST shape use Server Actions instead and aren't documented here.",
      },
      components: {
        securitySchemes: {
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "session",
            description: "Firebase session cookie — see docs/ARCHITECTURE.md §4.",
          },
        },
      },
    },
  });
}
