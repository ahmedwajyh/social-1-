import express, { type Request } from "express";
import UserService from "./user.service.js";
import { authentication } from "../auth/auth.middleware.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { BadRequestException, UnauthorizedException } from "../../common/exception/index.js";
import {
    privacySchema,
    searchUsersSchema,
    updateProfileSchema,
    userIdSchema,
    requesterIdSchema
} from "./user.validation.js";

const router = express.Router({ strict: true, caseSensitive: true });

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

router.get(
    "/me",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.getMyProfile(getUserId(req)),
        extra: "profile retrieved successfully"
    }))
);

router.patch(
    "/me",
    authentication,
    Validation(updateProfileSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.updateProfile(getUserId(req), req.body),
        extra: "profile updated successfully"
    }))
);

router.patch(
    "/me/privacy",
    authentication,
    Validation(privacySchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.updatePrivacy(getUserId(req), req.body.isPrivate),
        extra: "privacy settings updated successfully"
    }))
);

router.get(
    "/me/follow-requests",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.getFollowRequests(getUserId(req)),
        extra: "follow requests retrieved successfully"
    }))
);

router.get(
    "/search",
    authentication,
    Validation(searchUsersSchema),
    responseFormatter(async (req: Request) => {
        const query = req.query as { q: string; page?: string; limit?: string };
        const data = await UserService.searchUsers(
            getUserId(req),
            query.q.trim(),
            Number(query.page ?? 1),
            Number(query.limit ?? 20)
        );
        return { status: 200, data, extra: "users retrieved successfully" };
    })
);

router.get(
    "/suggestions",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.suggestions(getUserId(req)),
        extra: "user suggestions retrieved successfully"
    }))
);

router.post(
    "/follow-requests/:requesterId/accept",
    authentication,
    Validation(requesterIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.acceptFollowRequest(getUserId(req), getRouteParam(req, "requesterId")),
        extra: "follow request accepted successfully"
    }))
);

router.delete(
    "/follow-requests/:requesterId",
    authentication,
    Validation(requesterIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.rejectFollowRequest(getUserId(req), getRouteParam(req, "requesterId")),
        extra: "follow request rejected successfully"
    }))
);

router.post(
    "/:userId/follow",
    authentication,
    Validation(userIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.follow(getUserId(req), getRouteParam(req, "userId")),
        extra: "follow action completed"
    }))
);

router.delete(
    "/:userId/follow",
    authentication,
    Validation(userIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.unfollow(getUserId(req), getRouteParam(req, "userId")),
        extra: "unfollow action completed"
    }))
);

router.get(
    "/:userId",
    authentication,
    Validation(userIdSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.getUserProfile(getUserId(req), getRouteParam(req, "userId")),
        extra: "user profile retrieved successfully"
    }))
);

export default router;
