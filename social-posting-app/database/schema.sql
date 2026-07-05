-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Credentials table (OAuth tokens stored encrypted)
CREATE TABLE IF NOT EXISTS platform_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    captions JSONB NOT NULL DEFAULT '{}',
    platforms TEXT[] NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    posted_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Post Platform Status tracking
CREATE TABLE IF NOT EXISTS post_platform_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    platform_post_id VARCHAR(255),
    error_message TEXT,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, platform)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_platform_credentials_user ON platform_credentials(user_id);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_post_platform_status_post ON post_platform_status(post_id);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_platform_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Platform credentials access control
CREATE POLICY "Users can view own credentials" ON platform_credentials
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own credentials" ON platform_credentials
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Posts access control
CREATE POLICY "Users can view own posts" ON posts
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own posts" ON posts
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Post status access control
CREATE POLICY "Users can view own post statuses" ON post_platform_status
    FOR SELECT USING (
        auth.uid()::text = (SELECT user_id::text FROM posts WHERE id = post_id)
    );

CREATE POLICY "Users can manage own post statuses" ON post_platform_status
    FOR ALL USING (
        auth.uid()::text = (SELECT user_id::text FROM posts WHERE id = post_id)
    );
