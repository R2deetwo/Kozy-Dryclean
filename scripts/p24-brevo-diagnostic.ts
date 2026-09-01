// Phase-24 diagnostic: send a test email through the EXACT production pipeline
// (same Brevo API key + sender as the app) to both admin inboxes.
// Purpose: determine whether Brevo ACCEPTS the send. If accepted but not
// received, the emails are going to the spam folder (sender/domain mismatch).
const API_KEY = process.env.BREVO_API_KEY!
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'chigozieubahesq@gmail.com'

const RECIPIENTS = ['kozygarmentcare@gmail.com', 'practiceprosystems@gmail.com']

const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#F8F9FA;padding:32px 0;margin:0;">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(10,25,47,0.08);">
<div style="background:#0A192F;padding:18px 32px;">
<span style="color:#D4AF37;font-weight:700;font-size:18px;letter-spacing:0.5px;">Kozy Care</span>
<span style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-left:10px;">Operations</span>
</div>
<div style="padding:28px 32px;">
<h2 style="color:#0A192F;font-size:18px;margin:0 0 10px 0;">Alert pipeline test</h2>
<p style="color:#6F88A8;font-size:14px;line-height:1.6;margin:0 0 14px 0;">
This is a one-time diagnostic send from the Kozy Care alert pipeline (Phase 24).
If you can read this in your <b>inbox</b>, admin alerts are deliverable to this address.
If it landed in <b>spam</b>, please mark it as "Not spam" and add the sender to your contacts —
that fixes future order/signup alerts.
</p>
<p style="color:#98A8BD;font-size:11px;margin:14px 0 0 0;border-top:1px solid #E2E5E9;padding-top:14px;">
Sent ${new Date().toISOString()} · sender: ${SENDER_EMAIL}
</p>
</div></div></body></html>`

async function main() {
  for (const to of RECIPIENTS) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'Kozy Care', email: SENDER_EMAIL },
          to: [{ email: to }],
          subject: '[Kozy Care] Alert pipeline test',
          htmlContent: html,
        }),
      })
      const body = await res.text()
      console.log(to, '→', res.status, body.slice(0, 300))
    } catch (e) {
      console.log(to, '→ FETCH ERROR', e)
    }
  }
}

main()
