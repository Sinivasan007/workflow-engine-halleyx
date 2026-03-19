/**
 * emailService.js
 * Halleyx Workflow Engine — Email Approval Service
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,                  // Force IPv4 — fixes Render timeout
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
transporter.verify((err, success) => {
  if (err) {
    console.error('❌ Email service error:', err.message);
  } else {
    console.log('✅ Email service ready');
  }
});

// ── NO module.exports = transporter here ─────────────

/**
 * Send approval email with Approve / Reject buttons
 */
async function sendApprovalEmail({ to, workflowName, stepName, triggeredBy, inputData, token }) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const approveUrl = `${backendUrl}/approval/approve/${token}`;
  const rejectUrl = `${backendUrl}/approval/reject/${token}`;

  // Build input data summary table rows
  let inputSummary = '';
  if (inputData && typeof inputData === 'object') {
    const entries = Object.entries(inputData);
    if (entries.length > 0) {
      inputSummary = entries
        .map(([k, v]) => `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #2D2D5E;
                       color:#94A3B8;font-size:13px;">${k}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #2D2D5E;
                       color:#fff;font-size:13px;font-weight:600;">${v}</td>
          </tr>`)
        .join('');
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0F0F1A;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#141428;
              border:1px solid #2D2D5E;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);
                padding:32px 32px 28px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">⚡ Approval Required</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
        A workflow step needs your approval
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;width:120px;">
            Workflow
          </td>
          <td style="padding:8px 0;color:#fff;font-size:14px;font-weight:700;">
            ${workflowName}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;">Step</td>
          <td style="padding:8px 0;color:#fff;font-size:14px;font-weight:700;">
            ${stepName}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;">Triggered by</td>
          <td style="padding:8px 0;color:#818CF8;font-size:14px;font-weight:600;">
            ${triggeredBy || 'system'}
          </td>
        </tr>
      </table>

      ${inputSummary ? `
      <div style="margin-bottom:24px;">
        <p style="color:#64748B;font-size:12px;text-transform:uppercase;
                  letter-spacing:1px;margin:0 0 8px;font-weight:700;">
          Input Data
        </p>
        <table style="width:100%;border-collapse:collapse;background:#0A0A14;
                      border-radius:8px;overflow:hidden;">
          ${inputSummary}
        </table>
      </div>` : ''}

      <!-- Action Buttons -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${approveUrl}"
           style="display:inline-block;background:#22C55E;color:#fff;
                  text-decoration:none;padding:14px 40px;border-radius:12px;
                  font-weight:700;font-size:15px;margin-right:12px;">
          ✅ APPROVE
        </a>
        <a href="${rejectUrl}"
           style="display:inline-block;background:#EF4444;color:#fff;
                  text-decoration:none;padding:14px 40px;border-radius:12px;
                  font-weight:700;font-size:15px;">
          ❌ REJECT
        </a>
      </div>

      <p style="color:#64748B;font-size:11px;text-align:center;margin-top:20px;">
        This approval link expires in 24 hours.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0A0A14;padding:16px 32px;
                border-top:1px solid #2D2D5E;">
      <p style="margin:0;color:#64748B;font-size:11px;text-align:center;">
        Halleyx Workflow Engine — Automated Approval System
      </p>
    </div>

  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"Workflow Engine" <workflowengine35@gmail.com>',
    to,
    subject: `Action Required: Approval needed for "${stepName}" in "${workflowName}"`,
    html,
  });

  console.log(`✅ Approval email sent to ${to} | MessageId: ${info.messageId}`);
  return info;
}

module.exports = { sendApprovalEmail };  // ← ONE export at the bottom only
