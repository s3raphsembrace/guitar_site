# 🔧 Debug Logging Summary

## What Was Added

Comprehensive debug logging has been added to help identify signup/login issues:

### Modified Files

1. **`/app/api/signup/route.ts`** - Server-side signup with 11-step debug logging
2. **`/app/api/auth/[...nextauth]/route.ts`** - Auth authorize function with detailed logging
3. **`/hooks/useAuth.ts`** - Client-side login and signup with logging

---

## Debug Output Locations

| Component | Logs Appear In | What It Shows |
|-----------|---|---|
| Signup Request | Browser Console | Client-side signup flow |
| Signup Request | Terminal | Server-side signup processing |
| Login Request | Browser Console | Client-side login flow |
| Login Request | Terminal | Server-side authentication |

---

## Server-Side Signup (Terminal)

The signup endpoint now logs 11 detailed steps:

```
1️⃣  Parsing request body - extracts username, email, password
2️⃣  Validating required fields - checks all fields present
3️⃣  Validating email format - ensures proper email syntax
4️⃣  Validating password length - checks 6+ characters
5️⃣  Connecting to MongoDB - establishes database connection
     └─ Database: guitar_academy
     └─ Collection: users

6️⃣  Checking if user already exists - searches by email
7️⃣  Hashing password - bcryptjs with 10 salt rounds
8️⃣  Generating user ID - creates unique identifier
9️⃣  Preparing user document - builds complete user object
     └─ id, name, email, password, totalScore, totalLevels, bestAccuracy, createdAt, updatedAt

🔟 Inserting user into database - saves to MongoDB
   └─ Logs: Inserted ID, Acknowledged status

1️⃣1️⃣ Verifying user was created - confirms in database
```

---

## Server-Side Login (Terminal)

The auth authorize function now logs 3 detailed steps:

```
🔐 Credentials provided - shows email and password length

1️⃣  Connecting to MongoDB
     └─ Client connection
     └─ Database: guitar_academy
     └─ Collection: users

2️⃣  Searching for user - looks up by email
     └─ If found: shows user id, name, email, hasPassword
     └─ If not found: error message

3️⃣  Verifying password
     └─ Hash length from database
     └─ Password length from form
     └─ bcrypt.compare result (match/no match)
```

---

## Client-Side Logs (Browser F12 → Console)

### Signup Flow

```
========== CLIENT SIGNUP START ==========
📝 Signup data: { username, email, passwordLength }
1️⃣ Sending signup request to /api/signup
2️⃣ Response received
   └─ Status code
   └─ OK status
   └─ Response data (message, userId, email)
✅ SIGNUP COMPLETE - Success!
   └─ User ID that was created
========== CLIENT SIGNUP END ==========
```

### Login Flow

```
========== CLIENT LOGIN START ==========
🔓 Login attempt: { email, passwordLength }
1️⃣ Calling signIn with credentials...
2️⃣ SignIn result
   └─ error value
   └─ ok status
   └─ status code
✅ Login successful, redirecting...
========== CLIENT LOGIN END ==========
```

---

## What to Look For

### Success Indicators ✅

Server Terminal:
- All 1️⃣ through 1️⃣1️⃣ steps show ✅
- "SIGNUP COMPLETE - Success!"
- "Acknowledged: true"
- User verified in database

Browser Console:
- "CLIENT SIGNUP START"
- "Status: 201"
- "OK: true"
- "SIGNUP COMPLETE - Success!"

### Problem Indicators ❌

Server Terminal:
- ❌ appears for specific step
- "ERROR OCCURRED"
- Error message after "Full error:"

Browser Console:
- "Status: 400" or "Status: 500"
- "OK: false"
- Error details in response

---

## Each Log Entry Explained

### 1️⃣ Parsing Request Body
**What:** Extracts the form data
**Expected:** Username, email, and password values
**Problem:** Check form fields match: `username`, `email`, `password`

### 2️⃣ Validating Required Fields
**What:** Checks all fields are present and non-empty
**Expected:** ✅ All required fields present
**Problem:** Username, email, or password is empty

