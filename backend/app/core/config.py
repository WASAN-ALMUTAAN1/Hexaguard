from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: Optional[str] = None

    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    HF_API_KEY: Optional[str] = None

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LMSTUDIO_BASE_URL: str = "http://localhost:1234/v1"

    USE_LLM_JUDGE: bool = True
    DEFAULT_JUDGE_MODEL: str = "llama-3.3-70b-versatile"

    ENCRYPTION_KEY: Optional[str] = None
    DEFAULT_DEMO_CREDITS: float = 100.0


settings = Settings()