const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

console.log('✅ Resend email service initialized');

async function sendApprovalEmail({
  to, workflowName, stepName,
  triggeredBy, inputData, token
}) {
  const backendUrl = process.env.BACKEND_URL 
    || 'https://workflow-engine-halleyx.onrender.com';
  
  const approveUrl = `${backendUrl}/approval/approve/${token}`;
  const rejectUrl  = `${backendUrl}/approval/reject/${token}`;

  // Build input data rows
  let inputRows = '';
  if (inputData && typeof inputData === 'object') {
    inputRows = Object.entries(inputData)
      .map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px;color:#94A3B8;
                     font-size:13px;border-bottom:1px solid #1e1e3f;">
            ${k}
          </td>
          <td style="padding:8px 12px;color:#fff;font-weight:600;
                     font-size:13px;border-bottom:1px solid #1e1e3f;">
            ${v}
          </td>
        </tr>`)
      .join('');
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0F0F1A;
             font-family:'Segoe UI',sans-serif;">

  <div style="max-width:540px;margin:40px auto;background:#141428;
              border:1px solid #2D2D5E;border-radius:16px;
              overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);
                padding:32px;">
      <div style="font-size:28px;margin-bottom:8px;">⚡</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
        Approval Required
      </h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">
        A workflow step is waiting for your action
      </p>
    </div>

    <!-- Details -->
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;color:#64748B;
                     font-size:13px;width:130px;">Workflow</td>
          <td style="padding:8px 0;color:#fff;
                     font-size:14px;font-weight:700;">${workflowName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;">Step</td>
          <td style="padding:8px 0;color:#fff;
                     font-size:14px;font-weight:700;">${stepName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;">
            Triggered by
          </td>
          <td style="padding:8px 0;color:#818CF8;
                     font-size:14px;font-weight:600;">
            ${triggeredBy || 'system'}
          </td>
        </tr>
      </table>

      <!-- Input Data -->
      ${inputRows ? `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#64748B;font-size:11px;
                  text-transform:uppercase;letter-spacing:1.5px;
                  font-weight:700;">
          Submission Data
        </p>
        <table style="width:100%;border-collapse:collapse;
                      background:#0A0A14;border-radius:10px;
                      overflow:hidden;border:1px solid #1e1e3f;">
          ${inputRows}
        </table>
      </div>` : ''}

      <!-- Buttons -->
      <div style="text-align:center;padding:8px 0 16px;">
        <a href="${approveUrl}"
           style="display:inline-block;background:#22C55E;
                  color:#fff;text-decoration:none;
                  padding:14px 44px;border-radius:12px;
                  font-weight:700;font-size:15px;
                  margin-right:16px;letter-spacing:0.3px;">
          ✅ &nbsp;APPROVE
        </a>
        <a href="${rejectUrl}"
           style="display:inline-block;background:#EF4444;
                  color:#fff;text-decoration:none;
                  padding:14px 44px;border-radius:12px;
                  font-weight:700;font-size:15px;
                  letter-spacing:0.3px;">
          ❌ &nbsp;REJECT
        </a>
      </div>

      <p style="text-align:center;color:#475569;
                font-size:11px;margin:16px 0 0;">
        This link expires in 24 hours · Do not share this email
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0A0A14;padding:16px 32px;
                border-top:1px solid #1e1e3f;">
      <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
        Halleyx Workflow Engine &nbsp;·&nbsp; Automated Approval System
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Workflow Engine <onboarding@resend.dev>',
      to,
      subject: `⚡ Action Required: "${stepName}" needs approval — ${workflowName}`,
      html,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(error.message);
    }

    console.log(`✅ Approval email sent to ${to} | ID: ${data.id}`);
    return data;

  } catch (err) {
    console.error('❌ sendApprovalEmail failed:', err.message);
    throw err;
  }
}

module.exports = { sendApprovalEmail };
