// OTP delivery is restricted to Brevo HTTPS.

require('dotenv').config();

function withTimeout(promise, ms, desc) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) while ${desc}`)), ms)
    ),
  ]);
}

async function tryBrevo({ toEmail, subject, text, html }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_USER || '').trim();
  if (!apiKey) {
    return { success: false, error: 'Brevo is not configured. Set BREVO_API_KEY in the service environment.' };
  }
  if (!senderEmail) {
    return { success: false, error: 'Brevo sender is not configured. Set BREVO_SENDER_EMAIL in the service environment.' };
  }

  try {
    const response = await withTimeout(
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Prime Dreems', email: senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      }),
      7000,
      'calling Brevo API'
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.messageId) {
      return { success: false, error: data.message || 'Brevo rejected the OTP email.' };
    }
    return { success: true, messageId: data.messageId, provider: 'brevo-https' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Brevo request failed.' };
  }
}

// ─── HTML Email Template ───────────────────────────────────────────────────
function buildOtpEmailHtml({ recipientName, otp, purpose, expiryMinutes = 10 }) {
  const isReset = purpose === 'reset';
  const heading = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subtext = isReset
    ? 'Use the verification code below to reset your Prime Dreems password.'
    : 'Welcome to Prime Dreems — Cricket Fantasy Colosseum! Enter the code below to complete your registration.';
  const accentColor = isReset ? '#FFD700' : '#FF1744';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-radius:16px;overflow:hidden;border:2px solid #FF1744;">
          <tr>
            <td style="background:linear-gradient(135deg,#FF1744,#800018);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:900;letter-spacing:2px;">🏏 PRIME DREEMS</h1>
              <p style="margin:6px 0 0;color:#FFD700;font-size:13px;font-weight:bold;">Cricket Fantasy Colosseum</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 10px;color:#ffffff;font-size:20px;">${heading}</h2>
              <p style="margin:0 0 24px;color:#A3A3A3;font-size:14px;line-height:1.6;">
                Hi ${recipientName || 'Player'},<br/>
                ${subtext}
              </p>
              <div style="background:#000000;border:2px solid ${accentColor};border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#A3A3A3;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Your Verification Code</p>
                <p style="margin:0;font-size:42px;font-weight:900;letter-spacing:12px;color:${accentColor};font-family:Consolas,monaco,monospace;">${otp}</p>
              </div>
              <p style="margin:0 0 8px;color:#FFD700;font-size:13px;text-align:center;font-weight:bold;">
                ⏱️ Valid for <strong>${expiryMinutes} minutes</strong> only.
              </p>
              <p style="margin:0;color:#737373;font-size:12px;text-align:center;">
                If you did not request this code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #222222;background:#050505;">
              <p style="margin:0;color:#737373;font-size:12px;text-align:center;line-height:1.6;">
                Need help? Email <a href="mailto:support@primedreems.com" style="color:#FFD700;text-decoration:none;">support@primedreems.com</a><br/>
                © 2026 Prime Dreems. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Master Delivery Function ──────────────────────────────────────────────
async function executeSendMail({ toEmail, name, otp, purpose, expiryMinutes = 10 }) {
  const isReset = purpose === 'reset';
  const subject = isReset ? `Prime Dreems Password Reset Code: ${otp}` : `Your Prime Dreems Verification Code: ${otp}`;
  const plainText = `Hi ${name || 'Player'},\n\nYour Prime Dreems verification code is: ${otp}\n\nValid for ${expiryMinutes} minutes.\n\n— Team Prime Dreems`;
  const html = buildOtpEmailHtml({ recipientName: name, otp, purpose, expiryMinutes });
  return await tryBrevo({ toEmail, subject, text: plainText, html });
}

// ─── Exported Methods ──────────────────────────────────────────────────────
async function sendSignupOtp({ toEmail, name, otp, expiryMinutes = 10 }) {
  return await executeSendMail({ toEmail, name, otp, purpose: 'signup', expiryMinutes });
}

async function sendPasswordResetOtp({ toEmail, name, otp, expiryMinutes = 10 }) {
  return await executeSendMail({ toEmail, name, otp, purpose: 'reset', expiryMinutes });
}

module.exports = {
  sendSignupOtp,
  sendPasswordResetOtp,
};
