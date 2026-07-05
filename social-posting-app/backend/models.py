from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

class Platform(str, Enum):
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"

class PostStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    POSTED = "posted"
    FAILED = "failed"

class User:
    id: str
    email: str
    created_at: datetime
    updated_at: datetime

class PlatformCredential:
    id: str
    user_id: str
    platform: Platform
    access_token: str  # encrypted
    refresh_token: Optional[str]  # encrypted
    token_expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class Post:
    id: str
    user_id: str
    video_url: str  # path to uploaded video or URL
    captions: Dict[str, str]  # {platform: caption_text}
    platforms: list[Platform]  # which platforms to post to
    status: PostStatus
    scheduled_for: Optional[datetime]
    posted_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

class PostPlatformStatus:
    id: str
    post_id: str
    platform: Platform
    status: PostStatus
    platform_post_id: Optional[str]  # ID returned by platform API
    error_message: Optional[str]
    posted_at: Optional[datetime]
