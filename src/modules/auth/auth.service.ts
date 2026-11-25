import { userModel } from "../../DB/models/user.model.js";
import { GenderEnum, RoleEnum } from "../../common/utils/enum/user.enum.js";

import {
    ConflictException,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    InternalServerErrorException
} from "../../common/exception/index.js";

import { otpEmailService } from "../../common/service/OTPEmail.service.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {
    KEY_ACCESS,
    KEY_REFRESH,
    WEB_CLIENT_ID
} from "../../config/config.service.js";

import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(WEB_CLIENT_ID || undefined);

class AuthService {

    // Generate Tokens
    private generateTokens = (userId: string, email: string) => {
        const payload = { id: userId, email };

        const accessToken = jwt.sign(payload, KEY_ACCESS, {
            expiresIn: "15m"
        });

        const refreshToken = jwt.sign(payload, KEY_REFRESH, {
            expiresIn: "7d"
        });

        return { accessToken, refreshToken };
    };

    // Signup
    signup = async (body: {
        age?: number;
        email: string;
        fName: string;
        gender?: GenderEnum;
        lName: string;
        password: string;
        phone?: string;
    }) => {

        const {
            age,
            email,
            fName,
            gender,
            lName,
            password,
            phone
        } = body;

        const normalizedEmail = email.trim().toLowerCase();

        const userExist = await userModel.findOne({
            email: normalizedEmail
        });

        if (userExist) {
            throw new ConflictException("User already exists");
        }

        const user = await userModel.create({
            age,
            email: normalizedEmail,
            fName,
            lName,
            password,
            gender: gender ?? GenderEnum.male,
            phone,
            role: RoleEnum.user,
            isEmailVerified: false
        });

        try {
            await otpEmailService.sendOTP(
                normalizedEmail,
                fName,
                "verify-email"
            );
        } catch (error) {
            await userModel.deleteOne({ _id: user._id });
            throw error;
        }

        return {
            message: "Signup successful. OTP sent to your email."
        };
    };

    // Test
    test = async () => {

        const user = await userModel.create({
            age: 20,
            email: `ahmed-${Date.now()}@example.com`,
            fName: "ahmed",
            lName: "wageeh",
            password: "TestPassword123!",
            gender: GenderEnum.male,
            role: RoleEnum.user,
            isEmailVerified: true
        })
 await user.save({validateBeforeSave:true})
        return {
            message: "Signup successful.",
            user
        };
    };

    // Verify Email
    verifyEmail = async (email: string, otp: string) => {

        const normalizedEmail = email.trim().toLowerCase();

        const user = await userModel.findOne({
            email: normalizedEmail
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        if (user.isEmailVerified) {
            throw new ConflictException("Email already verified");
        }

        const isValid = await otpEmailService.verifyOTP(
            normalizedEmail,
            otp,
            "verify-email"
        );

        if (!isValid) {
            throw new BadRequestException("Invalid or expired OTP");
        }

        user.isEmailVerified = true;

        await user.save();

        return {
            message: "Email verified successfully"
        };
    };

    // Login
    login = async (body: {
        email: string;
        password: string;
    }) => {

        const email = body.email.trim().toLowerCase();

        const user = await userModel
            .findOne({ email })
            .select("+password");

        if (!user || !user.password) {
            throw new UnauthorizedException(
                "Invalid email or password"
            );
        }

        if (!user.isEmailVerified) {
            throw new UnauthorizedException(
                "Please verify your email first"
            );
        }

        const isPasswordMatch = await bcrypt.compare(
            body.password,
            user.password
        );

        if (!isPasswordMatch) {
            throw new UnauthorizedException(
                "Invalid email or password"
            );
        }

        const tokens = this.generateTokens(
            user._id.toString(),
            user.email
        );

        await userModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    refreshToken: tokens.refreshToken
                }
            }
        );

