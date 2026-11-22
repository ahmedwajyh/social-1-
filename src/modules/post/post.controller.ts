import express, { type Request } from "express";
import PostService from "./post.service.js";
import { authentication } from "../auth/auth.middleware.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { BadRequestException, UnauthorizedException } from "../../common/exception/index.js";
import {
    commentIdSchema,
    commentSchema,
    createPostSchema,
    feedQuerySchema,
    postIdSchema,
    updatePostSchema
} from "./post.validation.js";

const router = express.Router({ strict: false, caseSensitive: true });

const getUserId = (req: Request): string => {
    const user = req.user;
    if (!user || typeof user === "string" || typeof user.id !== "string") {
        throw new UnauthorizedException("Invalid token payload");
    }
    return user.id;
};

const getRouteParam = (req: Request, name: string): string => {
    const value = req.params[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new BadRequestException(`Invalid route parameter: ${name}`);
    }
    return value;
};

router.post(
    "/",
    authentication,
    Validation(createPostSchema),
    responseFormatter(async (req: Request) => ({
        status: 201,
        data: await PostService.createPost(getUserId(req), req.body),
        extra: "post created successfully"
    }))
);

router.get(
    "/feed",
    authentication,
    Validation(feedQuerySchema),
    responseFormatter(async (req: Request) => {
        const query = req.query as { page?: string; limit?: string };
        return {
            status: 200,
            data: await PostService.getFeed(
                getUserId(req),
                Number(query.page ?? 1),
                Number(query.limit ?? 20)
            ),
            extra: "feed retrieved successfully"
        };
    })
);

router.get(
    "/:postId",
    authentication,
    Validation(postIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.getPost(getUserId(req), getRouteParam(req, "postId")),
        extra: "post retrieved successfully"
    }))
);

router.patch(
    "/:postId",
    authentication,
    Validation(postIdSchema),
    Validation(updatePostSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.updatePost(getUserId(req), getRouteParam(req, "postId"), req.body),
        extra: "post updated successfully"
    }))
);

router.delete(
    "/:postId",
    authentication,
    Validation(postIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.deletePost(getUserId(req), getRouteParam(req, "postId")),
        extra: "post deleted successfully"
    }))
);

router.post(
    "/:postId/like",
    authentication,
    Validation(postIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.likePost(getUserId(req), getRouteParam(req, "postId")),
        extra: "post liked successfully"
    }))
);

router.delete(
    "/:postId/like",
    authentication,
    Validation(postIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.unlikePost(getUserId(req), getRouteParam(req, "postId")),
        extra: "post unliked successfully"
    }))
);

router.post(
    "/:postId/comments",
    authentication,
    Validation(postIdSchema),
    Validation(commentSchema),
    responseFormatter(async (req: Request) => ({
        status: 201,
        data: await PostService.addComment(getUserId(req), getRouteParam(req, "postId"), req.body.text),
        extra: "comment added successfully"
    }))
);

router.delete(
    "/:postId/comments/:commentId",
    authentication,
    Validation(commentIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await PostService.deleteComment(
            getUserId(req),
            getRouteParam(req, "postId"),
            getRouteParam(req, "commentId")
        ),
        extra: "comment deleted successfully"
    }))
);

export default router;
