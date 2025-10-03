import time

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.types import ASGIApp, Receive, Scope, Send

REQUEST_COUNT = Counter("unigo_requests_total", "Total HTTP requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram(
    "unigo_request_duration_seconds", "Latency of HTTP requests", ["method", "path"]
)


class MetricsMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        method = scope["method"]
        path = scope["path"]
        start = time.time()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status = message["status"]
                REQUEST_COUNT.labels(method, path, str(status)).inc()
                REQUEST_LATENCY.labels(method, path).observe(time.time() - start)
            await send(message)

        await self.app(scope, receive, send_wrapper)


metrics_router = APIRouter()


@metrics_router.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
