# Gateway API

The Gateway API provides external services and applications with a clean REST interface to query NeuroSwarm node state, provenance, and confidence scores.

## Quick Start

- **[Getting Started](../../getting-started.md)** - Setup and run the gateway API
- **[API Reference](./services.md)** - Complete interface definitions and authentication
- **[Development Guide](../../development.md)** - Gateway development workflow

## Endpoints

### GET /v1/manifests/{cid}
Returns manifest data and provenance status.

**Response:**
```json
{
  "cid": "QmTest123",
  "data": "base64-encoded data",
  "timestamp": 1636740000000,
  "provenance": {
    "finalized": true,
    "attestationCount": 3,
    "txSignature": "abc123",
    "slot": 12345
  }
}
```

### GET /v1/attestations/{cid}
Lists validator attestations for a manifest.

**Response:**
```json
{
  "attestations": [
    {
      "validator": "val1_pubkey",
      "confidence": 95,
      "timestamp": 1636740000000
    }
  ]
}
```

### GET /v1/peers
Returns current peer set and health status.

**Response:**
```json
{
  "peers": [
    {
      "addr": "127.0.0.1:8080",
      "nodeId": "node1",
      "version": "0.1.0"
    }
  ]
}
```

### GET /v1/metrics
Returns node statistics.

**Response:**
```json
{
  "catalogSize": 150,
  "syncProgress": 85,
  "anchoringLatency": 120
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

## Security

- Rate limiting: 100 requests per 15 minutes per IP
- CORS enabled for cross-origin requests
- Helmet for security headers
- Morgan for request logging

## Authentication

Future: API key authentication for sensitive endpoints.

## Observability

- Request logging with Morgan
- Structured error responses
- Health checks for monitoring

## Usage Examples

```bash
# Get manifest
curl http://localhost:3000/v1/manifests/QmTest123

# Get attestations
curl http://localhost:3000/v1/attestations/QmTest123

# Get peers
curl http://localhost:3000/v1/peers

# Get metrics
curl http://localhost:3000/v1/metrics
```