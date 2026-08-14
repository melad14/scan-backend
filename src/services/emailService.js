const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter from env vars or returns null if not configured
 */
const getTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
};

/**
 * Send 6-digit OTP verification email to user
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP string
 */
exports.sendOtpEmail = async (toEmail, otpCode) => {
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@drray.app';
  const fromDisplay = `"دكتور راي | Dr Ray" <${fromEmail}>`;
  const transporter = getTransporter();

  // Console log OTP code for easy development / debugging when SMTP is not configured
  console.log(`[Dr Ray OTP Email] Target: ${toEmail} | Code: ${otpCode}`);

  if (!transporter) {
    console.warn('[Dr Ray EmailService] SMTP not configured. Logged OTP to console.');
    return { success: true, simulated: true };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; direction: rtl; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; }
        .logo { font-size: 24px; font-weight: bold; color: #1D9E75; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
        .otp-box { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #085041; background: #E8F5E9; padding: 16px 24px; border-radius: 12px; display: inline-block; margin: 16px 0; }
        .footer { font-size: 12px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">دكتور راي | Dr Ray</div>
        <div class="subtitle">رمز تفعيل الحساب</div>
        <p style="color: #333; font-size: 15px;">شكراً لتسجيلك في دكتور راي. يرجى إدخال رمز التحقق التالي لإكمال تفعيل حسابك:</p>
        <div class="otp-box">${otpCode}</div>
        <p style="color: #666; font-size: 13px;">هذا الرمز صالحة لمدة 10 دقائق فقط. يرجى عدم مشاركة هذا الرمز مع أي شخص.</p>
        <div class="footer">
          إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.<br>
          جميع الحقوق محفوظة &copy; ${new Date().getFullYear()} دكتور راي
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromDisplay,
      to: toEmail,
      subject: `رمز تأكيد الحساب: ${otpCode} - دكتور راي`,
      html: htmlContent
    });
    return { success: true };
  } catch (error) {
    console.error('[Dr Ray EmailService] Failed to send OTP email:', error);
    return { success: false, error: error.message };
  }
};
