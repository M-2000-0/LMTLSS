/* Email transport.
 *
 * One provider (Resend) behind one function. No key means no transport: auth
 * routes answer 503 email_not_configured rather than pretending to send. The
 * test sink is injected explicitly by the harness and never exists in
 * production.
 */

export function emailConfigured(env) {
  return !!(env && (env.RESEND_API_KEY || env.__emailSink));
}

export function fromAddress(env) {
  return (env && env.EMAIL_FROM) || "LMTLSS <no-reply@lmtlss.app>";
}

export async function sendEmail(env, message) {
  const to = message && message.to;
  if (!to) return { ok: false, reason: "missing_recipient" };

  if (env && Array.isArray(env.__emailSink)) {
    env.__emailSink.push({
      to: to,
      subject: message.subject,
      text: message.text,
      html: message.html || null
    });
    return { ok: true, transport: "test" };
  }

  if (!env || !env.RESEND_API_KEY) return { ok: false, reason: "email_not_configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress(env),
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html || undefined
      })
    });
    if (!response.ok) return { ok: false, reason: "provider_error", status: response.status };
    return { ok: true, transport: "resend" };
  } catch {
    return { ok: false, reason: "provider_unreachable" };
  }
}

function wrap(title, body) {
  return "<div style=\"background:#000;color:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:32px\">" +
    "<div style=\"max-width:480px;margin:0 auto\">" +
    "<p style=\"color:#61EB1A;font-weight:700;letter-spacing:1px;margin:0 0 24px\">LMTLSS</p>" +
    "<h1 style=\"font-size:22px;margin:0 0 12px\">" + title + "</h1>" +
    "<div style=\"color:#a3a3a3;font-size:15px;line-height:1.6\">" + body + "</div>" +
    "<p style=\"color:#525252;font-size:12px;margin-top:32px\">If you did not request this, you can ignore this email.</p>" +
    "</div></div>";
}

export function verificationEmail(code) {
  return {
    subject: "Your LMTLSS verification code",
    text: "Your LMTLSS verification code is " + code + ". It expires in 10 minutes.\n\n" +
      "If you did not create an account, you can ignore this email.",
    html: wrap("Verify your email",
      "<p>Enter this code in the app:</p>" +
      "<p style=\"font-size:32px;letter-spacing:8px;color:#f5f5f5;font-weight:700\">" + code + "</p>" +
      "<p>It expires in 10 minutes.</p>")
  };
}

export function resetEmail(code) {
  return {
    subject: "Reset your LMTLSS password",
    text: "Your LMTLSS password reset code is " + code + ". It expires in 10 minutes.\n\n" +
      "If you did not ask for this, your password has not changed.",
    html: wrap("Reset your password",
      "<p>Enter this code in the app:</p>" +
      "<p style=\"font-size:32px;letter-spacing:8px;color:#f5f5f5;font-weight:700\">" + code + "</p>" +
      "<p>It expires in 10 minutes. If you did not ask for this, nothing has changed.</p>")
  };
}
