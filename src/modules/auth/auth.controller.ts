import express, { type Request } from "express";
import AuthService from "./auth.service.js";
import UserService from "../user/user.service.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { UnauthorizedException } from "../../common/exception/index.js";
import {
    signupSchema,
    verifyOtpSchema,
    loginSchema,
    refreshTokenSchema,
    forgetPasswordSchema,
    resetPasswordSchema,
    googleLoginSchema
} from "./auth.validation.js";
import { authentication } from "./auth.middleware.js";

const router = express.Router({
    strict: true,
    mergeParams: true,
    caseSensitive: true
});

const getUserId = (req: Request): string => {
    const user = req.user;
    if (!user || typeof user === "string" || typeof user.id !== "string") {
        throw new UnauthorizedException("Invalid token payload");
    }
    return user.id;
};

router.post(
    "/signup",
    Validation(signupSchema),
    responseFormatter(async (req: Request) => ({
        status: 201,
        data: await AuthService.signup(req.body),
        extra: "user signup successfully"
    }))
);

router.post(
    "/verify-email",
    Validation(verifyOtpSchema),
    responseFormatter(async (req: Request) => {
        const { email, otp } = req.body;
        return {
            status: 200,
            data: await AuthService.verifyEmail(email, otp),
            extra: "email verified successfully"
        };
    })
);

router.post(
    "/login",
    Validation(loginSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.login(req.body),
        extra: "login successfully"
    }))
);

router.post(
    "/google-login",
    Validation(googleLoginSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.googleLogin(req.body.idToken),
        extra: "Google login successfully"
    }))
);

router.post(
    "/refresh-token",
    Validation(refreshTokenSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.refreshToken(req.body.refreshToken),
        extra: "token refreshed successfully"
    }))
);

router.post(
    "/logout",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.logout(getUserId(req)),
        extra: "logout successfully"
    }))
);

router.post(
    "/forget-password",
    Validation(forgetPasswordSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.forgetPassword(req.body.email),
        extra: "password reset instructions processed"
    }))
);

router.post(
    "/reset-password",
    Validation(resetPasswordSchema),
    responseFormatter(async (req: Request) => {
        const { email, otp, newPassword } = req.body;
        return {
            status: 200,
            data: await AuthService.resetPassword(email, otp, newPassword),
            extra: "password reset successfully"
        };
    })
);

router.get(
    "/profile",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.getMyProfile(getUserId(req)),
        extra: "profile retrieved successfully"
    }))
);

export default router;
