import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


if not os.getenv("RUNNING_IN_PRODUCTION"):
    load_dotenv(Path(__file__).resolve().parent / ".env")


@dataclass(frozen=True)
class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    tinyfish_api_key: str = os.getenv("TINYFISH_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    tinyfish_url: str = os.getenv(
        "TINYFISH_URL", "https://agent.tinyfish.ai/v1/automation/run-sse"
    )
    tinyfish_connect_timeout_seconds: int = int(
        os.getenv("TINYFISH_CONNECT_TIMEOUT_SECONDS", "5")
    )
    tinyfish_read_timeout_seconds: int = int(os.getenv("TINYFISH_READ_TIMEOUT_SECONDS", "10"))
    tinyfish_task_timeout_seconds: int = int(os.getenv("TINYFISH_TASK_TIMEOUT_SECONDS", "10"))
    tinyfish_total_timeout_seconds: int = int(os.getenv("TINYFISH_TOTAL_TIMEOUT_SECONDS", "40"))
    tinyfish_max_search_urls: int = int(os.getenv("TINYFISH_MAX_SEARCH_URLS", "3"))
    tinyfish_parallel_calls: int = int(os.getenv("TINYFISH_PARALLEL_CALLS", "5"))
    tinyfish_per_call_timeout_seconds: int = int(
        os.getenv("TINYFISH_PER_CALL_TIMEOUT_SECONDS", "0")
    )
    tinyfish_batch_timeout_seconds: int = int(
        os.getenv("TINYFISH_BATCH_TIMEOUT_SECONDS", "0")
    )
    tinyfish_early_return_min_leads: int = int(
        os.getenv("TINYFISH_EARLY_RETURN_MIN_LEADS", "1")
    )
    tinyfish_retry_attempts: int = int(os.getenv("TINYFISH_RETRY_ATTEMPTS", "1"))
    tinyfish_retry_backoff_seconds: float = float(
        os.getenv("TINYFISH_RETRY_BACKOFF_SECONDS", "1.0")
    )
    redis_url: str = os.getenv("REDIS_URL", "")
    session_ttl_seconds: int = int(os.getenv("SESSION_TTL_SECONDS", "86400"))

    def validate_startup(self) -> None:
        if not self.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required to start the backend.")


settings = Settings()
