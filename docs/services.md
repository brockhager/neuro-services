# Neuro Services API

The Neuro Services layer provides a secure, type-safe API for interacting with the NeuroSwarm ecosystem. This document outlines the key interfaces and data structures used throughout the services.

## Core Interfaces

### User
Represents an authenticated user in the system.

```typescript
interface User {
  username: string;
}
```

### Manifest
Represents a content manifest with provenance information.

```typescript
interface Manifest {
  cid: string;
  data: string;
  timestamp: number;
  provenance: {
    finalized: boolean;
    attestationCount: number;
    txSignature: string;
    slot: number;
  };
}
```

### Attestation
Represents a validator's attestation of a manifest's integrity.

```typescript
interface Attestation {
  validator: string;
  confidence: number;
  timestamp: number;
}
```

### Peer
Represents a network peer in the NeuroSwarm mesh.

```typescript
interface Peer {
  addr: string;
  nodeId: string;
  version: string;
}
```

### Metrics
System performance and health metrics.

```typescript
interface Metrics {
  catalogSize: number;
  syncProgress: number;
  anchoringLatency: number;
}
```

### IndexItem
Represents an indexed item in the search catalog.

```typescript
interface IndexItem {
  cid: string;
  content: string;
  tags: string[];
  lineage: string[];
  confidence: number;
}
```

### LineageItem
Represents a single item in a content lineage graph.

```typescript
interface LineageItem {
  cid: string;
  type: string;
  timestamp?: number;
  validator?: string;
  confidence?: number;
  relation?: string;
}
```

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate and receive JWT token

### Public Endpoints
- `GET /v1/manifests/:cid` - Retrieve manifest data
- `GET /v1/index/search` - Search indexed content
- `GET /v1/index/lineage/:cid` - Get content lineage
- `GET /v1/index/confidence/:cid` - Get confidence score

### Protected Endpoints (Require JWT)
- `GET /v1/attestations/:cid` - Get attestations for manifest
- `GET /v1/peers` - List network peers
- `GET /v1/metrics` - System metrics

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are issued via `/auth/login` and expire after 1 hour by default.

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid token, etc.)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found

## Usage Examples

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

### Get Manifest
```bash
curl http://localhost:3000/v1/manifests/QmTest123
```

### Search with Auth
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/v1/attestations/QmTest123
```

## Development

When extending the API:

1. Define new interfaces in this document
2. Update TypeScript types accordingly
3. Add comprehensive tests for new endpoints
4. Include authentication where sensitive data is accessed
5. Log security events for observability

## Security

- All sensitive endpoints require authentication
- Failed auth attempts are logged for monitoring
- Rate limiting is enforced on all endpoints
- Input validation uses Joi schemas (future enhancement)