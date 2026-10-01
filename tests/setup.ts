// Unit tests always run against development defaults, never a developer's local .env.
process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "silent";

import { vi } from "vitest";

// Server-only guards throw outside a React Server environment; tests run modules directly.
vi.mock("server-only", () => ({}));
