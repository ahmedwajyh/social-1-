import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { KEY_ACCESS } from "../../config/config.service.js";
import { UnauthorizedException } from "../../common/exception/app.exception.js";

export const authentication = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        next(new UnauthorizedException("Access token is required"));
        return;
    }

    const [bearer, token, ...extra] = authorization.trim().split(/\s+/);
    if (bearer !== "Bearer" || !token || extra.length) {
        next(new UnauthorizedException("Invalid authorization header"));
        return;
    }

    try {
        const decoded = jwt.verify(token, KEY_ACCESS);
        if (typeof decoded === "string" || typeof decoded.id !== "string") {
            throw new Error("Invalid access token payload");
        }

        req.user = decoded;
        next();
    } catch {
        next(new UnauthorizedException("Invalid or expired access token"));
    }
};
