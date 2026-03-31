from pydantic_settings import BaseSettings
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    APP_TITLE: str = "OpenAMS"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8090
    APP_SECRET: str = "change-me"
    DATABASE_URL: str = "postgresql://openams:password@localhost:5432/openams"
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    LOG_DIR: str = str(BASE_DIR / "logs")
    WILMA_API_URL: str = "https://playground.wilmagpt.com/v1/chat/completions"
    WILMA_API_KEY: str = ""
    WILMA_DEFAULT_MODEL: str = "qwen-large"
    WILMA_DEFAULT_TEMPERATURE: float = 0.7

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.LOG_DIR, exist_ok=True)
os.makedirs(BASE_DIR / "data", exist_ok=True)











