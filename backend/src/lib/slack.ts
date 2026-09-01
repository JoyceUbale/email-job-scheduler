import { prisma } from './prisma';

/**
 * Slack Webhook Call
 *
 * When a sender hits their hourly rate limit, trigger a live Slack notification
 * using their stored OAuth token / webhook URL. If Slack isn't connected,
 * bypass gracefully without throwing an error.
 */

interface SlackNotificationParams {
  userId: string;
  senderEmail: string;
  message: string;
}

export async function sendSlackRateLimitNotification(
  params: SlackNotificationParams
): Promise<boolean> {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: params.userId },
    });

    // If Slack isn't connected, bypass gracefully
    if (!integration || !integration.isConnected) {
      console.log(
        `[Slack] Not connected for user ${params.userId} — bypassing notification`
      );
      return false;
    }

    // Prefer webhook URL if available (simplest approach)
    if (integration.webhookUrl) {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:warning: *Rate Limit Reached*\n${params.message}`,
          channel: integration.channel || undefined,
        }),
      });

      if (!response.ok) {
        console.error(
          `[Slack] Webhook call failed: ${response.status} ${response.statusText}`
        );
        return false;
      }

      console.log(`[Slack] Rate limit notification sent for sender ${params.senderEmail}`);
      return true;
    }

    // If no webhook URL but has an OAuth token, use the Slack Web API
    if (integration.accessToken) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
        body: JSON.stringify({
          channel: integration.channel || '#general',
          text: `:warning: *Rate Limit Reached*\n${params.message}`,
        }),
      });

      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        console.error(`[Slack] API call failed: ${data.error}`);
        return false;
      }

      console.log(`[Slack] Rate limit notification sent for sender ${params.senderEmail}`);
      return true;
    }

    console.log(`[Slack] No webhook URL or token for user ${params.userId} — bypassing`);
    return false;
  } catch (err) {
    // Never throw — Slack failures should not break the job processing flow
    console.error('[Slack] Notification error (bypassing gracefully):', err);
    return false;
  }
}
