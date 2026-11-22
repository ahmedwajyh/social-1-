import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppException } from "../common/exception/app.exception.js";

type ReqType = "body" | "params" | "query";
type SchemaType = Partial<Record<ReqType, ZodType>>;

export const Validation = (schema: SchemaType) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const issues = [];

        for (const key of Object.keys(schema) as ReqType[]) {
            const currentSchema = schema[key];
            if (!currentSchema) continue;

            const result = currentSchema.safeParse(req[key]);
            if (!result.success) {
                issues.push(...result.error.issues);
                continue;
            }

            if (key === "body") req.body = result.data;
        }

        if (issues.length) {
            next(new AppException("Validation Error", 400, issues));
            return;
        }

        next();
    };
};
