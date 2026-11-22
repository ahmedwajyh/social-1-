import type { ErrorRequestHandler } from "express";
import { AppException } from "../common/exception/app.exception.js";

export const globalError: ErrorRequestHandler = (error: unknown, req, res, next) => {
    let status = 500;
    let message = "Internal Server Error";
    let details: unknown;

    if (error instanceof AppException) {
        status = error.status;
        message = error.message;
        if (Array.isArray(error.cause)) details = error.cause;
    } else if (typeof error === "object" && error !== null) {
        const value = error as {
            code?: number;
            name?: string;
            message?: string;
            status?: number;
            statusCode?: number;
        };

        if (value.code === 11000) {
            status = 409;
            message = "A record with this value already exists.";
        } else if (value.name === "ValidationError" || value.name === "CastError") {
            status = 400;
            message = "Invalid data provided.";
        } else if (value.status === 400 || value.statusCode === 400) {
            status = 400;
            message = "Malformed request body.";
        }
    }

    if (status >= 500) {
        console.error("Unhandled request error:", error);
    }

    res.status(status).json({
        message,
        status,
        ...(details ? { details } : {})
    });
};
