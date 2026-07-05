from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    jwt_secret: str

    # OAuth configs
    tiktok_client_id: str
    tiktok_client_secret: str
    tiktok_redirect_uri: str

    instagram_client_id: str
    instagram_client_secret: str
    instagram_redirect_uri: str

    youtube_client_id: str
    youtube_client_secret: str
    youtube_redirect_uri: str

    facebook_app_id: str
    facebook_app_secret: str
    facebook_redirect_uri: str

    api_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"

settings = Settings()
