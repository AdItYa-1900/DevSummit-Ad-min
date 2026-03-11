var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);

// api/admin-action.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_resend = require("resend");

// api/ticketPdf.ts
var import_jspdf = require("jspdf");
var GState = (doc) => doc.GState;
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [100, 100, 100];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}
function darken(r, g, b, amt) {
  return [Math.max(0, r - amt), Math.max(0, g - amt), Math.max(0, b - amt)];
}
function lighten(r, g, b, amt) {
  return [Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt)];
}
function generateTicketId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DS3-${id}`;
}
async function loadAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
async function generateTicketPDF(data) {
  const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  const W = 280;
  const H = 140;
  const doc = new import_jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });
  const [cr, cg, cb] = hexToRgb(data.themeColor);
  const [dr, dg, db] = darken(cr, cg, cb, 40);
  const [lr, lg, lb] = lighten(cr, cg, cb, 60);
  const ticketId = generateTicketId();
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const bambooVertUrl = `${siteUrl}/bamboo-stalk.png`;
  const bambooHorizUrl = `${siteUrl}/bamboo-horizontal.png`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=121218&color=ffffff&data=${encodeURIComponent(ticketId)}`;
  const [logoB64, gdgB64, charB64, bambooVertB64, bambooHorizB64, qrB64] = await Promise.all([
    loadAsBase64(data.logoUrl),
    loadAsBase64(data.gdgLogoUrl),
    loadAsBase64(data.characterUrl),
    loadAsBase64(bambooVertUrl),
    loadAsBase64(bambooHorizUrl),
    loadAsBase64(qrUrl)
  ]);
  const titleFont = "helvetica";
  const bodyFont = "helvetica";
  doc.setFillColor(18, 18, 24);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(24, 24, 32);
  doc.roundedRect(3, 3, W - 6, H - 6, 4, 4, "F");
  doc.setGState(new (GState(doc))({ opacity: 0.22 }));
  if (bambooVertB64) {
    try {
      doc.addImage(bambooVertB64, "PNG", 1, 2, 12, H - 4, void 0, "FAST");
      doc.addImage(bambooVertB64, "PNG", W - 13, 2, 12, H - 4, void 0, "FAST");
    } catch {
    }
  }
  if (bambooHorizB64) {
    try {
      doc.addImage(bambooHorizB64, "PNG", 10, 0, W - 20, 10, void 0, "FAST");
      doc.addImage(bambooHorizB64, "PNG", 10, H - 10, W - 20, 10, void 0, "FAST");
    } catch {
    }
  }
  doc.setGState(new (GState(doc))({ opacity: 1 }));
  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.8);
  doc.roundedRect(5, 5, W - 10, H - 10, 3, 3, "S");
  doc.setDrawColor(dr, dg, db);
  doc.setLineWidth(0.3);
  doc.roundedRect(8, 8, W - 16, H - 16, 2, 2, "S");
  doc.setFillColor(cr, cg, cb);
  doc.rect(9, 9, W - 18, 26, "F");
  doc.setFillColor(dr, dg, db);
  doc.rect(9, 32, W - 18, 3, "F");
  const gdgLogoH = 18;
  const gdgLogoW = gdgLogoH * 2;
  if (gdgB64) {
    try {
      const gdgY = 9 + (26 - gdgLogoH) / 2 - 26 * 0.05;
      doc.addImage(gdgB64, "PNG", 12, gdgY, gdgLogoW, gdgLogoH, void 0, "FAST");
    } catch {
    }
  }
  const dsLogoH = 22;
  const dsLogoW = dsLogoH * 1.5;
  if (logoB64) {
    try {
      const dsX = (W - dsLogoW) / 2;
      const dsY = 9 + (26 - dsLogoH) / 2;
      doc.addImage(logoB64, "PNG", dsX, dsY, dsLogoW, dsLogoH, void 0, "FAST");
    } catch {
    }
  }
  doc.setFont(titleFont, "normal");
  doc.setFontSize(13.8);
  doc.setTextColor(255, 255, 255);
  doc.text(ticketId, W - 15, 20, { align: "right" });
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(8.6);
  doc.text(`${dateStr}  |  ${timeStr}`, W - 15, 28, { align: "right" });
  const charAreaX = W - 78;
  const charAreaY = 36;
  const charAreaH = H - 46;
  const charImgW = 64;
  const charCenterX = charAreaX + charImgW / 2;
  const charCenterY = charAreaY + charAreaH / 2;
  doc.setFillColor(cr, cg, cb);
  doc.setGState(new (GState(doc))({ opacity: 0.07 }));
  doc.circle(charCenterX, charCenterY, 48, "F");
  doc.setGState(new (GState(doc))({ opacity: 0.12 }));
  doc.circle(charCenterX, charCenterY, 34, "F");
  doc.setGState(new (GState(doc))({ opacity: 0.18 }));
  doc.circle(charCenterX, charCenterY, 20, "F");
  doc.setGState(new (GState(doc))({ opacity: 1 }));
  if (charB64) {
    try {
      doc.addImage(charB64, "PNG", charAreaX, charAreaY, charImgW, charAreaH, void 0, "FAST");
    } catch {
    }
  }
  doc.setFont(titleFont, "normal");
  doc.setFontSize(21.8);
  doc.setTextColor(255, Math.min(255, cg + 150), Math.min(120, cb + 50));
  doc.text(data.eventTitle, 14, 46);
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(9.8);
  doc.setTextColor(Math.min(255, lr + 30), Math.min(255, lg + 30), Math.min(255, lb + 30));
  doc.text(`"${data.eventSubtitle}"`, 14, 52);
  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.5);
  doc.line(14, 54, 95, 54);
  doc.setDrawColor(dr, dg, db);
  doc.setLineWidth(0.2);
  doc.line(14, 55, 75, 55);
  const col1 = 14;
  const col2 = 74;
  const col3 = 138;
  let y = 62;
  const drawField = (label, value, x, yPos, maxWidth) => {
    doc.setFont(bodyFont, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20));
    doc.text(label.toUpperCase(), x, yPos);
    doc.setFont(titleFont, "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const mw = maxWidth || 55;
    const maxChars = Math.floor(mw / 2);
    const display = value.length > maxChars ? value.slice(0, maxChars - 1) + "\u2026" : value;
    doc.text(display, x, yPos + 5.5);
  };
  drawField("NAME", data.name, col1, y);
  drawField("TEAM", data.teamName, col2, y);
  drawField("PARTICIPANTS", String(data.participantsCount), col3, y);
  y += 15;
  drawField("EMAIL", data.email, col1, y, 55);
  drawField("COLLEGE", data.college, col2, y, 55);
  drawField("PHONE", data.phone, col3, y);
  y += 15;
  const contentRight = charAreaX - 8;
  doc.setDrawColor(60, 60, 72);
  doc.setLineWidth(0.3);
  doc.line(14, y + 2, contentRight, y + 2);
  const bottomY = y + 6;
  const qrSize = 24;
  const qrBorderPad = 1.2;
  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.6);
  doc.rect(col1 - qrBorderPad, bottomY - qrBorderPad, qrSize + qrBorderPad * 2, qrSize + qrBorderPad * 2, "S");
  if (qrB64) {
    try {
      doc.addImage(qrB64, "PNG", col1, bottomY, qrSize, qrSize, void 0, "FAST");
    } catch {
    }
  }
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(7);
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20));
  doc.text("Scan to verify", col1 + qrSize / 2, bottomY + qrSize + 4, { align: "center" });
  const infoX = col1 + qrSize + 8;
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20));
  doc.text("TRANSACTION ID", infoX, bottomY + 2);
  doc.setFont(titleFont, "normal");
  doc.setFontSize(10.4);
  doc.setTextColor(255, 255, 255);
  doc.text(data.transactionId, infoX, bottomY + 8);
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20));
  doc.text("VENUE", infoX, bottomY + 15);
  doc.setFont(titleFont, "normal");
  doc.setFontSize(10.4);
  doc.setTextColor(255, 255, 255);
  doc.text("Silicon Institute of Technology", infoX, bottomY + 21);
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20));
  doc.text("DATE & TIME", col3, bottomY + 2);
  doc.setFont(titleFont, "normal");
  doc.setFontSize(10.4);
  doc.setTextColor(255, 255, 255);
  doc.text(`${dateStr}  ${timeStr}`, col3, bottomY + 8);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// api/admin-action.ts
