# 🗄️ MongoDB Database Setup - Complete

## ✅ Current Configuration

### Database Details
- **Database Name**: `guitar_academy`
- **Connection URI**: `mongodb://10.255.255.254:27017/guitar_academy`
- **Host**: 10.255.255.254 (Windows from WSL2)
- **Port**: 27017

### Collections & Schemas

#### 1. `users` Collection
**Schema:**
```typescript
{
  _id: ObjectId,           // MongoDB ID
  id: string,              // Custom user ID
  name: string,            // Username
  email: string,           // Email (unique)
  password: string,        // bcryptjs hash
  totalScore: number,      // Aggregate score
  totalLevels: number,     // Levels completed
  bestAccuracy: number,    // Best accuracy %
  createdAt: Date,         // Account creation
  updatedAt: Date          // Last update
}
```

**Used by:**
- `/api/signup` - User registration
- `/api/auth/[...nextauth]/route.ts` - Login verification
- `/api/user` - Profile GET/PATCH
- `/api/scores` - Score submission (updates stats)

---

#### 2. `scores` Collection
**Schema:**
```typescript
{
  _id: ObjectId,           // MongoDB ID
  userId: string,          // Reference to user.id
  levelId: string,         // Reference to level
  roomCode?: string,       // Optional multiplayer room
  score: number,           // Points earned
  hits: number,            // Correct notes
  misses: number,          // Missed notes
  accuracy: number,        // Percentage (0-100)
  createdAt: Date,         // When score was set
  updatedAt: Date          // Last update
}
```

**Used by:**
- `/api/scores` - POST (submit score), GET (leaderboard)
- `/app/game/[levelId]/page.tsx` - Auto-submit on game end
- `/app/leaderboard/page.tsx` - Show rankings

---

#### 3. `levels` Collection
**Schema:**
```typescript
{
  _id: ObjectId,           // MongoDB ID
  id: string,              // Custom level ID
  title: string,           // Level name
  artist?: string,         // Artist/creator
  bpm: number,             // Tempo
  difficulty: string,      // "easy" | "medium" | "hard"
  category: string,        // "scales" | "chords" | "arpeggios" | "techniques" | "songs"
  durationMs: number,      // Duration in milliseconds
  albumCover?: string,     // Cover image URL
  notes: Array<{
    id: string,            // Note ID
    targetHz: number,      // Target frequency
    startMs: number,       // Start time
    durationMs: number     // Duration
  }>,
  createdAt: Date,         // When created
  updatedAt: Date          // Last update
}
```

**Used by:**
- `/api/levels` - GET (all levels), POST (create)
- `/api/levels/[id]` - GET/PUT/DELETE specific level
- `/app/page.tsx` - Show available levels
- `/app/game/[levelId]/page.tsx` - Load level for playing

---

#### 4. `rooms` Collection
**Schema:**
```typescript
{
  _id: ObjectId,           // MongoDB ID
  code: string,            // 5-char room code
  levelId: string,         // Which level to play
  creatorId: string,       // Who created room
  players: Array<{
    id: string,            // Player user ID
    name: string,          // Player name
    score: number          // Their current score
  }>,
  status: string,          // "waiting" | "playing" | "finished"
  createdAt: Date,         // When created
  expiresAt: Date          // Auto-delete after 24h
}
```

**Used by:**
- `/api/rooms` - POST (create room), GET (list rooms)
- `/api/rooms/[code]` - GET (room details), PUT (join/update)
- `/app/lobby/[roomCode]/page.tsx` - Multiplayer lobby

---

## 📍 Database Client Files

### `/lib/mongodb.ts` ✅ (USED)
- **Purpose**: MongoDB native driver connection
- **Type**: Native MongoDB driver
- **Used by**: All API routes
- **Caching**: Yes (prevents multiple connections in dev)

```javascript
// Connect like this:
const client = await clientPromise;
const db = client.db("guitar_academy");
const collection = db.collection("users");
```

