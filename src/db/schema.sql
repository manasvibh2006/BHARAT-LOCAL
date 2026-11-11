-- ==============================================================================
-- Bharat Local: Multilingual Location-Based Community Platform
-- PostgreSQL Database Schema & Optimized Indexes
-- ==============================================================================

-- Extensions for UUID generation and Trigram text indexing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Users Table
-- Stores user identity with phone-based authentication, preferred language, and geographical location
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'hi',
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    locality VARCHAR(150),
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
-- Categories for community posts with multi-language labels
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_hi VARCHAR(100) NOT NULL,
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    icon VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Posts Table
-- Core community posts with location tags, category, status lifecycle, and full-text vector
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'hi',
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    locality VARCHAR(150),
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    contact_info VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'flagged', 'hidden', 'rejected')),
    report_count INT NOT NULL DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Post Reports Table
-- Community safety & reporting system
CREATE TABLE IF NOT EXISTS post_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'hate_speech', 'misinformation', 'inappropriate', 'fraud', 'other')),
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_post_reporter UNIQUE (post_id, reporter_id)
);

-- 5. Moderation Action Logs Table
-- Audit trail of every moderation decision (approvals, rejections, bans)
CREATE TABLE IF NOT EXISTS moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL CHECK (action IN ('approved', 'rejected', 'hidden', 'restored', 'user_warned', 'user_banned')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Notifications Table
-- User notifications delivered asynchronously for status updates and alerts
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. OTP Verifications Table
-- High-efficiency OTP token table with expiration
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- DATABASE INDEXES FOR HIGH-THROUGHPUT RETRIEVAL
-- ==============================================================================

-- A. Location & Status Composite Indexes for Feed Queries
-- Queries filtering by city, status, and sorting by recency
CREATE INDEX IF NOT EXISTS idx_posts_city_status_created 
ON posts (city, status, created_at DESC);

-- B. Locality & Pincode Fast Filtering
CREATE INDEX IF NOT EXISTS idx_posts_locality_status 
ON posts (city, locality, status);

CREATE INDEX IF NOT EXISTS idx_posts_pincode_status 
ON posts (pincode, status);

-- C. Category & Language Feed Filtering
CREATE INDEX IF NOT EXISTS idx_posts_category_lang_created 
ON posts (category_id, language, created_at DESC);

-- D. Author Post Lookups
CREATE INDEX IF NOT EXISTS idx_posts_author 
ON posts (author_id, created_at DESC);

-- E. Multilingual Full-Text Search Vector Index (GIN)
CREATE INDEX IF NOT EXISTS idx_posts_search_vector 
ON posts USING GIN (search_vector);

-- F. Moderation Queue Optimization (Partial index for items needing review)
CREATE INDEX IF NOT EXISTS idx_posts_pending_review 
ON posts (status, report_count DESC) 
WHERE status IN ('pending_review', 'flagged');

CREATE INDEX IF NOT EXISTS idx_post_reports_status 
ON post_reports (status, created_at DESC);

-- G. Notifications Query Index
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
ON notifications (recipient_id, is_read, created_at DESC);

-- H. User Location & Phone Indexes
CREATE INDEX IF NOT EXISTS idx_users_phone 
ON users (phone);

CREATE INDEX IF NOT EXISTS idx_users_location 
ON users (state, city, pincode);

-- Trigger for Search Vector Auto-Population
CREATE OR REPLACE FUNCTION update_post_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.locality, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.city, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_post_search_vector ON posts;
CREATE TRIGGER trg_update_post_search_vector
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();