### 3️⃣ Validating Email Format
**What:** Ensures email has proper syntax (user@domain.com)
**Expected:** ✅ Email format valid
**Problem:** Email missing @, domain, or other parts

### 4️⃣ Validating Password Length
**What:** Checks password is at least 6 characters
**Expected:** ✅ Password length valid
**Problem:** Password too short (< 6 chars)

### 5️⃣ Connecting to MongoDB
**What:** Establishes connection to database
**Expected:** ✅ MongoDB client connected
**Problem:** Connection refused, wrong URL, MongoDB down

### 6️⃣ Checking If User Exists
**What:** Searches database for existing email
**Expected:** ✅ Email is unique, no existing user found
**Problem:** ❌ User already exists with this email

### 7️⃣ Hashing Password
**What:** Encrypts password with bcryptjs
**Expected:** ✅ Password hashed successfully
**Problem:** Bcrypt library issue (rare)

### 8️⃣ Generating User ID
**What:** Creates unique identifier for user
**Expected:** ✅ User ID generated: [ID value]
**Problem:** Very rare, usually bcrypt issue

### 9️⃣ Preparing User Document
**What:** Creates JavaScript object with all user fields
**Expected:** Complete user document with all fields
**Problem:** Missing field in document (check schema)

### 🔟 Inserting User Into Database
**What:** Saves user document to MongoDB
**Expected:** ✅ User inserted successfully
**Problem:** ❌ Database write error, check MongoDB permissions

### 1️⃣1️⃣ Verifying User Was Created
**What:** Reads back user to confirm
**Expected:** ✅ User verified in database
**Problem:** ⚠️ Warning: User not found (timing issue, usually OK)

---

## Troubleshooting Flowchart

```
Try to Sign Up
    ├─ Browser shows error → Check browser console
    │   ├─ Client logs never appear → Network issue
    │   ├─ Status 400 → Check form data (empty fields?)
    │   └─ Status 500 → Check server logs
    │
    └─ Server shows error at step:
        ├─ 1️⃣-4️⃣ → Validation issue
        │   └─ Check form inputs
        ├─ 5️⃣ → MongoDB connection
        │   └─ Check MONGODB_URI in .env
        │   └─ Check MongoDB is running
        ├─ 6️⃣ → User exists
        │   └─ Use different email
        ├─ 7️⃣-8️⃣ → Password hashing (rare)
        │   └─ Restart dev server
        └─ 9️⃣-1️⃣1️⃣ → Database write
            └─ Check MongoDB permissions
```

---

## How to Run with Debug Logs

1. **Start dev server**
   ```bash
   npm run dev
   ```

2. **Keep BOTH windows visible:**
   - Terminal (for server logs)
   - Browser DevTools (for client logs)

3. **Try signup:**
   - Look at BOTH console outputs
   - Find where it fails
   - Fix the issue

4. **Check MongoDB:**
   ```bash
   # In MongoDB client
   use guitar_academy
   db.users.find({})  // See your user
   ```

---

## Log Format Meaning

```
✅ = Success - this step completed OK
❌ = Failure - this step failed
⚠️ = Warning - something unexpected but might be OK
📦 = Data - showing request/response data
🔒 = Security - showing password-related actions
👤 = User - showing user information
📧 = Email - showing email information
1️⃣ = Step number - what number step in the process
```

---

## Sharing Debug Logs for Help

If you need help, share:

1. **The entire terminal output** from signup attempt
2. **The entire browser console** from signup attempt
3. **Your .env MongoDB URI** (hide secrets)
4. **The exact error message** displayed

Example good log share:
```
========== SIGNUP REQUEST START ==========
Method: POST
...
❌ ERROR OCCURRED
Error type: MongoError
Error message: connect ECONNREFUSED 10.255.255.254:27017
```

This clearly shows: MongoDB connection failed

---

## Performance Notes

- The detailed logging has minimal performance impact
- On production, you can remove the console.log calls
- For now, keep them for debugging

---

**Now you have complete visibility into the signup/login flow! 🎉**

Run `npm run dev` and try signing up - check both terminal and browser console!
