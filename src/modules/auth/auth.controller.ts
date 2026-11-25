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
import multer from "multer";
import upload from "../../middleware/multer.cloud.js";

const router = express.Router({
    strict: true,
    mergeParams: true,
    caseSensitive: true
});

// Get authenticated user ID
const getUserId = (req: Request): string => {
    const user = req.user;

    if (
        !user ||
        typeof user === "string" ||
        typeof user.id !== "string"
    ) {
        throw new UnauthorizedException("Invalid token payload");
    }

    return user.id;
};

// Signup
router.post(
    "/signup",
    Validation(signupSchema),
    responseFormatter(async (req: Request) => ({
        status: 201,
        data: await AuthService.signup(req.body),
        extra: "User signup successfully"
    }))
);

// Test
router.post(
    "/test",
    responseFormatter(async () => ({
        status: 201,
        data: await AuthService.test(),
        extra: "Test user created successfully"
    }))
);

// Verify Email
router.post(
    "/verify-email",
    Validation(verifyOtpSchema),
    responseFormatter(async (req: Request) => {
        const { email, otp } = req.body;

        return {
            status: 200,
            data: await AuthService.verifyEmail(email, otp),
            extra: "Email verified successfully"
        };
    })
);

// Login
router.post(
    "/login",
    Validation(loginSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.login(req.body),
        extra: "Login successfully"
    }))
);

// Google Login
router.post(
    "/google-login",
    Validation(googleLoginSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.googleLogin(req.body.idToken),
        extra: "Google login successfully"
    }))
);

// Refresh Token
router.post(
    "/refresh-token",
    Validation(refreshTokenSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.refreshToken(req.body.refreshToken),
        extra: "Token refreshed successfully"
    }))
);

// Logout
router.post(
    "/logout",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.logout(getUserId(req)),
        extra: "Logout successfully"
    }))
);

// Forget Password
router.post(
    "/forget-password",
    Validation(forgetPasswordSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.forgetPassword(req.body.email),
        extra: "Password reset instructions processed"
    }))
);

// Reset Password
router.post(
    "/reset-password",
    Validation(resetPasswordSchema),
    responseFormatter(async (req: Request) => {
        const { email, otp, newPassword } = req.body;

        return {
            status: 200,
            data: await AuthService.resetPassword(
                email,
                otp,
                newPassword
            ),
            extra: "Password reset successfully"
        };
    })
);

// Profile
router.get(
    "/profile",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await UserService.getMyProfile(getUserId(req)),
        extra: "Profile retrieved successfully"
    }))
);
// multer
router.post(
  "/upload-multiple",
  upload.array("images", 5),
  (req, res) => {
    res.json({
      files: req.files,
    });
  }
);
export default router;