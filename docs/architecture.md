# Architecture Deep Dive

## 1. Happy-path request: creating an order

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as api-gateway
    participant OS as orders-service
    participant US as users-service
    participant NS as notifications-service

    C->>GW: POST /orders { userId, items }
    GW->>GW: validate DTO (class-validator)
    GW->>OS: gRPC CreateOrder
    OS->>US: gRPC GetUser(userId)
    US-->>OS: User
    OS->>OS: compute total, store order (status=created)
    OS->>NS: gRPC SendNotification
    NS-->>OS: { status: "sent" }
    OS-->>GW: Order
    GW-->>C: 201 Order (JSON)
```

Two gRPC hops happen inside a single REST request. `orders-service` is a client of two other services and a server to the gateway at the same time — every service in this repo is both, except `api-gateway` (pure client) and the two leaf services (pure servers).

## 2. Error propagation: gRPC status → HTTP status

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as api-gateway
    participant OS as orders-service
    participant US as users-service

    C->>GW: POST /orders { userId: "unknown-id", items }
    GW->>OS: gRPC CreateOrder
    OS->>US: gRPC GetUser(userId)
    US-->>OS: gRPC error, code=NOT_FOUND
    OS-->>GW: gRPC error, code=NOT_FOUND (re-thrown, not swallowed)
    GW->>GW: GrpcExceptionFilter maps NOT_FOUND → HTTP 404
    GW-->>C: 404 { message: "User ... not found" }
```

The `NOT_FOUND` originates two hops away, in `users-service`, and survives unchanged through `orders-service` — nothing in the middle rewrites or loses the error. Every gRPC service in this repo throws `RpcException` with an explicit `@grpc/grpc-js` status code (`NOT_FOUND`, `INVALID_ARGUMENT`, ...); the mapping table lives in exactly one place, [`api-gateway/src/filters/grpc-exception.filter.ts`](../services/api-gateway/src/filters/grpc-exception.filter.ts).

## 3. Best-effort notification: the order doesn't roll back

```mermaid
flowchart TD
    A["orders-service: user validated"] --> B["persist order (status=created)"]
    B --> C["call notifications-service"]
    C -->|success| D["log delivery id + status"]
    C -->|"gRPC error / timeout"| E["log warning, continue"]
    D --> F["return Order to caller"]
    E --> F
```

The order is durable (in this demo, in-memory-durable) before the notification is even attempted. A failed or slow notification never turns into a failed order — see the trade-off discussion in the main [README](../README.md#why-notification-failure-doesnt-fail-the-order).

## 4. Observability: identical shape across services

```mermaid
flowchart LR
    subgraph "Any gRPC service (users / orders / notifications)"
        RPC["gRPC method call"] --> INT["GrpcMetricsInterceptor"]
        INT --> H["/metrics: grpc_requests_total, grpc_request_duration_seconds"]
    end

    subgraph "api-gateway"
        REQ["HTTP request"] --> MW["httpMetricsMiddleware"]
        MW --> HG["/metrics: http_requests_total, http_request_duration_seconds"]
    end

    H --> P[Prometheus]
    HG --> P
    P --> G["Grafana: Microservices Overview dashboard"]
```

Every service also emits one JSON log line per event to stdout (service name, level, message, timestamp) — no log aggregator wired up in this demo, but the shape is aggregator-ready as-is.

## 5. Proto contracts as the only coupling

```mermaid
flowchart TD
    subgraph proto["proto/ (shared, versioned together)"]
        UP[users.proto]
        OP[orders.proto]
        NP[notifications.proto]
    end

    UP --> US[users-service: server]
    UP --> OS1[orders-service: client]
    UP --> GW1[api-gateway: client]

    OP --> OS2[orders-service: server]
    OP --> GW2[api-gateway: client]

    NP --> NS[notifications-service: server]
    NP --> OS3[orders-service: client]
```

No service imports another service's code. The `.proto` files are the entire contract, copied into each Docker image at build time (see the `Dockerfile` in each service — the image layout deliberately mirrors the monorepo layout so proto path resolution is identical in Docker and local dev).
