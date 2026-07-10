# Guitar Site Authentication Routes

This document outlines all the authentication endpoints and their usage.

## NextAuth Routes (Auto-generated)

These routes are automatically provided by the NextAuth handler at `/app/api/auth/[...nextauth]/route.ts`:

### POST /api/auth/signin
Sign in with credentials.
- **Body**: `{ email: string, password: string }`
- **Response**: Redirects or returns session

### GET /api/auth/session
Get the current user session.
- **Response**: `{ user: { id, name, email }, expires }`

### POST /api/auth/signout
Sign out the current user.
- **Response**: Redirects to login page

### GET /api/auth/providers
Get available authentication providers.
- **Response**: List of provider info

### GET /api/auth/csrf
Get CSRF token.
- **Response**: `{ csrfToken }`

## Custom API Routes

### POST /api/signup
Create a new user account.
- **Body**: `{ username: string, email: string, password: string }`
- **Response**: `{ message: string, userId: string }`
- **Status**: 201 (Created), 400 (Bad Request), 500 (Server Error)

### GET /api/user
Get current authenticated user details.
- **Auth**: Required (JWT Token)
- **Response**:
```json
{
  "ok": true,
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "totalScore": number,
    "totalLevels": number,
    "bestAccuracy": number
  }
}
```

### PATCH /api/user
Update current user profile.
- **Auth**: Required (JWT Token)
- **Body**: `{ name?: string }`
- **Response**: Updated user object

### GET /api/session
Get current session details.
- **Response**:
```json
{
  "ok": true,
  "user": { "id", "email", "name" },
  "session": { "expires" }
}
```
- **Status**: 200 (OK), 401 (Unauthorized)

### POST /api/signout
Handle sign out.
- **Response**: `{ ok: true, message: "Sign out successful" }`

## Client-Side Hooks

### useAuth()
Main authentication hook for client components.

```typescript
const {
  session,              // Current session object
  isAuthenticated,      // Boolean if user is logged in
  isLoading,           // Boolean if auth is loading
  user,                // Current user object
  login,               // Async function to login
  logout,              // Async function to logout
  signup               // Async function to signup
} = useAuth();
```

Example usage:
```typescript
const { login, isLoading } = useAuth();

const handleLogin = async () => {
  const result = await login(email, password);
  if (result.ok) {
    // Login successful, redirect happens automatically
  } else {
    // Show error: result.error
  }
};
```

### useRequireAuth()
Hook to protect pages that require authentication.

```typescript
const { isAuthenticated, isLoading } = useRequireAuth();

if (isLoading) return <div>Loading...</div>;
if (!isAuthenticated) return null; // Redirects to /login
```

## Server-Side Utilities

### getAuthSession()
Get the current user session on the server.

```typescript
import { getAuthSession } from '@/lib/auth';

const session = await getAuthSession();
if (session?.user?.id) {
  // User is authenticated
}
```

### getCurrentUser()
Get detailed info about the current user.

```typescript
import { getCurrentUser } from '@/lib/auth';

const user = await getCurrentUser();
if (user) {
  console.log(user.id, user.email, user.name);
}
```

### isAuthenticated()
Check if a user is authenticated.

```typescript
import { isAuthenticated } from '@/lib/auth';

if (await isAuthenticated()) {
  // User is logged in
}
```

## Protected API Routes

These routes require authentication (JWT Token):

- **POST /api/levels** - Create a new level
- **PATCH /api/levels/[id]** - Update a level
- **DELETE /api/levels/[id]** - Delete a level
- **POST /api/rooms** - Create a multiplayer room
- **PUT /api/rooms/[code]** - Update room (join players, change status)
- **POST /api/scores** - Submit a game score

## Authentication Flow

1. **User Signs Up**:
   - POST `/api/signup` with username, email, password
   - Creates user in MongoDB with hashed password

2. **User Logs In**:
   - POST `/api/auth/signin` or use `signIn()` from next-auth/react
   - Credentials are verified against database
   - JWT session token is created

3. **User Authenticated**:
   - Session available in `useSession()` hook
   - JWT token sent automatically with protected API requests
   - User ID available in `session.user.id`

4. **User Logs Out**:
   - POST `/api/auth/signout` or use `signOut()` from next-auth/react
   - Session is cleared
   - Redirects to login page

## Error Handling

All auth endpoints return appropriate HTTP status codes:

- **200** - Success
- **201** - Resource created
- **400** - Bad request (missing fields, invalid data)
- **401** - Unauthorized (not authenticated or invalid credentials)
- **404** - Resource not found
- **500** - Server error

Error responses include a `message` or `error` field describing the problem.

## Security Notes

- Passwords are hashed with bcryptjs (10 salt rounds)
- JWT tokens expire after 30 days
- CSRF protection enabled
- NextAuth secret configurable via `NEXTAUTH_SECRET` env var
- Protected routes validate JWT tokens server-side
