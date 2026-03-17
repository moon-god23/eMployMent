-- n8tern database schema
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students table — stores B.Tech student profiles
CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  whatsapp        TEXT NOT NULL UNIQUE,   -- WhatsApp phone number, used for Twilio alerts
  telegram_chat_id TEXT,                  -- Optional Telegram Chat ID for bot notifications
  skills          TEXT[] DEFAULT '{}',
  branch          TEXT,
  cgpa            NUMERIC(3,2),
  preferred_roles TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Listings table — scraped/manual internship/job listings
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  url             TEXT,
  skills_required TEXT[] DEFAULT '{}',
  location        TEXT,
  deadline        DATE,
  source          TEXT DEFAULT 'manual',  -- 'unstop' | 'internshala' | 'naukri' | 'rapidapi' | 'mock' | 'manual'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Applications table — one row per student-listing pair
-- match_score lives HERE so each student gets their own personalized score
CREATE TABLE IF NOT EXISTS applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  listing_id   UUID REFERENCES listings(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'saved'
               CHECK (status IN ('saved','applied','interview','offer')),
  match_score  INTEGER DEFAULT 0,
  match_reason TEXT,
  applied_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, listing_id)   -- one application per student per listing
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_listings_source      ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_deadline    ON listings(deadline);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications(status);
