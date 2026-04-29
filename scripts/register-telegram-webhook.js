#!/usr/bin/env node
// Run once to register the Telegram webhook:
// node scripts/register-telegram-webhook.js

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL; // e.g. https://yourapp.vercel.app

if (!token || !secret || !appUrl) {
  console.error("Missing env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL");
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;

async function register() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });
  const data = await res.json();
  if (data.ok) {
    console.log("Webhook registered:", webhookUrl);
  } else {
    console.error("Failed:", data);
  }
}

register().catch(console.error);
