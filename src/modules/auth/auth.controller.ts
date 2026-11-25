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
    googleLoginSchema,
} from "./auth.validation.js";

import { authentication } from "./auth.middleware.js";

import upload from "../../middleware/multer.cloud.js";
import uploadFiles from "../../middleware/multer.files.js";
import uploadLarge from "../../middleware/multer.large.js";

import { StoreEnum } from "../../common/service/store.enum.js";
import { S3Service } from "../../common/service/s3.service.js";

const router = express.Router({
    strict: true,
    mergeParams: true,
    caseSensitive: true,
});

const s3Service = new S3Service();

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
        extra: "User signup successfully",
    }))
);

// Test
router.post(
    "/test",
    responseFormatter(async () => ({
        status: 201,
        data: await AuthService.test(),
        extra: "Test user created successfully",
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
            extra: "Email verified successfully",
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
        extra: "Login successfully",
    }))
);

// Google Login
router.post(
    "/google-login",
    Validation(googleLoginSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.googleLogin(req.body.idToken),
        extra: "Google login successfully",
    }))
);

// Refresh Token
router.post(
    "/refresh-token",
    Validation(refreshTokenSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.refreshToken(req.body.refreshToken),
        extra: "Token refreshed successfully",
    }))
);

// Logout
router.post(
    "/logout",
    authentication,
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.logout(getUserId(req)),
        extra: "Logout successfully",
    }))
);

// Forget Password
router.post(
    "/forget-password",
    Validation(forgetPasswordSchema),
    responseFormatter(async (req: Request) => ({
        status: 200,
        data: await AuthService.forgetPassword(req.body.email),
        extra: "Password reset instructions processed",
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
            extra: "Password reset successfully",
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
        extra: "Profile retrieved successfully",
    }))
);

// Upload Single Image
router.post(
    "/upload-single",
    authentication,
    upload.single("image"),
    responseFormatter(async (req: Request) => {
        if (!req.file) {
            throw new Error("Image is required");
        }

        const userId = getUserId(req);

        const key = await s3Service.uploadFile({
            file: req.file,
            path: `Users/${userId}`,
            store_type: StoreEnum.memory,
        });

        const url = await s3Service.getSignedUrl(key);

        return {
            status: 201,
            data: {
                key,
                url,
            },
            extra: "Image uploaded successfully",
        };
    })
);

// Upload Multiple Images
router.post(
    "/upload-multiple",
    authentication,
    upload.array("images", 5),
    responseFormatter(async (req: Request) => {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            throw new Error("Files are required");
        }

        const userId = getUserId(req);

        const keys = await s3Service.uploadFiles({
            files,
            path: `Users/${userId}`,
            store_type: StoreEnum.memory,
        });

        const data = await Promise.all(
            keys.map(async (key) => ({
                key,
                url: await s3Service.getSignedUrl(key),
            }))
        );

        return {
            status: 201,
            data,
            extra: "Files uploaded successfully",
        };
    })
);

// Delete Image
router.delete(
    "/delete-image",
    authentication,
    responseFormatter(async (req: Request) => {
        const { key } = req.body;

        if (!key) {
            throw new Error("Image key is required");
        }

        const userId = getUserId(req);

        if (!key.startsWith(`Users/${userId}/`)) {
            throw new UnauthorizedException(
                "You are not allowed to delete this image"
            );
        }

        await s3Service.deleteFile(key);

        return {
            status: 200,
            data: null,
            extra: "Image deleted successfully",
        };
    })
);

// Upload Single File
router.post(
    "/upload-file",
    authentication,
    uploadFiles.single("file"),
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);

        if (!req.file) {
            throw new Error("Please upload a file");
        }

        const key = await s3Service.uploadFile({
            file: req.file,
            path: `Users/${userId}/Files`,
            store_type: StoreEnum.memory,
        });

        const url = await s3Service.getSignedUrl(key);

        return {
            status: 201,
            data: {
                key,
                url,
            },
            extra: "File uploaded successfully",
        };
    })
);