### `/app/db/client.ts` ⚠️ (NOT USED)
- **Purpose**: Mongoose connection (not currently used)
- **Status**: Can remove or keep as backup
- **Note**: API routes use native driver instead

### `/app/db/models/*.ts` ✅ (TYPE DEFINITIONS)
- `User.ts` - UserDocument interface
- `Score.ts` - ScoreDocument interface
- `Level.ts` - LevelDocument interface
- `Room.ts` - RoomDocument interface

These are **TypeScript type definitions only** - not actual database schemas.

---

## 🔧 Database Operations

### User Registration (`/api/signup`)
```javascript
// 1. Check email unique
const existing = await users.findOne({ email });

// 2. Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// 3. Insert user
await users.insertOne({
  id: userId,
  name: username,
  email,
  password: hashedPassword,
  totalScore: 0,
  totalLevels: 0,
  bestAccuracy: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### Score Submission (`/api/scores`)
```javascript
// 1. Get authenticated user
const session = await getAuthSession();
const userId = session.user.id;

// 2. Insert score
await db.collection("scores").insertOne({
  userId,
  levelId,
  score,
  hits,
  misses,
  accuracy,
  createdAt: new Date()
});

// 3. Update user stats
await db.collection("users").updateOne(
  { id: userId },
  {
    $inc: { totalScore: score, totalLevels: 1 },
    $max: { bestAccuracy: accuracy },
    $set: { updatedAt: new Date() }
  }
);
```

### Login (`/api/auth/[...nextauth]/route.ts`)
```javascript
// 1. Find user by email
const user = await users.findOne({ email });

// 2. Compare password
const match = await bcrypt.compare(password, user.password);

// 3. Return user data for JWT
return {
  id: user.id,
  name: user.name,
  email: user.email
};
```

---

## ✅ Verification Checklist

- [ ] MongoDB running on Windows (mongod process)
- [ ] `.env` has correct database name: `guitar_academy`
- [ ] Connection string: `mongodb://10.255.255.254:27017/guitar_academy`
- [ ] `/lib/mongodb.ts` exists and exports clientPromise
- [ ] All API routes import from `/lib/mongodb`
- [ ] All collections use `db("guitar_academy")`
- [ ] Models are TypeScript interfaces in `/app/db/models/`
- [ ] Ready to test: `npm run dev`

---

## 🧪 Test Database Connection

```bash
# Start dev server
npm run dev

# In browser, visit:
http://localhost:3000/api/test-mongo

# Should show:
{
  "success": true,
  "message": "Successfully connected to MongoDB",
  "database": "guitar_academy"
}
```

---

## 📊 Database State After Setup

After first user signup:

**users collection:**
```json
{
  "_id": ObjectId("..."),
  "id": "abc123def456",
  "name": "testuser",
  "email": "test@example.com",
  "password": "$2a$10$...",
  "totalScore": 0,
  "totalLevels": 0,
  "bestAccuracy": 0,
  "createdAt": "2024-02-21T...",
  "updatedAt": "2024-02-21T..."
}
```

After game score submission:

**scores collection:**
```json
{
  "_id": ObjectId("..."),
  "userId": "abc123def456",
  "levelId": "level_1",
  "score": 1000,
  "hits": 45,
  "misses": 5,
  "accuracy": 90,
  "createdAt": "2024-02-21T..."
}
```

**users collection (updated):**
```json
{
  ...
  "totalScore": 1000,
  "totalLevels": 1,
  "bestAccuracy": 90,
  "updatedAt": "2024-02-21T..."
}
```

---

## 🚀 Ready to Go!

Everything is configured and ready. Just:

1. ✅ MongoDB running on Windows
2. ✅ `.env` has correct database name
3. ✅ All client imports correct
4. ✅ All schema interfaces defined
5. ✅ Ready to test!

**Next step: Start `npm run dev` and test signup!** 🎸
