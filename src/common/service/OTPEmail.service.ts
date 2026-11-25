import { emailService, otpService } from "./sendEmail.js";
import { emailTemplate } from "./styleOTP.js";
import redisService from "../../DB/connection.redis.js";

export type OTPPurpose = "verify-email" | "reset-password";

export class OTPEmailService {
    private getKey(email: string, purpose: OTPPurpose): string {
        return `otp::${purpose}::${email.toLowerCase()}`;
    }

    sendOTP = async (
        email: string,
        name: string,
        purpose: OTPPurpose = "verify-email"
    ): Promise<boolean> => {
        const otp = otpService.generateOTP();
        const key = this.getKey(email, purpose);
        await redisService.setValue({ key, value: otp, ttl: 120 });

        const isReset = purpose === "reset-password";
        const html = emailTemplate.generateTemplate({
            name,
            title: isReset ? "Reset Your Password" : "Verify Your Email",
            subtitle: isReset ? "Password Reset" : "Email Verification",
            message: isReset
                ? "Use the code below to reset your password."
                : "Use the code below to verify your email address.",
            otp,
            otpExpiry: "2 minutes"
        });

        try {
            await emailService.sendEmail({
                to: email,
                subject: isReset ? "Password Reset OTP" : "Email Verification OTP",
                html
            });
            return true;
        } catch (error) {
            await redisService.deleteKey(key);
            throw error;
        }
    };

    verifyOTP = async (
        email: string,
        otp: string,
        purpose: OTPPurpose = "verify-email"
    ): Promise<boolean> => {
        const key = this.getKey(email, purpose);
        const savedOTP = await redisService.getValue(key);

        if (savedOTP === null || String(savedOTP) !== otp) {
            return false;
        }

        await redisService.deleteKey(key);
        return true;
    };
}

export const otpEmailService = new OTPEmailService();
