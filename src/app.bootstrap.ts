import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { connectionDB } from "./DB/connection.db.js";
import RedisService from "./DB/connection.redis.js";
import { globalError } from "./middleware/error.middleware.js";
import { authRouter, userRouter, postRouter } from "./modules/index.js";
import { AppException } from "./common/exception/index.js";
import {
    ALLOWED_ORIGINS,
    PORT,
    validateRuntimeConfig
} from "./config/config.service.js";

const app: express.Application = express();

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            message: "Too many requests. Please try again later.",
            status: 429
        });
    }
});

export const bootstrap = async () => {
    validateRuntimeConfig();
    await connectionDB();
    await RedisService.connect();

    const corsOrigin: string | string[] = ALLOWED_ORIGINS.includes("*")
        ? "*"
        : ALLOWED_ORIGINS;

    app.use(express.json({ limit: "2mb" }));
    app.use(cors({ origin: corsOrigin }));
    app.use(limiter);

    app.get("/", (req: Request, res: Response) => {
        res.status(200).json({ message: "Welcome to Social App by ahmed wageeh", status: 200 });
    });

    app.use("/auth", authRouter);
    app.use("/users", userRouter);
    app.use("/posts", postRouter);

    app.use((req: Request, res: Response, next: NextFunction) => {
        next(new AppException("The requested route was not found", 404));
    });

    app.use(globalError);

    const server = app.listen(PORT, () => {
        console.log(`Social App is listening on port ${PORT} 🙌`);
    });

    return server;
};
