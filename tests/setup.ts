// Unit tests always run against development defaults, never a developer's local .env.
process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "silent";
