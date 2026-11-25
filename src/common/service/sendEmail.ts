import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { EMAIL_PASS, PROJECT_NAME, SMTP_EMAIL } from "../../config/config.service.js";

interface IEmailOptions {
    to: string;
    subject: string;
    html?: string;
    attachments?: any[];
}

class EmailService {
    private transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: SMTP_EMAIL,
            pass: EMAIL_PASS
        }
    });

    sendEmail = async ({
        to,
        subject,
        html = "",
        attachments = []
    }: IEmailOptions) => {
        if (!SMTP_EMAIL || !EMAIL_PASS) {
            throw new Error("SMTP_EMAIL and EMAIL_PASS must be configured before sending email.");
        }

        const info = await this.transporter.sendMail({
            from: `"${PROJECT_NAME}" <${SMTP_EMAIL}>`,
            to,
            subject,
            html,
            attachments
        });

        return info;
    };
}

class OTPService {
    generateOTP = (): string => randomInt(100000, 1000000).toString();
}

export const emailService = new EmailService();
export const otpService = new OTPService();
