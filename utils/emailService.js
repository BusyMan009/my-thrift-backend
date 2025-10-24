import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendResetPasswordEmail = async (email, resetToken) => {
  const resetURL = `${
    process.env.FRONTEND_URL || "http://localhost:5173"
  }/reset-password/${resetToken}`;

  await resend.emails.send({
    from: "MyThrift <onboarding@resend.dev>",
    to: email,
    subject: "Reset Your Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          
          <div style="text-align: center;">
            <h2 style="color: #834d1a;">Reset Your Password</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Looks like you forgot your password? No worries, we can help you get back in!
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetURL}" style="background-color: #834d1a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
                Reset Your Password
              </a>
            </div>
            <p style="font-size: 14px; color: #d13438; background-color: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #d13438;">
              <strong>Important:</strong> This link expires in 1 hour
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <div style="text-align: center;">
            <p style="font-size: 13px; color: #999; margin: 5px 0;">
              If you didn't request a password reset, ignore this email
            </p>
            <p style="font-size: 14px; color: #834d1a; margin-top: 20px; font-weight: bold;">
              MyThrift Team
            </p>
          </div>

        </div>
      </div>
    `,
  });
};
