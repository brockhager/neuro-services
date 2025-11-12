# NeuroSwarm Observability Setup

This document describes how to set up monitoring and observability for the NeuroSwarm services layer using Prometheus and Grafana.

## Architecture

```
Neuro Services API
        ↓ (exposes /metrics)
   Prometheus Scraper
        ↓ (pulls metrics)
     Grafana Dashboard
        ↓ (visualizes data)
      Operators/Developers
```

## Prerequisites

- Docker and Docker Compose
- Neuro Services API running (see main README)

## Quick Start with Docker Compose

Create a `docker-compose.yml` file in the neuro-services directory:

```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  grafana_data:
```

Create a `prometheus.yml` configuration file:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'neuroswarm-services'
    static_configs:
      - targets: ['host.docker.internal:3000']  # Adjust for your setup
    metrics_path: '/metrics'
```

## Setup Steps

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Access Grafana:**
   - Open http://localhost:3000
   - Login with admin/admin
   - Add Prometheus as a data source: http://prometheus:9090

3. **Import Dashboard:**
   - Go to Dashboards → Import
   - Upload `grafana-dashboard.json`
   - Select Prometheus as the data source

## Metrics Available

### Custom Metrics
- `neuroswarm_auth_failures_total{type}` - Authentication failures by type
- `neuroswarm_api_requests_total{method,endpoint,status}` - API request counts
- `neuroswarm_api_request_duration_seconds{method,endpoint}` - Request duration histograms
- `neuroswarm_peer_access_total{username}` - Peer list access counts

### Default Node.js Metrics
- Memory usage, CPU usage, event loop lag
- Garbage collection statistics
- HTTP server metrics

## Dashboard Panels

1. **Authentication Failures** - Real-time auth failure rate
2. **API Request Rate** - Request volume by endpoint
3. **API Response Time** - 50th/95th percentile response times
4. **Peer Access Activity** - User access to peer lists
5. **HTTP Status Codes** - Distribution of response codes
6. **System Metrics** - Memory and CPU usage

## Alerting

Configure alerts in Prometheus for:
- High auth failure rates
- Slow response times (>2s 95th percentile)
- High error rates (>5% 5xx responses)
- Memory/CPU usage thresholds

## Production Deployment

For production:

1. Use persistent volumes for Grafana and Prometheus data
2. Configure authentication and TLS
3. Set up alerting via Alertmanager
4. Use service discovery instead of static targets
5. Implement log aggregation (ELK stack or similar)

## Troubleshooting

- **No metrics visible**: Check that `/metrics` endpoint is accessible
- **Dashboard shows no data**: Verify Prometheus can scrape the target
- **High memory usage**: Adjust scrape intervals or reduce metric retention

## Integration with Neuro-Infra

Future enhancements will add similar metrics to the Rust daemon for:
- Sync progress and latency
- Peer connection health
- Solana anchoring status
- Storage utilization