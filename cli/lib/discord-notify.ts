/**
 * @module cli/lib/discord-notify
 * @description Discord webhook notification — sends embed messages.
 *
 * Used by pipeline.ts to notify at each checkpoint.
 * If DISCORD_WEBHOOK_URL is not set, silently skips.
 */

interface NotifyOptions {
  title: string;
  description: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export async function notify(opts: NotifyOptions): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: opts.title,
          description: opts.description,
          color: opts.color ?? 0x00b894, // green
          fields: opts.fields,
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!res.ok) {
      console.warn(`   ⚠️  Discord notify failed (${res.status})`);
    }
  } catch {
    // Don't block pipeline on notification failure
  }
}