        return tokens;
    };

    // Google Login
    googleLogin = async (idToken: string) => {

        if (!WEB_CLIENT_ID) {
            throw new InternalServerErrorException(
                "Google Login is not configured"
            );
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: WEB_CLIENT_ID
        }).catch(() => {
            throw new UnauthorizedException("Invalid Google Token");
        });

        const payload = ticket.getPayload();

        if (
            !payload?.email ||
            !payload.sub ||
            payload.email_verified !== true
        ) {
            throw new UnauthorizedException(
                "Invalid or unverified Google account"
            );
        }

        const email = payload.email.trim().toLowerCase();
        const googleId = payload.sub;

        const validName = (
            value: string | undefined,
            fallback: string
        ): string => {

            const cleaned = value?.trim();

            return cleaned && cleaned.length >= 2
                ? cleaned.slice(0, 30)
                : fallback;
        };

        let user = await userModel.findOne({ googleId });

        if (!user) {
            user = await userModel.findOne({ email });
        }

        if (user?.googleId && user.googleId !== googleId) {
            throw new ConflictException(
                "This email is already linked to another Google account"
            );
        }

        if (!user) {

            user = await userModel.create({
                fName: validName(payload.given_name, "Google"),
                lName: validName(payload.family_name, "User"),
                email,
                googleId,
                role: RoleEnum.user,
                gender: GenderEnum.male,
                isEmailVerified: true
            });

        } else {

            user.googleId = googleId;
            user.isEmailVerified = true;

        }

        const tokens = this.generateTokens(
            user._id.toString(),
            user.email
        );

        user.refreshToken = tokens.refreshToken;

        await user.save();

        return tokens;
    };

    // Refresh Token
    refreshToken = async (token: string) => {

        let decoded: jwt.JwtPayload;

        try {

            const result = jwt.verify(token, KEY_REFRESH);

            if (
                typeof result === "string" ||
                typeof result.id !== "string"
            ) {
                throw new Error("Invalid token payload");
            }

            decoded = result;

        } catch {

            throw new UnauthorizedException(
                "Invalid or expired refresh token"
            );

        }

        const user = await userModel
            .findById(decoded.id)
            .select("+refreshToken");

        if (!user) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        if (!user.refreshToken || user.refreshToken !== token) {
            throw new UnauthorizedException(
                "Refresh token is invalid or has been revoked"
            );
        }

        const tokens = this.generateTokens(
            user._id.toString(),
            user.email
        );

        user.refreshToken = tokens.refreshToken;

        await user.save();

        return tokens;
    };

    // Logout
    logout = async (userId: string) => {

        const user = await userModel.findById(userId);

        if (!user) {
            throw new NotFoundException("User not found");
        }

        await userModel.updateOne(
            { _id: userId },
            {
                $set: {
                    refreshToken: null
                }
            }
        );

        return {
            message: "Logout successful"
        };
    };

    // Forget Password
    forgetPassword = async (email: string) => {

        const normalizedEmail = email.trim().toLowerCase();

        const user = await userModel.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return {
                message: "If the account exists, a reset code has been sent."
            };
        }

        await otpEmailService.sendOTP(
            normalizedEmail,
            user.fName,
            "reset-password"
        );

        return {
            message: "If the account exists, a reset code has been sent."
        };
    };

    // Reset Password
    resetPassword = async (
        email: string,
        otp: string,
        newPassword: string
    ) => {

        const normalizedEmail = email.trim().toLowerCase();

        const user = await userModel.findOne({
            email: normalizedEmail
        });

        if (!user) {
            throw new BadRequestException(
                "Invalid or expired OTP"
            );
        }

        const isValid = await otpEmailService.verifyOTP(
            normalizedEmail,
            otp,
            "reset-password"
        );

        if (!isValid) {
            throw new BadRequestException(
                "Invalid or expired OTP"
            );
        }

        user.password = newPassword;
        user.refreshToken = null;

        await user.save();

        return {
            message: "Password reset successfully"
        };
    };

}

export default new AuthService();