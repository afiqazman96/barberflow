import type { ReceiptEmailInput } from "./types";

/**
 * Email bodies. Pure functions: data in, `{ subject, html, text }` out.
 *
 * Every interpolated value goes through `esc` — names and shop details are
 * typed by people, and an email client will render whatever markup it is given.
 * Layout is table-and-inline-style on purpose; that is what mail clients agree on.
 */

const GOLD = "#a67a2e";
const INK = "#1b1a17";
const MUTED = "#6b675f";
const LINE = "#e7e2d8";
const PAPER = "#faf8f3";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

function shell(input: { preheader: string; heading: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;">
<tr><td style="padding:28px 28px 8px;font-family:Helvetica,Arial,sans-serif;">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-weight:700;">BarberFlow</p>
<h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};">${esc(input.heading)}</h1>
</td></tr>
<tr><td style="padding:12px 28px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};">
${input.body}
</td></tr>
</table>
<p style="max-width:520px;margin:14px auto 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">${input.footer}</p>
</td></tr></table></body></html>`;
}

function credentialBox(rows: { label: string; value: string; mono?: boolean }[]): string {
  const cells = rows
    .map(
      (r) => `<tr><td style="padding:8px 14px;border-bottom:1px solid ${LINE};font-size:12px;color:${MUTED};width:38%;">${esc(r.label)}</td>
<td style="padding:8px 14px;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};${r.mono ? "font-family:Menlo,Consolas,monospace;letter-spacing:.5px;" : ""}word-break:break-all;">${esc(r.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${PAPER};border:1px solid ${LINE};border-radius:10px;">${cells}</table>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${esc(label)}</a></p>`;
}

const SECURITY_NOTE =
  "For your security, you'll be asked to choose your own password the first time you sign in. Don't share this email.";

export function tenantWelcome(input: {
  ownerName: string;
  businessName: string;
  plan: string;
  trialEndsAt?: string;
  loginUrl: string;
  email: string;
  tempPassword: string;
}): EmailContent {
  const first = input.ownerName.trim().split(/\s+/)[0] || "there";
  const planLine = input.trialEndsAt
    ? `Your ${input.plan} plan starts with a free trial until ${input.trialEndsAt}.`
    : `You're on the ${input.plan} plan.`;
  const subject = `Your BarberFlow account for ${input.businessName}`;
  const html = shell({
    preheader: `Sign in to ${input.businessName} on BarberFlow`,
    heading: `Welcome, ${first}`,
    body: `<p style="margin:0 0 8px;">Your BarberFlow account for <strong>${esc(input.businessName)}</strong> is ready. ${esc(planLine)}</p>
${credentialBox([
  { label: "Email", value: input.email },
  { label: "Temporary password", value: input.tempPassword, mono: true },
])}
${button(input.loginUrl, "Sign in to BarberFlow")}
<p style="margin:0;color:${MUTED};font-size:13px;">${esc(SECURITY_NOTE)}</p>`,
    footer: `Button not working? Copy this link: ${esc(input.loginUrl)}`,
  });
  const text = [
    `Welcome, ${first}`,
    "",
    `Your BarberFlow account for ${input.businessName} is ready. ${planLine}`,
    "",
    `Sign in: ${input.loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.tempPassword}`,
    "",
    SECURITY_NOTE,
  ].join("\n");
  return { subject, html, text };
}

export function staffWelcome(input: {
  name: string;
  businessName: string;
  roleLabel: string;
  branchName?: string;
  loginUrl: string;
  email: string;
  tempPassword: string;
  mustChangePassword: boolean;
}): EmailContent {
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const where = input.branchName ? ` at ${input.branchName}` : "";
  const subject = `You've been added to ${input.businessName} on BarberFlow`;
  const note = input.mustChangePassword
    ? SECURITY_NOTE
    : "Keep this email safe, and don't share your password.";
  const html = shell({
    preheader: `Your ${input.roleLabel} login for ${input.businessName}`,
    heading: `Hi ${first}, your login is ready`,
    body: `<p style="margin:0 0 8px;">You've been added to <strong>${esc(input.businessName)}</strong> as ${esc(input.roleLabel)}${esc(where)}.</p>
${credentialBox([
  { label: "Email", value: input.email },
  { label: "Temporary password", value: input.tempPassword, mono: true },
])}
${button(input.loginUrl, "Sign in")}
<p style="margin:0;color:${MUTED};font-size:13px;">${esc(note)}</p>`,
    footer: `Button not working? Copy this link: ${esc(input.loginUrl)}`,
  });
  const text = [
    `Hi ${first}, your login is ready`,
    "",
    `You've been added to ${input.businessName} as ${input.roleLabel}${where}.`,
    "",
    `Sign in: ${input.loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.tempPassword}`,
    "",
    note,
  ].join("\n");
  return { subject, html, text };
}

export function receipt(input: ReceiptEmailInput): EmailContent {
  const subject = `Your receipt from ${input.shopName} (${input.receiptNo})`;

  const itemRows = input.items
    .map(
      (i) => `<tr><td style="padding:6px 0;font-size:14px;color:${INK};">${esc(i.name)}${i.quantity > 1 ? ` <span style="color:${MUTED};">× ${esc(i.quantity)}</span>` : ""}</td>
<td align="right" style="padding:6px 0;font-size:14px;color:${INK};white-space:nowrap;">${esc(money(i.total))}</td></tr>`,
    )
    .join("");

  const lines: { label: string; value: string; strong?: boolean }[] = [
    { label: "Subtotal", value: money(input.subtotal) },
  ];
  if (input.discount > 0) {
    lines.push({
      label: input.discountReason ? `Discount · ${input.discountReason}` : "Discount",
      value: `-${money(input.discount)}`,
    });
  }
  if (input.serviceCharge && input.serviceCharge > 0) {
    lines.push({
      label: `Service charge${input.serviceChargeRate ? ` (${input.serviceChargeRate}%)` : ""}`,
      value: money(input.serviceCharge),
    });
  }
  if (input.tax && input.tax > 0) {
    lines.push({
      label: `SST${input.taxRate ? ` (${input.taxRate}%)` : ""}`,
      value: money(input.tax),
    });
  }
  if (input.tip > 0) lines.push({ label: "Tip", value: money(input.tip) });
  lines.push({ label: "Total", value: money(input.total), strong: true });

  const totalRows = lines
    .map(
      (l) => `<tr><td style="padding:4px 0;font-size:${l.strong ? 16 : 13}px;color:${l.strong ? INK : MUTED};${l.strong ? "font-weight:700;" : ""}">${esc(l.label)}</td>
<td align="right" style="padding:4px 0;font-size:${l.strong ? 16 : 13}px;color:${l.strong ? GOLD : INK};${l.strong ? "font-weight:700;" : ""}">${esc(l.value)}</td></tr>`,
    )
    .join("");

  const paid = `${input.paymentLabel}${input.cardLast4 ? ` ····${input.cardLast4}` : ""}`;
  const shopLine = [input.address, input.phone].filter(Boolean).join(" · ");

  const html = shell({
    preheader: `${money(input.total)} · ${input.receiptNo}`,
    heading: "Thanks for visiting",
    body: `<p style="margin:0 0 4px;font-weight:700;">${esc(input.shopName)}</p>
${shopLine ? `<p style="margin:0 0 12px;font-size:13px;color:${MUTED};">${esc(shopLine)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;font-size:13px;color:${MUTED};">
<tr><td>Receipt ${esc(input.receiptNo)}</td><td align="right">${esc(input.dateLabel)}</td></tr>
<tr><td>${esc(input.customerName)}</td><td align="right">${input.barberName ? `Barber: ${esc(input.barberName)}` : ""}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};margin:0 0 10px;">${itemRows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totalRows}</table>
<p style="margin:14px 0 0;font-size:13px;color:${MUTED};">Paid by ${esc(paid)}</p>`,
    footer: `This is a receipt for a payment you made at ${esc(input.shopName)}. Replies to this email are not monitored.`,
  });

  const text = [
    input.shopName,
    shopLine,
    "",
    `Receipt ${input.receiptNo} · ${input.dateLabel}`,
    input.customerName,
    "",
    ...input.items.map(
      (i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}  ${money(i.total)}`,
    ),
    "",
    ...lines.map((l) => `${l.label}: ${l.value}`),
    "",
    `Paid by ${paid}`,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");

  return { subject, html, text };
}
