"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAILS_INDEX = exports.esClient = void 0;
exports.connectElasticsearch = connectElasticsearch;
exports.indexEmail = indexEmail;
exports.updateEmailIndex = updateEmailIndex;
exports.searchEmails = searchEmails;
const elasticsearch_1 = require("@elastic/elasticsearch");
const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const esIndex = process.env.ELASTICSEARCH_INDEX || 'emails';
exports.esClient = new elasticsearch_1.Client({
    node: esNode,
    requestTimeout: 30000,
    maxRetries: 3,
});
exports.EMAILS_INDEX = esIndex;
async function connectElasticsearch() {
    try {
        const health = await exports.esClient.cluster.health();
        console.log(`[Elasticsearch] Cluster status: ${health.status}`);
        const indexExists = await exports.esClient.indices.exists({ index: exports.EMAILS_INDEX });
        if (!indexExists) {
            await exports.esClient.indices.create({
                index: exports.EMAILS_INDEX,
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
            console.log(`[Elasticsearch] Created index "${exports.EMAILS_INDEX}"`);
        }
        else {
            console.log(`[Elasticsearch] Index "${exports.EMAILS_INDEX}" already exists`);
        }
    }
    catch (err) {
        console.error('[Elasticsearch] Connection failed:', err);
    }
}
async function indexEmail(params) {
    try {
        await exports.esClient.index({
            index: exports.EMAILS_INDEX,
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
    }
    catch (err) {
        console.error('[Elasticsearch] Failed to index email:', err);
    }
}
async function updateEmailIndex(jobId, updates) {
    try {
        await exports.esClient.update({
            index: exports.EMAILS_INDEX,
            id: jobId,
            body: { doc: updates },
        });
    }
    catch (err) {
        console.error('[Elasticsearch] Failed to update email index:', err);
    }
}
async function searchEmails(query, options = {}) {
    const { userId, status, from = 0, size = 20 } = options;
    const must = [];
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
    const result = await exports.esClient.search({
        index: exports.EMAILS_INDEX,
        body: {
            query: must.length > 0 ? { bool: { must } } : { match_all: {} },
            from,
            size,
            sort: [{ createdAt: { order: 'desc' } }],
        },
    });
    const hits = (result.hits.hits || []).map((hit) => ({
        id: hit._id,
        ...hit._source,
    }));
    const total = typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value || 0;
    return { hits, total };
}
//# sourceMappingURL=elasticsearch.js.map