CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

CREATE TYPE "Proficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE "ExchangeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED', 'DISPUTED');

CREATE TYPE "Location" AS ENUM ('CAMPUS', 'ONLINE');

CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "fictional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "faculty" TEXT NOT NULL DEFAULT '',
    "studyYear" INTEGER NOT NULL DEFAULT 1,
    "bio" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTeachingSkill" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" "Proficiency" NOT NULL,

    CONSTRAINT "UserTeachingSkill_pkey" PRIMARY KEY ("userId","skillId")
);

CREATE TABLE "UserLearningSkill" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "UserLearningSkill_pkey" PRIMARY KEY ("userId","skillId")
);

CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "nextResponderId" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'PROPOSED',
    "message" TEXT NOT NULL DEFAULT '',
    "responseNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangeSession" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "location" "Location" NOT NULL,
    "locationDetail" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExchangeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionConfirmation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "exchangeId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

CREATE INDEX "UserTeachingSkill_skillId_idx" ON "UserTeachingSkill"("skillId");

CREATE INDEX "UserLearningSkill_skillId_idx" ON "UserLearningSkill"("skillId");

CREATE UNIQUE INDEX "AvailabilitySlot_userId_day_hour_key" ON "AvailabilitySlot"("userId", "day", "hour");

CREATE INDEX "Exchange_senderId_status_idx" ON "Exchange"("senderId", "status");

CREATE INDEX "Exchange_receiverId_status_idx" ON "Exchange"("receiverId", "status");

CREATE INDEX "ExchangeSession_teacherId_startsAt_idx" ON "ExchangeSession"("teacherId", "startsAt");

CREATE INDEX "ExchangeSession_learnerId_startsAt_idx" ON "ExchangeSession"("learnerId", "startsAt");

CREATE UNIQUE INDEX "ExchangeSession_exchangeId_ordinal_key" ON "ExchangeSession"("exchangeId", "ordinal");

CREATE UNIQUE INDEX "SessionConfirmation_sessionId_userId_key" ON "SessionConfirmation"("sessionId", "userId");

CREATE INDEX "Review_subjectId_idx" ON "Review"("subjectId");

CREATE UNIQUE INDEX "Review_sessionId_authorId_key" ON "Review"("sessionId", "authorId");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTeachingSkill" ADD CONSTRAINT "UserTeachingSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTeachingSkill" ADD CONSTRAINT "UserTeachingSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserLearningSkill" ADD CONSTRAINT "UserLearningSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLearningSkill" ADD CONSTRAINT "UserLearningSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExchangeSession" ADD CONSTRAINT "ExchangeSession_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExchangeSession" ADD CONSTRAINT "ExchangeSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExchangeSession" ADD CONSTRAINT "ExchangeSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExchangeSession" ADD CONSTRAINT "ExchangeSession_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionConfirmation" ADD CONSTRAINT "SessionConfirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExchangeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionConfirmation" ADD CONSTRAINT "SessionConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExchangeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_year_check" CHECK ("studyYear" BETWEEN 1 AND 6);
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "Availability_check" CHECK ("day" BETWEEN 0 AND 6 AND "hour" BETWEEN 0 AND 23);
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_different_users" CHECK ("senderId" <> "receiverId" AND "nextResponderId" IN ("senderId", "receiverId"));
ALTER TABLE "ExchangeSession" ADD CONSTRAINT "Session_values_check" CHECK ("ordinal" IN (1, 2) AND "duration" BETWEEN 30 AND 45 AND "teacherId" <> "learnerId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_values_check" CHECK ("rating" BETWEEN 1 AND 5 AND length("text") BETWEEN 1 AND 300 AND "authorId" <> "subjectId");
ALTER TABLE "UserBlock" ADD CONSTRAINT "Block_different_users" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "UserReport" ADD CONSTRAINT "Report_different_users" CHECK ("reporterId" <> "reportedId");
CREATE FUNCTION verify_exchange_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id text;
  expected_sender text;
  expected_receiver text;
  session_count integer;
BEGIN
  IF TG_TABLE_NAME = 'Exchange' THEN
    target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."exchangeId" ELSE NEW."exchangeId" END;
  END IF;
  SELECT "senderId", "receiverId" INTO expected_sender, expected_receiver FROM "Exchange" WHERE id = target_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO session_count FROM "ExchangeSession" WHERE "exchangeId" = target_id;
  IF session_count <> 2 THEN RAISE EXCEPTION 'An exchange must contain exactly two sessions'; END IF;
  IF EXISTS (SELECT 1 FROM "ExchangeSession" WHERE "exchangeId" = target_id AND ((ordinal = 1 AND ("teacherId" <> expected_sender OR "learnerId" <> expected_receiver)) OR (ordinal = 2 AND ("teacherId" <> expected_receiver OR "learnerId" <> expected_sender)))) THEN
    RAISE EXCEPTION 'Sessions must have opposite teaching directions';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER exchange_session_count AFTER INSERT OR UPDATE ON "Exchange" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_exchange_sessions();
CREATE CONSTRAINT TRIGGER exchange_session_directions AFTER INSERT OR UPDATE OR DELETE ON "ExchangeSession" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_exchange_sessions();