// Upload Multiple Files
router.post(
    "/upload-files",
    authentication,
    uploadFiles.array("files", 10),
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            throw new Error("Please upload files");
        }

        const keys = await s3Service.uploadFiles({
            files,
            path: `Users/${userId}/Files`,
            store_type: StoreEnum.memory,
        });

        const data = await Promise.all(
            keys.map(async (key) => ({
                key,
                url: await s3Service.getSignedUrl(key),
            }))
        );

        return {
            status: 201,
            data,
            extra: "Files uploaded successfully",
        };
    })
);

// Upload Large File
router.post(
    "/upload-large-file",
    authentication,
    uploadLarge.single("file"),
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);

        if (!req.file) {
            throw new Error("Please upload a file");
        }

        const key = await s3Service.uploadLargeFile({
            file: req.file,
            path: `Users/${userId}/LargeFiles`,
            store_type: StoreEnum.disk,
        });

        const url = await s3Service.getSignedUrl(key);

        return {
            status: 201,
            data: {
                key,
                url,
            },
            extra: "Large file uploaded successfully",
        };
    })
);

// Download File
router.get(
    "/download-file",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const key = req.query.key;

        if (
            typeof key !== "string" ||
            !key.startsWith(`Users/${userId}/`)
        ) {
            throw new UnauthorizedException("Invalid file key");
        }

        const url = await s3Service.downloadFile(key);

        return {
            status: 200,
            data: {
                url,
            },
            extra: "Download URL generated successfully",
        };
    })
);

// Create Signed URL
router.post(
    "/create-url",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const { key } = req.body;

        if (!key || typeof key !== "string") {
            throw new Error("File key is required");
        }

        if (!key.startsWith(`Users/${userId}/`)) {
            throw new UnauthorizedException(
                "You are not allowed to access this file"
            );
        }

        const url = await s3Service.getSignedUrl(key, 3600);

        return {
            status: 200,
            data: {
                key,
                url,
                expiresIn: 3600,
            },
            extra: "Signed URL created successfully",
        };
    })
);

// ========================================
// Get Files
// ========================================
router.get(
    "/get-files",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);

        const result = await s3Service.getFiles({
            path: `Users/${userId}/Files`,
        });

        return {
            status: 200,
            data: result,
            extra: "Files retrieved successfully",
        };
    })
);

// ========================================
// Delete Single File
// ========================================
router.delete(
    "/delete-file",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const { key } = req.body;

        if (!key || typeof key !== "string") {
            throw new Error("File key is required");
        }

        if (!key.startsWith(`Users/${userId}/`)) {
            throw new UnauthorizedException(
                "You are not allowed to delete this file"
            );
        }

        await s3Service.deleteFile(key);

        return {
            status: 200,
            data: null,
            extra: "File deleted successfully",
        };
    })
);

// ========================================
// Delete Multiple Files
// ========================================
router.delete(
    "/delete-files",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const { keys } = req.body;

        if (!Array.isArray(keys) || keys.length === 0) {
            throw new Error("Files keys are required");
        }

        const userPrefix = `Users/${userId}/`;

        const isValid = keys.every(
            (key: unknown) =>
                typeof key === "string" &&
                key.startsWith(userPrefix)
        );

        if (!isValid) {
            throw new UnauthorizedException(
                "You are not allowed to delete these files"
            );
        }

        await s3Service.deleteFiles(keys);

        return {
            status: 200,
            data: null,
            extra: "Files deleted successfully",
        };
    })
);

// ========================================
// Delete Folder
// ========================================
router.delete(
    "/delete-folder",
    authentication,
    responseFormatter(async (req: Request) => {
        const userId = getUserId(req);
        const { folder } = req.body;

        if (!folder || typeof folder !== "string") {
            throw new Error("Folder is required");
        }

        const userPrefix = `Users/${userId}/`;

        if (
            !folder.startsWith(userPrefix) ||
            folder.replace(/\/+$/, "") === `Users/${userId}`
        ) {
            throw new UnauthorizedException(
                "You are not allowed to delete this folder"
            );
        }

        await s3Service.deleteFolder(folder);

        return {
            status: 200,
            data: null,
            extra: "Folder deleted successfully",
        };
    })
);

export default router;
