import { Client } from '@elastic/elasticsearch';

const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const esIndex = process.env.ELASTICSEARCH_INDEX || 'emails';

export const esClient = new Client({
  node: esNode,
  requestTimeout: 30000,
  maxRetries: 3,
});

export const EMAILS_INDEX = esIndex;

export async function connectElasticsearch(): Promise<void> {
  try {
    const health = await esClient.cluster.health();
    console.log(`[Elasticsearch] Cluster status: ${health.status}`);

    const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              jobId: { type: 'keyword' },
              userId: { type: 'keyword' },
              recipient: { type: 'keyword' },
              recipientName: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              delaySeconds: { type: 'integer' },
              hourlyLimit: { type: 'integer' },
              leadCount: { type: 'integer' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Created index "${EMAILS_INDEX}"`);
    } else {
      console.log(`[Elasticsearch] Index "${EMAILS_INDEX}" already exists`);
    }
  } catch (err) {
    console.error('[Elasticsearch] Connection failed:', err);
  }
}

interface IndexEmailParams {
  jobId: string;
  userId: string;
  recipient: string;
  recipientName?: string | null;
  subject: string;
  body: string;
  status: string;
  senderEmail?: string;
  scheduledFor?: string;
  sentAt?: string | null;
  delaySeconds?: number;
  hourlyLimit?: number;
  leadCount?: number;
  createdAt?: string;
}

export async function indexEmail(params: IndexEmailParams): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: params.jobId,
      body: {
        jobId: params.jobId,
        userId: params.userId,
        recipient: params.recipient,
        recipientName: params.recipientName || null,
        subject: params.subject,
        body: params.body,
        status: params.status,
        senderEmail: params.senderEmail || null,
        scheduledFor: params.scheduledFor || null,
        sentAt: params.sentAt || null,
        delaySeconds: params.delaySeconds || 0,
        hourlyLimit: params.hourlyLimit || 0,
        leadCount: params.leadCount || 1,
        createdAt: params.createdAt || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[Elasticsearch] Failed to index email:', err);
  }
}

export async function updateEmailIndex(
  jobId: string,
  updates: Record<string, unknown>
): Promise<void> {
  try {
    await esClient.update({
      index: EMAILS_INDEX,
      id: jobId,
      body: { doc: updates },
    });
  } catch (err) {
    console.error('[Elasticsearch] Failed to update email index:', err);
  }
}

export async function searchEmails(
  query: string,
  options: { userId?: string; status?: string; from?: number; size?: number } = {}
): Promise<{ hits: Record<string, unknown>[]; total: number }> {
  const { userId, status, from = 0, size = 20 } = options;

  const must: Record<string, unknown>[] = [];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['subject^2', 'body', 'recipient', 'recipientName'],
        fuzziness: 'AUTO',
      },
    });
  }

  if (userId) {
    must.push({ term: { userId } });
  }

  if (status) {
    must.push({ term: { status } });
  }

  const result = await esClient.search({
    index: EMAILS_INDEX,
    body: {
      query: must.length > 0 ? { bool: { must } } : { match_all: {} },
      from,
      size,
      sort: [{ createdAt: { order: 'desc' } }],
    },
  });

  const hits = (result.hits.hits || []).map((hit) => ({
    id: hit._id,
    ...(hit._source as Record<string, unknown>),
  }));

  const total =
    typeof result.hits.total === 'number'
      ? result.hits.total
      : result.hits.total?.value || 0;

  return { hits, total };
}
