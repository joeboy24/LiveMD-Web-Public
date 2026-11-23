export type Letter = {
  subject: string;
  text: string;
  html: string;
};

const font = "'Segoe UI', 'Avenir Next', 'Trebuchet MS', sans-serif";

export function invitationLetter(orgName: string, role: string, url: string): Letter {
  const name = orgName.trim();
  const seat = role.trim();
  return {
    subject: `You're invited to ${name}`,
    text: `You're invited to ${name} on Live MD.\nYour seat: ${seat}\n\nTake your seat:\n${url}\n\nThis link expires in 15 minutes. If you were not expecting it, you can ignore this email.`,
    html: card({
      preheader: `Your ${seat} seat at ${name} is ready.`,
      eyebrow: "Invitation",
      title: `You're invited to ${name}`,
      detail: `A ${seat} seat is waiting for you on Live MD.`,
      action: "Take your seat",
      url,
    }),
  };
}

export function messageLetter(orgName: string, group: string, subject: string, body: string, from?: string): Letter {
  const name = orgName.trim();
  const room = group.trim();
  const who = from?.trim() ?? "";
  const line = who ? `${name} · ${who}` : `${name} · ${room}`;
  const paragraphs = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return {
    subject,
    text: `${line}\n\n${body}`,
    html: messageCard(line, subject, paragraphs),
  };
}

export function receiptLetter(input: {
  orgName: string;
  plan: string;
  seats: number;
  term: string;
  amount: string;
  discount: string | null;
  credit: string | null;
  accent: string;
}): Letter {
  const seats = input.seats === 1 ? "1 seat" : `${input.seats} seats`;
  const discount = input.discount ? `Discount ${input.discount}\n` : "";
  const credit = input.credit ? `Prorated credit −${input.credit}\n` : "";
  return {
    subject: `Receipt for ${input.plan}`,
    text: `Payment received for ${input.orgName}.\n${input.plan}\n${seats}\n${input.term}\n${input.amount}\n${discount}${credit}`,
    html: receiptCard(input, seats),
  };
}

export function systemAccountLetter(input: { name: string; email: string; role: string; password: string; url: string }): Letter {
  const role = input.role === "admin" ? "Admin" : "User";
  const note = "After you sign in, open Profile and update your password.";
  return {
    subject: "Your Live MD system account",
    text: `Your Live MD system account is ready.\n\nName: ${input.name}\nEmail: ${input.email}\nRole: ${role}\nPassword: ${input.password}\n\nSign in:\n${input.url}\n\n${note}`,
    html: card({
      preheader: "Your Live MD system account is ready.",
      eyebrow: "System",
      title: "Your system account",
      detail: "Use these details to sign in.",
      action: "Sign in",
      url: input.url,
      facts: [
        { label: "Name", value: input.name },
        { label: "Email", value: input.email },
        { label: "Role", value: role },
        { label: "Password", value: input.password },
      ],
      footer: note,
    }),
  };
}

export function signInLetter(url: string): Letter {
  return {
    subject: "Sign in to Live MD",
    text: `Sign in to Live MD:\n${url}\n\nThis link expires in 15 minutes. If you were not expecting it, you can ignore this email.`,
    html: card({
      preheader: "Your Live MD sign-in link is ready.",
      eyebrow: "Sign in",
      title: "Sign in to Live MD",
      detail: "Use the button below to open your account.",
      action: "Sign in",
      url,
    }),
  };
}

