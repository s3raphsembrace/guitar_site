# 📂 Guitar Site - File Structure & Auth Files

## 🎯 Authentication Files (What We Implemented)

### Core Authentication
```
app/api/auth/[...nextauth]/route.ts     ← NextAuth configuration
  • Credentials provider setup
  • JWT callbacks
  • Session management
  • MongoDB integration

app/api/signup/route.ts                 ← User registration
  • Email validation
  • Password hashing
  • User creation

app/api/login/route.ts                  ← Login endpoint
  • Credentials verification
  • User lookup

lib/auth.ts                             ← Server-side utilities
  • getAuthSession()
  • getCurrentUser()
  • isAuthenticated()

hooks/useAuth.ts                        ← Client-side hook
  • login()
  • logout()
  • signup()
  • User state management

lib/protectRoute.ts                     ← Route protection
  • JWT validation
  • Authorization checks

app/providers.tsx                       ← Session provider
  • NextAuth SessionProvider wrapper
```

### Authentication Pages
```
app/(auth)/login/page.tsx               ← Login/Signup UI
  • Combined signup/login interface
  • Form validation
  • Error handling
  • useAuth hook integration
```

### API Routes (All Fully Implemented)
```
app/api/auth/[...nextauth]/              ← NextAuth auto routes
  └─ route.ts                            (signin, session, signout, etc.)

app/api/signup/route.ts                 ← Create account
app/api/login/route.ts                  ← Login verification
app/api/session/route.ts                ← Get session info
app/api/signout/route.ts                ← Logout handler
app/api/user/route.ts                   ← User profile (GET/PATCH)

app/api/scores/route.ts                 ← Game scores (protected)
app/api/levels/route.ts                 ← Level management (protected)
app/api/levels/[id]/route.ts            ← Individual level (protected)

app/api/rooms/route.ts                  ← Create room (protected)
app/api/rooms/[code]/route.ts           ← Room management (protected)
```

### Database Configuration
```
app/db/client.ts                        ← MongoDB connection
app/db/models/User.ts                   ← User document schema
app/db/models/Level.ts                  ← Level schema
app/db/models/Score.ts                  ← Score schema
app/db/models/Room.ts                   ← Room schema
```

### Documentation
```
docs/AUTH.md                            ← Detailed auth guide
IMPLEMENTATION_SUMMARY.md               ← Complete overview
QUICK_REFERENCE.md                      ← Developer reference
FILE_STRUCTURE.md                       ← This file
```

---

## 📊 Complete Codebase Structure

```
guitar_site/
│
├── app/                                 # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                # Sign up / Login UI
│   │
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts                # ✅ NextAuth handler
│   │   ├── signup/
│   │   │   └── route.ts                # ✅ Create account
│   │   ├── login/
│   │   │   └── route.ts                # ✅ Login endpoint
│   │   ├── session/
│   │   │   └── route.ts                # ✅ Get session
│   │   ├── signout/
│   │   │   └── route.ts                # ✅ Logout handler
│   │   ├── user/
│   │   │   └── route.ts                # ✅ Get/update profile
│   │   │
│   │   ├── levels/
│   │   │   ├── route.ts                # ✅ Create/fetch levels
│   │   │   └── [id]/route.ts           # ✅ Update/delete levels
│   │   │
│   │   ├── scores/
│   │   │   └── route.ts                # ✅ Submit/get scores
│   │   │
│   │   ├── rooms/
│   │   │   ├── route.ts                # ✅ Create rooms
│   │   │   └── [code]/route.ts         # ✅ Manage rooms
│   │   │
│   │   └── test-mongo/
│   │       └── route.ts                # Test endpoint
│   │
│   ├── game/[levelId]/
│   │   └── page.tsx                    # ✅ Game with score submission
│   │
│   ├── leaderboard/
│   │   └── page.tsx                    # Leaderboard display
│   │
│   ├── page.tsx                        # Home page
│   ├── layout.tsx                      # ✅ Root layout with AuthProvider
│   ├── providers.tsx                   # ✅ SessionProvider wrapper
│   ├── globals.css                     # Global styles
│   └── middleware/
│       └── authMiddleware.ts           # ✅ Auth validation utilities
│
├── db/ (OLD - DEPRECATED)
│   ├── models/
│   │   ├── User.ts
│   │   ├── Level.ts
│   │   ├── Score.ts
│   │   └── Room.ts
│   └── client.ts
│
├── lib/                                 # Utilities
│   ├── auth.ts                         # ✅ Server-side auth utils
│   ├── protectRoute.ts                 # ✅ Route protection
│   ├── mongodb.ts                      # MongoDB connection
│   ├── game/
│   │   ├── scoring.ts                  # Score calculation
│   │   ├── gameModes.ts                # Game modes
│   │   ├── mockLevels.ts               # Mock data
│   │   └── levels.ts                   # Level loading
│   ├── audio/                          # Audio utilities
│   └── socket/
│       └── events.ts                   # WebSocket events
│
├── hooks/                              # React hooks
│   ├── useAuth.ts                      # ✅ Main auth hook
│   ├── useAudioCapture.ts              # Microphone input
│   ├── usePitchDetector.ts             # Pitch detection
│   ├── useGameSession.ts               # Game state
│   └── useSocket.ts                    # WebSocket
│
├── components/                         # React components
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Select.tsx
│   ├── audio/
│   ├── game/
│   └── lobby/
│
├── types/                              # TypeScript types
│   └── api.ts                          # API types
│
├── public/                             # Static assets
│   ├── audio/                          # Level audio files
│   ├── charts/                         # Level charts
│   └── songs.json                      # Song metadata
│
├── docs/                               # Documentation
│   └── AUTH.md                         # Auth documentation
│
├── .env                                # ✅ Environment variables
├── .env.local                          # Local overrides (gitignored)
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
├── next.config.ts                      # Next.js config
├── postcss.config.mjs                  # PostCSS config
├── tailwind.config.ts                  # Tailwind config
│
├── IMPLEMENTATION_SUMMARY.md           # ✅ Implementation guide
├── QUICK_REFERENCE.md                  # ✅ Developer reference
├── FILE_STRUCTURE.md                   # This file
│
└── .gitignore

```

