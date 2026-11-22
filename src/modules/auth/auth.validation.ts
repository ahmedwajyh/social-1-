import * as zod from "zod";
import { generalRules } from "../../common/utils/generelRules.js";

export const signupSchema = {
    body: zod.object({
        fName: generalRules.fName,
        lName: generalRules.lName,
        email: generalRules.email,
        age: generalRules.age.optional(),
        gender: generalRules.gender.optional(),
        password: generalRules.password,
        cpassword: generalRules.password,
        phone: generalRules.phone.optional()
    }).superRefine((value, ctx) => {
        if (value.password !== value.cpassword) {
            ctx.addIssue({
                code: "custom",
                message: "Password and confirm password must be the same.",
                path: ["cpassword"]
            });
        }
    })
};

export const verifyOtpSchema = {
    body: zod.object({
        email: generalRules.email,
        otp: zod.string()
            .length(6, "OTP must be 6 digits")
            .regex(/^[0-9]{6}$/, "OTP must contain only numbers")
    })
};

export const loginSchema = {
    body: zod.object({
        email: generalRules.email,
        password: generalRules.password
    })
};

export const forgetPasswordSchema = {
    body: zod.object({
        email: generalRules.email
    })
};

export const resetPasswordSchema = {
    body: zod.object({
        email: generalRules.email,
        otp: zod.string()
            .length(6, "OTP must be 6 digits")
            .regex(/^[0-9]{6}$/, "OTP must contain only numbers"),
        newPassword: generalRules.password
    })
};

export const refreshTokenSchema = {
    body: zod.object({
        refreshToken: zod.string().min(1, "Refresh token is required")
    })
};

export const googleLoginSchema = {
    body: zod.object({
        idToken: zod.string().min(1, "Google ID Token is required").max(10000)
    })
};
