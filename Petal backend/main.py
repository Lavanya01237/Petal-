import contextlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI

from config import settings
from routers.leads import router as leads_router
from services import clients

try:
    from redis import Redis
except Exception:  # pragma: no cover
    Redis = None  # type: ignore[assignment]


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    del app
    print("[Startup] Loading configuration and initializing OpenAI client.")
    settings.validate_startup()
    clients["openai"] = AsyncOpenAI(api_key=settings.openai_api_key)
    clients["redis"] = None

    if settings.redis_url and Redis is not None:
        try:
            redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
            redis_client.ping()
            clients["redis"] = redis_client
            print("[Startup] Redis session store connected.")
        except Exception as exc:
            print(f"[Startup] Redis unavailable, using in-memory sessions: {exc}")
    elif settings.redis_url and Redis is None:
        print("[Startup] redis package missing. Using in-memory sessions.")
    else:
        print("[Startup] REDIS_URL not set. Using in-memory sessions.")

    try:
        yield
    finally:
        redis_client = clients.pop("redis", None)
        if redis_client is not None:
            try:
                redis_client.close()
            except Exception:
                pass
        client = clients.pop("openai", None)
        if client is not None:
            print("[Shutdown] Closing OpenAI client.")
            await client.close()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def health_check() -> JSONResponse:
        print("[Health] Health check requested.")
        return JSONResponse(content={"status": "running"})

    app.include_router(leads_router)
    return app


app = create_app()