---

## ✅ Implementation Checklist

### Authentication Core
- ✅ NextAuth with Credentials provider
- ✅ MongoDB integration
- ✅ SignUp endpoint
- ✅ Login endpoint
- ✅ JWT sessions
- ✅ Password hashing (bcryptjs)

### Client-Side
- ✅ useAuth() hook
- ✅ useRequireAuth() hook
- ✅ Login/Signup page
- ✅ SessionProvider wrapper
- ✅ Navigation with auth state

### Server-Side
- ✅ getAuthSession() utility
- ✅ getCurrentUser() utility
- ✅ isAuthenticated() utility
- ✅ Protected route middleware
- ✅ Token validation

### API Routes
- ✅ User signup (POST /api/signup)
- ✅ User login (POST /api/login)
- ✅ Session endpoints
- ✅ User profile (GET/PATCH /api/user)
- ✅ Score submission (POST /api/scores)
- ✅ Level management (CRUD)
- ✅ Room management (create/join)

### Game Integration
- ✅ Game page with useSession()
- ✅ Auto-score submission
- ✅ User stats tracking
- ✅ Leaderboard support
- ✅ Multiplayer room support

### Database
- ✅ Single database: guitar_academy
- ✅ Users collection
- ✅ Scores collection
- ✅ Levels collection
- ✅ Rooms collection

### Documentation
- ✅ AUTH.md - Detailed guide
- ✅ IMPLEMENTATION_SUMMARY.md - Overview
- ✅ QUICK_REFERENCE.md - Developer guide
- ✅ FILE_STRUCTURE.md - File map

---

## 🔑 Key Files to Know

If you're modifying auth, you'll need these:

| File | Purpose | Edit When |
|------|---------|-----------|
| `app/api/auth/[...nextauth]/route.ts` | NextAuth config | Changing auth strategy |
| `hooks/useAuth.ts` | Auth hook | Adding auth methods |
| `app/(auth)/login/page.tsx` | Login UI | Changing login form |
| `lib/auth.ts` | Server utilities | Adding server-side functions |
| `app/layout.tsx` | Root layout | Modifying session provider |
| `.env` | Environment vars | Updating secrets/URLs |

---

## 🚀 Getting Started

1. **Install dependencies**: `npm install`
2. **Set environment vars**: Copy `.env` values to `.env.local`
3. **Start dev server**: `npm run dev`
4. **Visit login**: http://localhost:3000/login
5. **Sign up**: Create account
6. **Log in**: Use credentials
7. **Play game**: Visit `/game/[levelId]`
8. **Check scores**: View leaderboard

---

## 🔍 Finding Things

**"I need to change signup"**
→ Look in `/app/api/signup/route.ts`

**"How do I protect a route"**
→ See `/lib/auth.ts` and examples in API files

**"Where are auth hooks"**
→ `/hooks/useAuth.ts` for client-side

**"How to use auth in components"**
→ See `/app/(auth)/login/page.tsx` for example

**"What's the database schema"**
→ See `/app/db/models/` and UserDocument interface

**"Auth isn't working"**
→ Check `.env`, NextAuth config, and browser cookies

**"Need to add a new auth endpoint"**
→ Create `/app/api/your-endpoint/route.ts` and use auth utilities

---

## 📚 Reading Order for Developers

1. Start: `QUICK_REFERENCE.md` - Overview
2. Then: `IMPLEMENTATION_SUMMARY.md` - What's implemented
3. When coding: `docs/AUTH.md` - Detailed reference
4. For files: This FILE_STRUCTURE.md

---

**All files are properly typed with TypeScript and ready for production use! 🎉**
