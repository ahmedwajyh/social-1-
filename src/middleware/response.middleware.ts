import type { NextFunction, Request, Response, RequestHandler } from "express";
import type { IResponse } from "../common/interface/response.interface.js";

type ResponseHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<IResponse | void> | IResponse | void;

export const responseFormatter = (handler: ResponseHandler): RequestHandler => {
    return async (req, res, next) => {
        try {
            const result = await handler(req, res, next);
            if (res.headersSent) return;

            const response: IResponse = result || {};
            const {
                status = 200,
                message = true,
                data = undefined,
                extra = undefined
            } = response;

            res.status(status).json({ message, status, data, extra });
        } catch (error) {
            next(error);
        }
    };
};
