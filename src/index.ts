import { bootstrap } from "./app.bootstrap.js";

bootstrap().catch((error: unknown) => {
    console.error("Application startup failed:", error);
    process.exitCode = 1;
});