function getEventMeta(slug, siteUrl) {
  const events = {
    "web-hunt": {
      title: "WEB HUNT",
      subtitle: "Seek and You Shall Find",
      themeColor: "#d4a373",
      characterImage: `${siteUrl}/Kai.png`
    },
    "capture-the-flag": {
      title: "CAPTURE THE FLAG",
      subtitle: "Defend and Conquer",
      themeColor: "#a34a4a",
      characterImage: `${siteUrl}/taiLung-sm.png`
    },
    "web-atelier": {
      title: "WEB ATELIER",
      subtitle: "Craft the Web. Earn the Scroll.",
      themeColor: "#9baaa6",
      characterImage: `${siteUrl}/lordShen-sm.png`
    },
    "agentic-ai": {
      title: "AGENTIC AI",
      subtitle: "Automate the Future",
      themeColor: "#7b72a8",
      characterImage: `${siteUrl}/Chameleon-sm.png`
    }
  };
  return events[slug] ?? null;
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const adminPassword = process.env.VITE_ADMIN_PASSWORD;
  const providedPassword = req.headers["x-admin-password"];
  if (!adminPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const { action, registrationId } = req.body;
  if (!action || !registrationId) {
    return res.status(400).json({ error: "Missing action or registrationId" });
  }
  const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseServiceKey);
  try {
    if (action === "accept") {
      const { data: registration, error: regError } = await supabase.from("registrations").select("*, events(id, slug, fee)").eq("id", registrationId).single();
      if (regError || !registration) {
        return res.status(404).json({ error: "Registration not found" });
      }
      if (registration.verified === true) {
        return res.status(400).json({ error: "Already verified" });
      }
      const { error: updateError } = await supabase.from("registrations").update({ verified: true }).eq("id", registrationId);
      if (updateError) {
        return res.status(500).json({ error: "Failed to update registration", details: updateError.message });
      }
      const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
      const eventSlug = registration.events?.slug;
      const eventMeta = eventSlug ? getEventMeta(eventSlug, siteUrl) : null;
      if (!eventMeta) {
        return res.status(200).json({ message: "Verified but could not send ticket \u2014 unknown event" });
      }
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return res.status(200).json({ message: "Verified but email service not configured" });
      }
      const ticketData = {
        eventTitle: eventMeta.title,
        eventSubtitle: eventMeta.subtitle,
        themeColor: eventMeta.themeColor,
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        college: registration.college,
        teamName: registration.team_name,
        participantsCount: registration.participants_count,
        transactionId: registration.transaction_id,
        logoUrl: `${siteUrl}/title-sm.png`,
        characterUrl: eventMeta.characterImage,
        gdgLogoUrl: `${siteUrl}/gdg.png`
      };
      const pdfBuffer = await generateTicketPDF(ticketData);
      const resend = new import_resend.Resend(resendApiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "DevSummit <tickets@devsummit.dev>";
      const filename = `DevSummit3-${ticketData.eventTitle.replace(/\s+/g, "-")}-Ticket.pdf`;
      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: ticketData.email,
        subject: `\u{1F409} The Dragon Scroll Awaits \u2014 ${ticketData.eventTitle} | DevSummit 3.0`,
        html: buildAcceptEmailHtml(ticketData, eventMeta),
        attachments: [{ filename, content: pdfBuffer.toString("base64") }]
      });
      if (emailError) {
        console.error("[admin-action] Email error:", emailError);
        return res.status(200).json({ message: "Verified but email failed", emailError: emailError.message });
      }
      return res.status(200).json({ message: "Registration accepted and ticket sent" });
    }
    if (action === "reject") {
      const { data: registration, error: regError } = await supabase.from("registrations").select("*, events(id, slug)").eq("id", registrationId).single();
      if (regError || !registration) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const { error: updateError } = await supabase.from("registrations").update({ rejected: true }).eq("id", registrationId);
      if (updateError) {
        return res.status(500).json({ error: "Failed to reject registration", details: updateError.message });
      }
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const eventSlug = registration.events?.slug;
        const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
        const eventMeta = eventSlug ? getEventMeta(eventSlug, siteUrl) : null;
        const themeColor = eventMeta?.themeColor || "#d4a373";
        const eventTitle = eventMeta?.title || "DevSummit Event";
        const resend = new import_resend.Resend(resendApiKey);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "DevSummit <tickets@devsummit.dev>";
        await resend.emails.send({
          from: fromEmail,
          to: registration.email,
          subject: `Registration Update \u2014 ${eventTitle} | DevSummit 3.0`,
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
              <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${themeColor}, #2d5a27);"></div>
              <div style="padding: 32px;">
                <div style="text-align: center; margin-bottom: 28px;">
                  <h1 style="color: ${themeColor}; margin: 0; font-size: 26px;">DevSummit 3.0</h1>
                </div>
                <div style="background: #14141e; border: 1px solid ${themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
                  <p style="color: #ccc; font-size: 15px;">
                    Dear <strong style="color: ${themeColor};">${registration.name}</strong>,
                  </p>
                  <p style="color: #ccc; font-size: 14px;">
                    We regret to inform you that your registration for <strong>${eventTitle}</strong> could not be verified. This may be due to a payment issue.
                  </p>
                  <p style="color: #ccc; font-size: 14px;">
                    Please re-register with a valid payment, or contact us if you believe this is an error.
                  </p>
                </div>
                <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
                  <p style="margin: 0;">Silicon Institute of Technology \xB7 GDG on Campus SIT \xB7 DevSummit 3.0</p>
                </div>
              </div>
              <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${themeColor}, #2d5a27);"></div>
            </div>
          `
        }).catch((err) => console.error("[admin-action] Rejection email error:", err));
      }
      return res.status(200).json({ message: "Registration rejected" });
    }
    if (action === "undo-reject") {
      const { error: updateError } = await supabase.from("registrations").update({ rejected: false }).eq("id", registrationId);
      if (updateError) {
        return res.status(500).json({ error: "Failed to undo rejection", details: updateError.message });
      }
      return res.status(200).json({ message: "Rejection undone \u2014 registration is pending again" });
    }
    if (action === "delete") {
      const { error: deleteError } = await supabase.from("registrations").delete().eq("id", registrationId);
      if (deleteError) {
        return res.status(500).json({ error: "Failed to delete registration", details: deleteError.message });
      }
      return res.status(200).json({ message: "Registration permanently deleted" });
    }
    return res.status(400).json({ error: 'Unknown action. Use "accept", "reject", "undo-reject", or "delete".' });
  } catch (err) {
    console.error("[admin-action] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
function buildAcceptEmailHtml(data, eventMeta) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${data.themeColor}, #2d5a27);"></div>
      <div style="padding: 32px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Jade Palace Has Spoken</p>
          <h1 style="color: ${data.themeColor}; margin: 0; font-size: 30px; letter-spacing: 1px;">DevSummit 3.0</h1>
          <p style="color: #4ade80; margin: 10px 0 0; font-size: 14px; font-weight: 600;">\u2726 Your tribute has been accepted! \u2726</p>
        </div>
        <div style="background: #14141e; border: 1px solid ${data.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="color: ${data.themeColor}; margin: 0 0 4px; font-size: 22px;">${eventMeta.title}</h2>
          <p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${eventMeta.subtitle}"</p>
          <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
            Warrior <strong style="color: ${data.themeColor};">${data.name}</strong>, the masters have verified your tribute. You are now chosen for battle! \u{1F94B}
          </p>
          <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
            <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${data.name}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${data.teamName}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${data.college}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${data.participantsCount}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${data.transactionId}</td></tr>
            </table>
          </div>
        </div>
        <div style="background: #0f1a10; border: 1px solid #4ade8033; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="color: #4ade80; margin: 0 0 6px; font-size: 14px; font-weight: 600;">\u{1F3AB} Your Ticket Is Attached!</p>
          <p style="color: #6b8f71; margin: 0; font-size: 13px;">Download and keep the attached PDF. Present it at the venue.</p>
        </div>
        <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
          <p style="margin: 0;">Silicon Institute of Technology \xB7 GDG on Campus SIT \xB7 DevSummit 3.0</p>
        </div>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${data.themeColor}, #2d5a27);"></div>
    </div>
  `;
}

// api/get-registrations.ts
var import_supabase_js2 = require("@supabase/supabase-js");
async function handler2(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const adminPassword = process.env.VITE_ADMIN_PASSWORD;
  const providedPassword = req.headers["x-admin-password"];
  if (!adminPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey);
  try {
    const [eventsResult, regsResult] = await Promise.all([
      supabase.from("events").select("id, title, slug"),
      supabase.from("registrations").select("*").order("created_at", { ascending: false })
    ]);
    if (regsResult.error) {
      return res.status(500).json({ error: regsResult.error.message });
    }
    return res.status(200).json({
      events: eventsResult.data || [],
      registrations: regsResult.data || []
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

// api/export-registrations.ts
var import_supabase_js3 = require("@supabase/supabase-js");
var import_jspdf2 = require("jspdf");
async function handler3(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const adminPassword = process.env.VITE_ADMIN_PASSWORD;
  const providedPassword = req.headers["x-admin-password"];
  if (!adminPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const { eventId } = req.body;
  const supabase = (0, import_supabase_js3.createClient)(supabaseUrl, supabaseServiceKey);
  try {
    const { data: events } = await supabase.from("events").select("id, title, slug");
    const eventMap = {};
    if (events) {
      for (const e of events) {
        eventMap[e.id] = e.title;
      }
    }
    let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });
    if (eventId) {
      query = query.eq("event_id", eventId);
    }
    const { data: registrations, error: regError } = await query;
    if (regError) {
      return res.status(500).json({ error: regError.message });
    }
    const rows = registrations || [];
    const eventTitle = eventId ? eventMap[eventId] || "Event" : "All Events";
    const doc = new import_jspdf2.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;
    const margin = 10;
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`DevSummit 3.0 \u2014 ${eventTitle} Registrations`, margin, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleString("en-IN")}  |  Total: ${rows.length}`, margin, 25);
    const headers = ["#", "Name", "Email", "Phone", "College", "Team", "Count", "Txn ID", "Verified", "Date"];
    const colWidths = [8, 30, 50, 28, 40, 30, 12, 35, 16, 28];
    let y = 32;
    const drawHeader = () => {
      doc.setFillColor(50, 50, 60);
      doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      let x = margin + 1;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, y);
        x += colWidths[i];
      }
      y += 5;
    };
    drawHeader();
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7);
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      if (y > 195) {
        doc.addPage();
        y = 15;
        drawHeader();
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(7);
      }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 248);
        doc.rect(margin, y - 3.5, pageW - margin * 2, 6, "F");
      }
      let x = margin + 1;
      const values = [
        String(idx + 1),
        truncate(String(r.name || ""), 20),
        truncate(String(r.email || ""), 32),
        String(r.phone || ""),
        truncate(String(r.college || ""), 26),
        truncate(String(r.team_name || "-"), 18),
        String(r.participants_count || ""),
        truncate(String(r.transaction_id || "-"), 22),
        r.verified ? "Yes" : "No",
        r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "-"
      ];
      for (let i = 0; i < values.length; i++) {
        doc.text(values[i], x, y);
        x += colWidths[i];
      }
      y += 6;
    }
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Registration Summary", margin, 18);
    doc.setFontSize(11);
    let sy = 30;
    doc.text(`Total Registrations: ${rows.length}`, margin, sy);
    sy += 8;
    doc.text(`Verified: ${rows.filter((r) => r.verified).length}`, margin, sy);
    sy += 8;
    doc.text(`Pending: ${rows.filter((r) => !r.verified).length}`, margin, sy);
    sy += 14;
    if (!eventId) {
      doc.setFontSize(13);
      doc.text("By Event:", margin, sy);
      sy += 8;
      doc.setFontSize(10);
      const byEvent = /* @__PURE__ */ new Map();
      for (const r of rows) {
        const label = eventMap[r.event_id] || r.event_id;
        byEvent.set(label, (byEvent.get(label) || 0) + 1);
      }
      for (const [label, count] of byEvent.entries()) {
        doc.text(`  ${label}: ${count}`, margin, sy);
        sy += 7;
      }
      sy += 7;
    }
    doc.setFontSize(13);
    doc.text("By College:", margin, sy);
    sy += 8;
    doc.setFontSize(10);
    const byCollege = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const key = (r.college || "Unknown").trim();
      byCollege.set(key, (byCollege.get(key) || 0) + 1);
    }
    const sortedColleges = Array.from(byCollege.entries()).sort((a, b) => b[1] - a[1]);
    for (const [label, count] of sortedColleges) {
      if (sy > 195) {
        doc.addPage();
        sy = 15;
      }
      doc.text(`  ${label}: ${count}`, margin, sy);
      sy += 7;
    }
    const pdfOutput = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfOutput);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="DevSummit3-${eventTitle.replace(/\s+/g, "-")}-Registrations.pdf"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("[export-pdf] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

// api/send-ticket.ts
var import_supabase_js4 = require("@supabase/supabase-js");
var import_resend2 = require("resend");
function getEventMeta2(slug, siteUrl, _cloudinaryBase) {
  const events = {
    "web-hunt": {
      title: "WEB HUNT",
      subtitle: "Seek and You Shall Find",
      themeColor: "#d4a373",
      characterImage: `${siteUrl}/Kai.png`
    },
    "capture-the-flag": {
      title: "CAPTURE THE FLAG",
      subtitle: "Defend and Conquer",
      themeColor: "#a34a4a",
      characterImage: `${siteUrl}/taiLung-sm.png`
    },
    "web-atelier": {
      title: "WEB ATELIER",
      subtitle: "Craft the Web. Earn the Scroll.",
      themeColor: "#9baaa6",
      characterImage: `${siteUrl}/lordShen-sm.png`
    },
    "agentic-ai": {
      title: "AGENTIC AI",
      subtitle: "Automate the Future",
      themeColor: "#7b72a8",
      characterImage: `${siteUrl}/Chameleon-sm.png`
    }
  };
  return events[slug] ?? null;
}
async function handler4(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers["x-webhook-secret"] ?? req.headers["authorization"];
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error("[send-ticket] Unauthorized webhook call");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[send-ticket] RESEND_API_KEY not configured");
    return res.status(500).json({ error: "Email service not configured" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[send-ticket] Supabase credentials not configured");
    return res.status(500).json({ error: "Database not configured" });
  }
  const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  const cloudinaryBase = process.env.CLOUDINARY_BASE || "";
  try {
    const payload = req.body;
    if (payload.type !== "UPDATE" || payload.table !== "registrations") {
      console.log(`[send-ticket] Ignoring ${payload.type} on ${payload.table}`);
      return res.status(200).json({ message: "Ignored \u2014 not a registration update" });
    }
    const newRecord = payload.record;
    const oldRecord = payload.old_record;
    if (newRecord.verified !== true || oldRecord.verified === true) {
      console.log("[send-ticket] Ignoring \u2014 verified not changed to true");
      return res.status(200).json({ message: "Ignored \u2014 not a verification change" });
    }
    const registrationId = newRecord.id;
    console.log(`[send-ticket] Processing verification for registration ${registrationId}`);
    const supabase = (0, import_supabase_js4.createClient)(supabaseUrl, supabaseServiceKey);
    const { data: registration, error: regError } = await supabase.from("registrations").select("*, events(id, slug, fee)").eq("id", registrationId).single();
    if (regError || !registration) {
      console.error("[send-ticket] Failed to fetch registration:", regError?.message);
      return res.status(404).json({ error: "Registration not found" });
    }
    const eventSlug = registration.events?.slug;
    if (!eventSlug) {
      console.error("[send-ticket] No event slug found for registration", registrationId);
      return res.status(400).json({ error: "Event not found for registration" });
    }
    const eventMeta = getEventMeta2(eventSlug, siteUrl, cloudinaryBase);
    if (!eventMeta) {
      console.error("[send-ticket] Unknown event slug:", eventSlug);
      return res.status(400).json({ error: `Unknown event: ${eventSlug}` });
    }
    const ticketData = {
      eventTitle: eventMeta.title,
      eventSubtitle: eventMeta.subtitle,
      themeColor: eventMeta.themeColor,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      college: registration.college,
      teamName: registration.team_name,
      participantsCount: registration.participants_count,
      transactionId: registration.transaction_id,
      logoUrl: `${siteUrl}/title-sm.png`,
      characterUrl: eventMeta.characterImage,
      gdgLogoUrl: `${siteUrl}/gdg.png`
    };
    console.log(`[send-ticket] Generating PDF for ${ticketData.name} \u2014 ${ticketData.eventTitle}`);
    const pdfBuffer = await generateTicketPDF(ticketData);
    const resend = new import_resend2.Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "DevSummit <tickets@devsummit.dev>";
    const filename = `DevSummit3-${ticketData.eventTitle.replace(/\s+/g, "-")}-Ticket.pdf`;
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: ticketData.email,
      subject: `\u{1F409} The Dragon Scroll Awaits \u2014 ${ticketData.eventTitle} | DevSummit 3.0`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Top bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${ticketData.themeColor}, #2d5a27);"></div>

          <div style="padding: 32px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 28px;">
              <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Jade Palace Has Spoken</p>
              <h1 style="color: ${ticketData.themeColor}; margin: 0; font-size: 30px; letter-spacing: 1px;">DevSummit 3.0</h1>
              <p style="color: #4ade80; margin: 10px 0 0; font-size: 14px; font-weight: 600;">\u2726 Your tribute has been accepted! \u2726</p>
            </div>

            <!-- Scroll-style event card -->
            <div style="background: #14141e; border: 1px solid ${ticketData.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px; position: relative;">
              <div style="position: absolute; top: -1px; left: 20px; right: 20px; height: 2px; background: ${ticketData.themeColor}; opacity: 0.4;"></div>

              <h2 style="color: ${ticketData.themeColor}; margin: 0 0 4px; font-size: 22px; letter-spacing: 1px;">${ticketData.eventTitle}</h2>
              <p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${ticketData.eventSubtitle}"</p>

              <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
                Warrior <strong style="color: ${ticketData.themeColor};">${ticketData.name}</strong>, the masters have verified your tribute. You are now chosen for battle! \u{1F94B}
              </p>

              <!-- Details table with bamboo-style left border -->
              <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
                <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${ticketData.name}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${ticketData.teamName}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${ticketData.college}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${ticketData.participantsCount}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${ticketData.transactionId}</td></tr>
                </table>
              </div>
            </div>

            <!-- Ticket attachment banner -->
            <div style="background: #101a12; border: 1px solid #2d5a2744; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <p style="color: #4ade80; margin: 0 0 6px; font-size: 15px; font-weight: 600;">\u{1F409} Your Dragon Scroll Is Attached</p>
              <p style="color: #7a9a7e; margin: 0; font-size: 13px;">Carry this sacred scroll (digital or printed) to the arena on the day of battle.</p>
            </div>

            <!-- Shifu quote -->
            <div style="text-align: center; padding: 12px 20px; margin-bottom: 16px;">
              <p style="color: #6b8f71; margin: 0; font-size: 12px; font-style: italic;">"If you only do what you can do, you will never be more than you are now."</p>
              <p style="color: #4a6b4e; margin: 6px 0 0; font-size: 10px;">\u2014 Master Shifu</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
              <p style="margin: 0;">Silicon Institute of Technology \xB7 GDG on Campus SIT \xB7 DevSummit 3.0</p>
            </div>
          </div>

          <!-- Bottom bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${ticketData.themeColor}, #2d5a27);"></div>
        </div>
      `,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString("base64"),
          contentType: "application/pdf"
        }
      ]
    });
    if (emailError) {
      console.error("[send-ticket] Resend error:", emailError);
      return res.status(500).json({ error: "Failed to send email", details: emailError.message });
    }
    console.log(`[send-ticket] Ticket email sent to ${ticketData.email}`);
    return res.status(200).json({ message: "Ticket sent", email: ticketData.email });
  } catch (err) {
    console.error("[send-ticket] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}

// api/confirm-registration.ts
var import_resend3 = require("resend");
var EVENT_META = {
  "web-hunt": { title: "WEB HUNT", subtitle: "Seek and You Shall Find", themeColor: "#d4a373" },
  "capture-the-flag": { title: "CAPTURE THE FLAG", subtitle: "Defend and Conquer", themeColor: "#a34a4a" },
  "web-atelier": { title: "WEB ATELIER", subtitle: "Craft the Web. Earn the Scroll.", themeColor: "#9baaa6" },
  "agentic-ai": { title: "AGENTIC AI", subtitle: "Automate the Future", themeColor: "#7b72a8" }
};
async function handler5(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers["x-webhook-secret"] ?? req.headers["authorization"];
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[confirm-reg] RESEND_API_KEY not configured");
    return res.status(500).json({ error: "Email service not configured" });
  }
  try {
    const payload = req.body;
    if (payload.type !== "INSERT" || payload.table !== "registrations") {
      return res.status(200).json({ message: "Ignored \u2014 not a registration insert" });
    }
    const rec = payload.record;
    const name = rec.name;
    const email = rec.email;
    const phone = rec.phone;
    const college = rec.college;
    const teamName = rec.team_name;
    const participantsCount = rec.participants_count;
    const transactionId = rec.transaction_id;
    const eventId = rec.event_id;
    if (!email) {
      console.error("[confirm-reg] No email in record");
      return res.status(400).json({ error: "No email in registration record" });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let eventMeta = { title: "DevSummit 3.0 Event", subtitle: "", themeColor: "#d4a373" };
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient: createClient5 } = await import("@supabase/supabase-js");
      const supabase = createClient5(supabaseUrl, supabaseServiceKey);
      const { data: eventData } = await supabase.from("events").select("slug").eq("id", eventId).single();
      if (eventData?.slug && EVENT_META[eventData.slug]) {
        eventMeta = EVENT_META[eventData.slug];
      }
    }
    console.log(`[confirm-reg] Sending confirmation to ${email} for ${eventMeta.title}`);
    const resend = new import_resend3.Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "DevSummit <tickets@devsummit.dev>";
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `\u{1F409} The Scroll Has Recorded Your Name \u2014 ${eventMeta.title} | DevSummit 3.0`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Top bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${eventMeta.themeColor}, #2d5a27);"></div>

          <div style="padding: 32px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 28px;">
              <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Valley of Peace Welcomes You</p>
              <h1 style="color: ${eventMeta.themeColor}; margin: 0; font-size: 30px; letter-spacing: 1px;">DevSummit 3.0</h1>
              <p style="color: #d4a373; margin: 10px 0 0; font-size: 13px; font-style: italic;">"Your story may not have such a happy beginning, but that doesn't make you who you are."</p>
            </div>

            <!-- Scroll-style event card -->
            <div style="background: #14141e; border: 1px solid ${eventMeta.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px; position: relative;">
              <div style="position: absolute; top: -1px; left: 20px; right: 20px; height: 2px; background: ${eventMeta.themeColor}; opacity: 0.4;"></div>
              
              <h2 style="color: ${eventMeta.themeColor}; margin: 0 0 4px; font-size: 22px; letter-spacing: 1px;">${eventMeta.title}</h2>
              ${eventMeta.subtitle ? `<p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${eventMeta.subtitle}"</p>` : ""}

              <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
                Greetings, <strong style="color: ${eventMeta.themeColor};">${name}</strong>! Your scroll of registration has been received at the Jade Palace. \u{1F3EF}
              </p>

              <!-- Details table with bamboo-style left border -->
              <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
                <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${name}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${teamName}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${college}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${participantsCount}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Phone</td><td style="padding: 7px 0;">${phone}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${transactionId}</td></tr>
                </table>
              </div>
            </div>

            <!-- Pending verification box -->
            <div style="background: #1a1710; border: 1px solid #d4a37333; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <p style="color: #d4a373; margin: 0 0 6px; font-size: 14px; font-weight: 600;">\u23F3 The Masters Are Reviewing Your Tribute</p>
              <p style="color: #8a8272; margin: 0; font-size: 13px;">
                Once your payment is verified, your <strong style="color: #d4a373;">sacred event ticket</strong> shall be delivered to this scroll address.
              </p>
            </div>

            <!-- Oogway quote -->
            <div style="text-align: center; padding: 12px 20px; margin-bottom: 16px;">
              <p style="color: #6b8f71; margin: 0; font-size: 12px; font-style: italic;">"Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present."</p>
              <p style="color: #4a6b4e; margin: 6px 0 0; font-size: 10px;">\u2014 Master Oogway</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
              <p style="margin: 0;">Silicon Institute of Technology \xB7 GDG on Campus SIT \xB7 DevSummit 3.0</p>
              <p style="margin: 4px 0 0;">If you seek guidance, reply to this scroll.</p>
            </div>
          </div>

          <!-- Bottom bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${eventMeta.themeColor}, #2d5a27);"></div>
        </div>
      `
    });
    if (emailError) {
      console.error("[confirm-reg] Resend error:", emailError);
      return res.status(500).json({ error: "Failed to send email", details: emailError.message });
    }
    console.log(`[confirm-reg] Confirmation email sent to ${email}`);
    return res.status(200).json({ message: "Confirmation sent", email });
  } catch (err) {
    console.error("[confirm-reg] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}

// server.ts
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT]", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[UNHANDLED REJECTION]", err);
});
var app = (0, import_express.default)();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.use(import_express.default.json({ limit: "10mb" }));
function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
app.all("/api/admin-action", asyncHandler(handler));
app.all("/api/get-registrations", asyncHandler(handler2));
app.all("/api/export-registrations", asyncHandler(handler3));
app.all("/api/send-ticket", asyncHandler(handler4));
app.all("/api/confirm-registration", asyncHandler(handler5));
app.use(import_express.default.static(import_path.default.join(__dirname, "dist")));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(import_path.default.join(__dirname, "dist", "index.html"));
});
app.use((err, _req, res, _next) => {
  console.error("[express-error]", err);
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: "Internal server error", details: message });
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
