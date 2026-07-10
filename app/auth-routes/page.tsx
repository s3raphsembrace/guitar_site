import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auth Routes - Guitar Site API",
};

/**
 * COMPLETE LIST OF AUTHENTICATION ENDPOINTS
 *
 * All endpoints are fully implemented and ready to use.
 */

const AuthEndpoints = {
  // NextAuth Auto-Generated Routes (Dynamic [...nextauth] handler)
  "POST /api/auth/signin": {
    description: "Sign in with credentials",
    body: { email: "string", password: "string" },
    response: "Redirects to callback URL or returns session",
  },

  "GET /api/auth/session": {
    description: "Get current session information",
    auth: false,
    response: "{ user: { id, name, email }, expires }",
  },

  "POST /api/auth/signout": {
    description: "Sign out current user",
    auth: false,
    response: "Redirects to /login",
  },

  "GET /api/auth/providers": {
    description: "List available authentication providers",
    auth: false,
    response: "{ credentials: { ... } }",
  },

  "GET /api/auth/csrf": {
    description: "Get CSRF token for form submissions",
    auth: false,
    response: "{ csrfToken: string }",
  },

  "GET /api/auth/callback/credentials": {
    description: "Callback endpoint for credential provider",
    auth: false,
    response: "Handles NextAuth callback",
  },

  // Custom Routes
  "POST /api/signup": {
    description: "Create a new user account",
    auth: false,
    body: { username: "string", email: "string", password: "string" },
    response: "{ message: string, userId: string }",
    status: "201 Created",
  },

  "POST /api/login": {
    description: "Login endpoint (alternative to /api/auth/signin)",
    auth: false,
    body: { email: "string", password: "string" },
    response: "{ message: string, user: { id, name, email } }",
  },

  "GET /api/session": {
    description: "Get session details (includes expiry)",
    auth: false,
    response: "{ ok: true, user: { ... }, session: { expires } }",
  },

  "POST /api/signout": {
    description: "Server-side sign out handler",
    auth: false,
    response: "{ ok: true, message: string }",
  },

  // User Profile Routes
  "GET /api/user": {
    description: "Get current authenticated user profile",
    auth: true,
    response: "{ ok: true, user: { id, name, email, totalScore, totalLevels, bestAccuracy, createdAt, updatedAt } }",
  },

  "PATCH /api/user": {
    description: "Update current user profile",
    auth: true,
    body: { name: "string (optional)" },
    response: "{ ok: true, user: { ... } }",
  },

  // Protected Game Routes (require auth)
  "POST /api/scores": {
    description: "Submit a game score",
    auth: true,
    body: { userId: "string", levelId: "string", score: "number", hits: "number", misses: "number", accuracy: "number" },
    response: "{ ok: true, message: string }",
  },

  // Protected Level Management (require auth)
  "POST /api/levels": {
    description: "Create a new level",
    auth: true,
    body: "{ title, artist, bpm, difficulty, category, durationMs, notes: [] }",
    response: "{ ok: true, id: string }",
  },

  "PATCH /api/levels/[id]": {
    description: "Update an existing level",
    auth: true,
    response: "{ ok: true, data: { ... } }",
  },

  "DELETE /api/levels/[id]": {
    description: "Delete a level",
    auth: true,
    response: "{ ok: true, message: string }",
  },

  // Protected Multiplayer Routes (require auth)
  "POST /api/rooms": {
    description: "Create a multiplayer room",
    auth: true,
    body: { levelId: "string" },
    response: "{ roomCode: string }",
  },

  "PUT /api/rooms/[code]": {
    description: "Join or update multiplayer room",
    auth: true,
    body: "{ playerAction: 'join', playerName: string } | any other update",
    response: "{ ok: true, room: { ... } }",
  },
};

export default function AuthRoutesInfo() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Guitar Site Authentication Routes</h1>
      <p className="text-gray-600 mb-8">
        All authentication endpoints have been fully implemented. See `/docs/AUTH.md` for detailed documentation.
      </p>

      <div className="bg-blue-50 p-4 rounded mb-8 border border-blue-200">
        <h2 className="font-bold text-blue-900 mb-2">✅ All Routes Implemented</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• NextAuth auto-generated routes (/api/auth/*)</li>
          <li>• Custom signup and login endpoints</li>
          <li>• Session management endpoints</li>
          <li>• User profile endpoints</li>
          <li>• Protected game routes (scores, levels, rooms)</li>
          <li>• Full JWT authentication</li>
          <li>• Client-side hooks (useAuth, useRequireAuth)</li>
          <li>• Server-side utilities (getAuthSession, getCurrentUser)</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(AuthEndpoints).map(([endpoint, details]: any) => (
          <div key={endpoint} className="border p-4 rounded bg-gray-50">
            <code className="block font-mono text-sm font-bold text-gray-900 mb-2">
              {endpoint}
            </code>
            <p className="text-sm text-gray-700 mb-2">{details.description}</p>
            {details.auth && (
              <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mb-2">
                🔒 Auth Required
              </span>
            )}
            {details.status && (
              <p className="text-xs text-gray-600">Status: {details.status}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
