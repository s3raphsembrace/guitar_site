# Quick Reference: Authentication Routes & Usage

## 🚀 Quick Start

```bash
npm run dev
# Visit http://localhost:3000/login
```

## 📚 Available Routes

### Sign Up / Login
- **Page**: `/login` - Combined signup/login page
- **POST /api/signup** - Create account
- **POST /api/auth/signin** - Login

### Session Management
- **GET /api/auth/session** - NextAuth session endpoint
- **GET /api/session** - Custom session endpoint with expiry
- **POST /api/auth/signout** - NextAuth logout
- **POST /api/signout** - Custom logout endpoint

### User Profile
- **GET /api/user** - Current user details (protected)
- **PATCH /api/user** - Update profile (protected)

### Game (Protected)
- **POST /api/scores** - Submit score
- **POST /api/levels** - Create level
- **PATCH /api/levels/[id]** - Update level
- **DELETE /api/levels/[id]** - Delete level

### Multiplayer (Protected)
- **POST /api/rooms** - Create room
- **GET /api/rooms/[code]** - Get room details
- **PUT /api/rooms/[code]** - Join/update room

---

## 🔐 Client-Side Authentication

### useAuth Hook

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function Component() {
  const {
    login,
    signup,
    logout,
    user,
    isAuthenticated,
    isLoading
  } = useAuth();

  // Login
  const handleLogin = async () => {
    const result = await login('email@example.com', 'password123');
    if (result.ok) {
      // Login successful, auto-redirects to /
    } else {
      console.error(result.error);
    }
  };

  // Signup
  const handleSignup = async () => {
    const result = await signup('john', 'john@example.com', 'password123');
    if (result.ok) {
      // Switch to login mode
    } else {
      console.error(result.error);
    }
  };

  // Check authentication
  if (!isAuthenticated) return <div>Not logged in</div>;

  return (
    <div>
      <p>Welcome {user?.name}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

### useRequireAuth Hook

```typescript
import { useRequireAuth } from '@/hooks/useAuth';

export default function ProtectedPage() {
  const { isAuthenticated, isLoading } = useRequireAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null; // Auto-redirects to /login

  return <div>This page requires login</div>;
}
```

---

## 🖥️ Server-Side Authentication

### getAuthSession()

```typescript
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  // Proceed with authenticated logic
}
```

### getCurrentUser()

```typescript
import { getCurrentUser } from '@/lib/auth';

const user = await getCurrentUser();
if (user) {
  console.log(user.id, user.email, user.name);
}
```

### isAuthenticated()

```typescript
import { isAuthenticated } from '@/lib/auth';

if (await isAuthenticated()) {
  // User is logged in
}
```

---

## 🔒 Protecting API Routes

```typescript
import { getToken } from "next-auth/jwt";

export async function POST(req: Request) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = token.id;
  // Proceed
}
```

---

## 📝 Example: Protected Game Route

```typescript
// app/api/game/submit-score/route.ts
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  // Check authentication
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { levelId, score, hits, misses, accuracy } = await req.json();

  // Save to database
  const client = await clientPromise;
  const db = client.db("guitar_academy");

  const result = await db.collection("scores").insertOne({
    userId: session.user.id,
    levelId,
    score,
    hits,
    misses,
    accuracy,
    createdAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    message: "Score saved"
  });
}
```

---

## 🎮 Game Page Integration

The game page automatically:
1. Gets user session with `useSession()`
2. On game end → submits score to `/api/scores`
3. Includes: userId, levelId, score, hits, misses, accuracy
4. Updates user stats in database

```typescript
export default function GamePage() {
  const { data: session } = useSession();

  // When game ends:
  const submitScore = async () => {
    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        levelId: levelId,
        score: score,
        hits: hits,
        misses: misses,
        accuracy: accuracy,
      }),
    });
  };
}
```

---

## 🔄 Authentication Flow

### Sign Up
1. User fills form on `/login` (Sign Up tab)
2. POST `/api/signup` with username, email, password
3. Password hashed with bcryptjs
4. User created in MongoDB
5. Redirected to login tab
6. User logs in normally

### Login
1. User enters email/password on `/login`
2. POST `/api/auth/signin` with credentials
3. NextAuth validates against database
4. JWT token created
5. User redirected to home `/`
6. Session available on all protected routes

### Protected Actions
1. User plays game at `/game/[levelId]`
2. Session attached to requests
3. Game ends → POST `/api/scores`
4. Token validated server-side
5. Score saved to database
6. User stats updated

---

## 🛡️ Validation Rules

### Signup
- **Username**: 2+ characters, required
- **Email**: Valid email format, required
- **Password**: 6+ characters, required
- **Confirm**: Must match password

### Login
- **Email**: Required
- **Password**: Required

### What Happens
- Invalid data → Clear error message shown
- Form shake animation
- Fields remain for correction
- No server request until local validation passes

---

## 📊 Environment Variables

```bash
# .env (required for running)
MONGODB_URI=mongodb://10.255.255.254:27017/guitar-game
NEXTAUTH_SECRET=change-me-in-production
NEXTAUTH_URL=http://localhost:3000
```

For production:
- Generate strong NEXTAUTH_SECRET: `openssl rand -base64 32`
- Update NEXTAUTH_URL to your domain
- Use production MongoDB connection string

---

## 🧪 Testing Routes

```bash
# Create account
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@test.com","password":"pass123"}'

# Get session
curl http://localhost:3000/api/auth/session

# Get user profile (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/user

# Submit score (requires auth)
curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId":"...","levelId":"...","score":1000}'
```

---

## 🐛 Common Issues & Fixes

**Q: Login not working**
- Check NEXTAUTH_SECRET is set in .env
- Verify MongoDB is running
- Check user email matches signup email (case-sensitive)

**Q: Sessions not persisting**
- Ensure AuthProvider wraps app in layout.tsx
- Check cookies are enabled in dev tools
- Verify NEXTAUTH_URL is correct

**Q: Protected routes returning 401**
- Check JWT token is being sent with request
- Verify getAuthSession() is called
- Check NEXTAUTH_SECRET matches between client/server

**Q: Passwords not hashing**
- Verify bcryptjs is installed
- Check signup hits 10 salt rounds
- Verify no typos in password field names

---

## 📖 Full Documentation

- `IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `docs/AUTH.md` - Detailed auth endpoint documentation
- `/auth-routes` - Visual reference of all routes

---

## 🎯 Next Steps

1. **Test flow** - Sign up, login, play game
2. **Create leaderboard** - Query scores, rank by user
3. **Add admin panel** - Manage levels
4. **Implement multiplayer** - Real-time room sync with WebSockets
5. **Add more providers** - Google, GitHub OAuth

Everything is ready to use! Happy coding! 🚀
