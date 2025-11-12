# Indexer Integration

The Indexer provides advanced search, lineage queries, and confidence scoring across NeuroSwarm manifests and attestations.

## Quick Start

- **[Getting Started](../../getting-started.md)** - Setup and run the indexer service
- **[API Reference](./services.md)** - Complete interface definitions and data structures
- **[Development Guide](../../development.md)** - Indexer development workflow

## Architecture

- **Local Index**: In-memory index of manifests with metadata, tags, and relationships
- **Search Engine**: Full-text search over content and metadata
- **Lineage Resolver**: Traces provenance chains and dependencies
- **Confidence Aggregator**: Combines validator attestations with anchoring status
- **Event Ingestion**: Future: consume Solana events for real-time updates

## Endpoints

### GET /v1/index/search
Full-text search over indexed content.

**Query Parameters:**
- `q`: Search query string
- `tag`: Filter by tag

**Response:**
```json
{
  "results": [
    {
      "cid": "QmTest123",
      "content": "neural network model data",
      "tags": ["ai", "model"],
      "lineage": ["QmParent1"],
      "confidence": 92
    }
  ],
  "total": 1
}
```

### GET /v1/index/lineage/{cid}
Returns provenance lineage for a manifest.

**Response:**
```json
{
  "lineage": [
    {
      "cid": "QmTest123",
      "type": "manifest",
      "timestamp": 1636740000000
    },
    {
      "cid": "QmAttest1",
      "type": "attestation",
      "validator": "val1",
      "confidence": 95
    }
  ]
}
```

### GET /v1/index/confidence/{cid}
Returns aggregated confidence score.

**Response:**
```json
{
  "cid": "QmTest123",
  "overallConfidence": 92,
  "attestationCount": 2,
  "anchoringStatus": "high"
}
```

## Features

### Search
- Full-text search over manifest content
- Tag-based filtering
- Relevance scoring

### Lineage
- Dependency tracing
- Attestation chains
- Validator relationships

### Confidence Scoring
- Average validator confidence
- Anchoring status integration
- Trust levels (high/medium/low)

## Observability

- Query performance metrics
- Cache hit rates
- Lineage resolution depth
- Search query logging

## Integration

- Connects to Gateway API for data access
- Future: Distributed indexer network
- Event-driven updates from Solana

## Usage Examples

```bash
# Search for AI models
curl "http://localhost:3000/v1/index/search?q=neural&tag=ai"

# Get lineage
curl http://localhost:3000/v1/index/lineage/QmTest123

# Get confidence
curl http://localhost:3000/v1/index/confidence/QmTest123
```