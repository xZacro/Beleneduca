import nodemailer from "nodemailer";

const RECOVERY_RECIPIENT = String(
  process.env.FNI_RECOVERY_EMAIL_TO ?? process.env.FNI_SUPPORT_EMAIL ?? "ebravo@outlook.cl",
)
  .trim()
  .toLowerCase();
const RECOVERY_FROM = String(
  process.env.FNI_RECOVERY_EMAIL_FROM ?? process.env.FNI_SMTP_USER ?? RECOVERY_RECIPIENT,
)
  .trim()
  .toLowerCase();
const SMTP_HOST = String(process.env.FNI_SMTP_HOST ?? "").trim();
const SMTP_PORT = Number(process.env.FNI_SMTP_PORT ?? 587);
const SMTP_SECURE = String(process.env.FNI_SMTP_SECURE ?? "").trim().toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = String(process.env.FNI_SMTP_USER ?? "").trim();
const SMTP_PASSWORD = String(process.env.FNI_SMTP_PASSWORD ?? "");

let cachedTransporter = null;

function assertRecoveryMailConfigured() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !RECOVERY_RECIPIENT) {
    throw new Error(
      "El correo automatico de recuperacion no esta configurado. Define FNI_SMTP_HOST, FNI_SMTP_PORT, FNI_SMTP_USER, FNI_SMTP_PASSWORD y FNI_RECOVERY_EMAIL_TO.",
    );
  }
}

function getTransporter() {
  assertRecoveryMailConfigured();

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return cachedTransporter;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isRecoveryMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD && RECOVERY_RECIPIENT && RECOVERY_FROM);
}

export async function sendRecoveryRequestEmail({
  requesterEmail,
  message,
  userAgent,
  ipAddress,
}) {
  const normalizedRequester = String(requesterEmail ?? "").trim().toLowerCase();
  const trimmedMessage = String(message ?? "").trim();

  assertRecoveryMailConfigured();

  const subject = `Solicitud de recuperacion de acceso | ${normalizedRequester || "usuario sin correo"}`;
  const summary = trimmedMessage || "No se agrego detalle adicional.";
  const sentAt = new Date().toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const text = [
    "Se recibio una solicitud de recuperacion de acceso desde el login institucional.",
    "",
    `Correo institucional: ${normalizedRequester || "-"}`,
    `Detalle: ${summary}`,
    `Fecha: ${sentAt}`,
    `IP: ${ipAddress || "-"}`,
    `User-Agent: ${userAgent || "-"}`,
    "",
    "Este mensaje fue generado automaticamente por la plataforma FNI.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px;font-size:20px">Solicitud de recuperacion de acceso</h2>
      <p style="margin:0 0 16px">Se recibio una solicitud desde el login institucional.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Correo institucional</td><td>${escapeHtml(normalizedRequester || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Detalle</td><td>${escapeHtml(summary)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Fecha</td><td>${escapeHtml(sentAt)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">IP</td><td>${escapeHtml(ipAddress || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">User-Agent</td><td>${escapeHtml(userAgent || "-")}</td></tr>
      </table>
      <p style="margin:16px 0 0;color:#475569;font-size:12px">Este mensaje fue generado automaticamente por la plataforma FNI.</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: RECOVERY_FROM,
    to: RECOVERY_RECIPIENT,
    replyTo: normalizedRequester || undefined,
    subject,
    text,
    html,
  });

  return {
    to: RECOVERY_RECIPIENT,
    from: RECOVERY_FROM,
  };
}