function card(letter: {
  preheader: string;
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  url: string;
  facts?: { label: string; value: string }[];
  footer?: string;
}) {
  const url = escapeHtml(letter.url);
  const facts = (letter.facts ?? [])
    .map(
      (fact) =>
        `<tr><td class="muted" style="padding:8px 0 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5C656E;">${escapeHtml(fact.label)}</td></tr><tr><td class="ink" style="padding:2px 0 0;font-size:15px;line-height:22px;color:#0B1116;">${escapeHtml(fact.value)}</td></tr>`,
    )
    .join("");
  const footer = letter.footer ?? "This link expires in 15 minutes. If you were not expecting it, you can ignore this email.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(letter.title)}</title>
<style>
  :root { color-scheme: light dark; }
  a { text-decoration: none; }
  @media (prefers-color-scheme: dark) {
    .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
    .card { background: #151D24 !important; background-color: #151D24 !important; }
    .wordmark { color: #38A7E2 !important; }
    .muted { color: #9A9DA1 !important; }
    .ink { color: #EBEBEA !important; }
    .url { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
  }
  .theme-dark .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
  .theme-dark .card { background: #151D24 !important; background-color: #151D24 !important; }
  .theme-dark .wordmark { color: #38A7E2 !important; }
  .theme-dark .muted { color: #9A9DA1 !important; }
  .theme-dark .ink { color: #EBEBEA !important; }
  .theme-dark .url { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
  .theme-light .page { background: #F3F5F7 !important; background-color: #F3F5F7 !important; color: #0B1116 !important; }
  .theme-light .card { background: #FFFFFF !important; background-color: #FFFFFF !important; }
  .theme-light .wordmark { color: #076FBF !important; }
  .theme-light .muted { color: #5C656E !important; }
  .theme-light .ink { color: #0B1116 !important; }
  .theme-light .url { background: #F3F5F7 !important; background-color: #F3F5F7 !important; color: #0B1116 !important; }
  .button, .button a { background: #076FBF !important; background-color: #076FBF !important; color: #EBEBEA !important; border-radius: 14px !important; }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#F3F5F7;color:#0B1116;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(letter.preheader)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F5F7" style="background:#F3F5F7;">
  <tr>
    <td class="page" align="center" bgcolor="#F3F5F7" style="padding:40px 16px;background:#F3F5F7;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td class="wordmark" style="padding:0 4px 16px;font-family:${font};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.22em;color:#076FBF;">LIVE MD</td>
        </tr>
        <tr>
          <td height="4" bgcolor="#25C290" style="height:4px;background:#25C290;border-radius:18px 18px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:32px 36px 28px;font-family:${font};">
            <p class="muted" style="margin:0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#5C656E;">${escapeHtml(letter.eyebrow)}</p>
            <h1 class="ink" style="margin:14px 0 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.02em;color:#0B1116;">${escapeHtml(letter.title)}</h1>
            <p class="muted" style="margin:14px 0 0;font-size:15px;line-height:24px;color:#5C656E;">${escapeHtml(letter.detail)}</p>
            ${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">${facts}</table>` : ""}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td class="button" bgcolor="#076FBF" style="background:#076FBF;border-radius:14px;">
                  <a href="${url}" style="display:inline-block;padding:12px 22px;font-family:${font};font-size:15px;line-height:20px;font-weight:700;color:#EBEBEA;text-decoration:none;border-radius:14px;">${escapeHtml(letter.action)}</a>
                </td>
              </tr>
            </table>
            <p class="muted" style="margin:28px 0 0;font-size:12px;line-height:18px;color:#5C656E;">If the button does not open, copy this link into your browser.</p>
            <p class="url" style="margin:8px 0 0;padding:12px 14px;background:#F3F5F7;border-radius:10px;font-size:12px;line-height:18px;color:#0B1116;word-break:break-all;">${url}</p>
          </td>
        </tr>
        <tr>
          <td class="muted" style="padding:16px 4px 0;font-family:${font};font-size:12px;line-height:18px;color:#5C656E;">${escapeHtml(footer)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function messageCard(line: string, subject: string, paragraphs: string[]) {
  const body = paragraphs
    .map((paragraph) => `<p class="ink" style="margin:16px 0 0;font-size:15px;line-height:24px;color:#0B1116;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
  :root { color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
    .card { background: #151D24 !important; background-color: #151D24 !important; }
    .wordmark { color: #38A7E2 !important; }
    .muted { color: #9A9DA1 !important; }
    .ink { color: #EBEBEA !important; }
  }
  .theme-dark .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
  .theme-dark .card { background: #151D24 !important; background-color: #151D24 !important; }
  .theme-dark .wordmark { color: #38A7E2 !important; }
  .theme-dark .muted { color: #9A9DA1 !important; }
  .theme-dark .ink { color: #EBEBEA !important; }
  .theme-light .page { background: #F3F5F7 !important; background-color: #F3F5F7 !important; color: #0B1116 !important; }
  .theme-light .card { background: #FFFFFF !important; background-color: #FFFFFF !important; }
  .theme-light .wordmark { color: #076FBF !important; }
  .theme-light .muted { color: #5C656E !important; }
  .theme-light .ink { color: #0B1116 !important; }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#F3F5F7;color:#0B1116;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(paragraphs[0] ?? subject)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F5F7" style="background:#F3F5F7;">
  <tr>
    <td class="page" align="center" bgcolor="#F3F5F7" style="padding:40px 16px;background:#F3F5F7;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td class="wordmark" style="padding:0 4px 16px;font-family:${font};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.22em;color:#076FBF;">LIVE MD</td>
        </tr>
        <tr>
          <td height="4" bgcolor="#25C290" style="height:4px;background:#25C290;border-radius:18px 18px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:32px 36px 28px;font-family:${font};">
            <p class="muted" style="margin:0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#5C656E;">${escapeHtml(line)}</p>
            <h1 class="ink" style="margin:14px 0 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.02em;color:#0B1116;">${escapeHtml(subject)}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td class="muted" style="padding:16px 4px 0;font-family:${font};font-size:12px;line-height:18px;color:#5C656E;">Sent from Live MD.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function receiptCard(
  input: { orgName: string; plan: string; term: string; amount: string; discount: string | null; credit: string | null; accent: string },
  seats: string,
) {
  const rows = [
    ["Plan", input.plan],
    ["Seats", seats],
    ["Term", input.term],
    ...(input.discount ? [["Discount", input.discount]] : []),
    ...(input.credit ? [["Prorated credit", `−${input.credit}`]] : []),
    ["Total", input.amount],
  ];
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td class="muted" style="padding:8px 0;font-size:13px;line-height:18px;color:#5C656E;">${escapeHtml(label)}</td><td class="ink" align="right" style="padding:8px 0;font-size:15px;line-height:20px;font-weight:700;color:#0B1116;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Receipt for ${escapeHtml(input.plan)}</title>
<style>
  :root { color-scheme: light dark; }
  a { text-decoration: none; }
  @media (prefers-color-scheme: dark) {
    .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
    .card { background: #151D24 !important; background-color: #151D24 !important; }
    .wordmark { color: #38A7E2 !important; }
    .muted { color: #9A9DA1 !important; }
    .ink { color: #EBEBEA !important; }
  }
  .theme-dark .page { background: #0B1116 !important; background-color: #0B1116 !important; color: #EBEBEA !important; }
  .theme-dark .card { background: #151D24 !important; background-color: #151D24 !important; }
  .theme-dark .wordmark { color: #38A7E2 !important; }
  .theme-dark .muted { color: #9A9DA1 !important; }
  .theme-dark .ink { color: #EBEBEA !important; }
  .theme-light .page { background: #F3F5F7 !important; background-color: #F3F5F7 !important; color: #0B1116 !important; }
  .theme-light .card { background: #FFFFFF !important; background-color: #FFFFFF !important; }
  .theme-light .wordmark { color: #076FBF !important; }
  .theme-light .muted { color: #5C656E !important; }
  .theme-light .ink { color: #0B1116 !important; }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#F3F5F7;color:#0B1116;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Payment received for ${escapeHtml(input.plan)}.</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F5F7" style="background:#F3F5F7;">
  <tr>
    <td class="page" align="center" bgcolor="#F3F5F7" style="padding:40px 16px;background:#F3F5F7;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td class="wordmark" style="padding:0 4px 16px;font-family:${font};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.22em;color:#076FBF;">LIVE MD</td>
        </tr>
        <tr>
          <td height="4" bgcolor="${escapeHtml(input.accent)}" style="height:4px;background:${escapeHtml(input.accent)};border-radius:18px 18px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:32px 36px 28px;font-family:${font};">
            <p class="muted" style="margin:0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#5C656E;">Receipt · ${escapeHtml(input.orgName)}</p>
            <h1 class="ink" style="margin:14px 0 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.02em;color:#0B1116;">Payment received</h1>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #E4E9EE;">${body}</table>
          </td>
        </tr>
        <tr>
          <td class="muted" style="padding:16px 4px 0;font-family:${font};font-size:12px;line-height:18px;color:#5C656E;">This receipt is for your Live MD plan.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
