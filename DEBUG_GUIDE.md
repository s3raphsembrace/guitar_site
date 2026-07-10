# 🐛 Signup Debug Guide

## How to Use Debug Logs

All signup and login operations now log detailed information to help identify issues.

### Where to Find Logs

1. **Server Logs** - Terminal/Console where you ran `npm run dev`
2. **Browser Logs** - Press `F12` → Console tab

---

## 🔄 Signup Flow with Expected Logs

### Client Side (Browser Console)

You should see:
```
========== CLIENT SIGNUP START ==========
📝 Signup data: { username: "john", email: "john@example.com", passwordLength: 8 }
1️⃣ Sending signup request to /api/signup
2️⃣ Response received
   Status: 201
   OK: true
   Response data: { message: "User created successfully", userId: "..." }
✅ SIGNUP COMPLETE - Success!
   User ID: odc4oi5ujb
========== CLIENT SIGNUP END ==========
```

### Server Side (Terminal)

You should see:
```
========== SIGNUP REQUEST START ==========
Method: POST
URL: http://localhost:3000/api/signup
1️⃣ Parsing request body...
📦 Request body: { username: "john", email: "john@example.com", password: "password123" }
👤 Username: john
📧 Email: john@example.com
🔒 Password received: true (Length: 8)

2️⃣ Validating required fields...
✅ All required fields present

3️⃣ Validating email format...
✅ Email format valid

4️⃣ Validating password length...
✅ Password length valid

5️⃣ Connecting to MongoDB...
✅ MongoDB client connected

✅ Database selected: guitar_academy

✅ Users collection accessed

6️⃣ Checking if user already exists...
   Searching for email: john@example.com
✅ Email is unique, no existing user found

7️⃣ Hashing password...
   Salt rounds: 10
✅ Password hashed successfully
   Hash length: 60

8️⃣ Generating user ID...
✅ User ID generated: odc4oi5ujb

9️⃣ Preparing user document...
📋 User document to insert:
{
  "id": "odc4oi5ujb",
  "name": "john",
  "email": "john@example.com",
  "password": "$2a$10$...",
  "totalScore": 0,
  "totalLevels": 0,
  "bestAccuracy": 0,
  "createdAt": "2026-02-21T...",
  "updatedAt": "2026-02-21T..."
}

🔟 Inserting user into database...
   Database: guitar_academy
   Collection: users
✅ User inserted successfully
   Inserted ID: 60a7b4c1e3d2f1a0c5b8e9d0
   Acknowledged: true

1️⃣1️⃣ Verifying user was created...
✅ User verified in database
   Found user with ID: odc4oi5ujb
   Email: john@example.com

✅ SIGNUP COMPLETE - Success!
========== SIGNUP REQUEST END ==========
```

---

## ❌ Common Issues & How to Recognize Them

### Issue: Missing Fields

**Client Log:**
```
📝 Signup data: { username: "", email: "john@example.com", passwordLength: 8 }
```

**Server Log:**
```
❌ Username is missing
```

**Fix:** Make sure all fields are filled in the form

### Issue: Invalid Email

**Server Log:**
```
❌ Invalid email format: john.example.com
```

**Fix:** Email must have format: `user@example.com`

### Issue: Password Too Short

**Server Log:**
```
❌ Password too short: 5 < 6
```

**Fix:** Password must be at least 6 characters

### Issue: Email Already Exists

**Server Log:**
```
❌ User already exists with this email
   Found user: 60a7b4c1e3d2f1a0c5b8e9d0
```

**Fix:** Use a different email address

### Issue: Database Connection Failed

**Server Log:**
```
❌ ERROR OCCURRED
Error type: MongoError
Error message: connect ECONNREFUSED 10.255.255.254:27017
```

**Fix:**
- Check MongoDB is running
- Verify MONGODB_URI in `.env` is correct
- Check network connection to MongoDB

### Issue: Database Name Wrong

**Server Log:**
```
✅ Database selected: wrong_database
...
❌ User inserted successfully (but not where expected)
```

**Fix:**
- Check code is using `guitar_academy`
- Verify database name in MongoDB

### Issue: Collection Missing

**Server Log:**
```
✅ Users collection accessed
...
❌ ERROR: collection does not exist
```

**Fix:**
- MongoDB creates collections automatically on first insert
- If error persists, database connection issue

---

## 🔍 How to Debug Step-by-Step

### Step 1: Check Client Console
Open browser (F12) and try signup. Look for:
- ✅ Does it show "CLIENT SIGNUP START"?
- ✅ Does response status show 201?
- ❌ What error appears?

### Step 2: Check Server Logs
Look at terminal where `npm run dev` is running for:
- ✅ Does it show "SIGNUP REQUEST START"?
- ✅ What step number fails? (1️⃣, 2️⃣, etc.)
- ❌ What error message?

### Step 3: Verify MongoDB
Open MongoDB compass or client:
```sql
use guitar_academy
db.users.find({})  // Should show your user
```

### Step 4: Check .env
Make sure `.env` has:
```
MONGODB_URI=mongodb://10.255.255.254:27017/guitar-game
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 📋 Checklist for Successful Signup

- [ ] Browser console shows "CLIENT SIGNUP START"
- [ ] Terminal shows "SIGNUP REQUEST START"
- [ ] Terminal shows step 1️⃣-1️⃣1️⃣ completing (11 steps)
- [ ] Terminal shows "✅ SIGNUP COMPLETE - Success!"
- [ ] Browser shows success message
- [ ] Can then log in with same credentials
- [ ] User appears in MongoDB

---

## 🔐 Login Flow with Logs

### Client Side

```
========== CLIENT LOGIN START ==========
🔓 Login attempt: { email: "john@example.com", passwordLength: 8 }
1️⃣ Calling signIn with credentials...
2️⃣ SignIn result: {
  error: null,
  ok: true,
  status: 200
}
✅ Login successful, redirecting...
========== CLIENT LOGIN END ==========
```

### Server Side

```
========== AUTH AUTHORIZE START ==========
🔐 Credentials provided: {
  email: "john@example.com",
  passwordLength: 8
}

1️⃣ Connecting to MongoDB...
✅ MongoDB client connected

✅ Database selected: guitar_academy

✅ Users collection accessed

2️⃣ Searching for user with email: john@example.com
✅ User found: {
  id: "odc4oi5ujb",
  name: "john",
  email: "john@example.com",
  hasPassword: true
}

3️⃣ Verifying password...
   Stored hash length: 60
   Provided password length: 8
✅ Password matches

✅ AUTH AUTHORIZE COMPLETE - Success!
========== AUTH AUTHORIZE END ==========
```

---

## 🚨 Login Issues

### Issue: User Not Found

**Server Log:**
```
❌ No user found with email: john@example.com
   Available users query: Check database directly
```

**Fix:**
- Make sure user was successfully created first
- Check email spelling matches exactly
- Try signing up again

### Issue: Wrong Password

**Server Log:**
```
❌ Password does not match
```

**Fix:**
- Check caps lock is off
- Verify password is correct
- Try signing up with new password

### Issue: Database Not Connected

Same as signup - check MongoDB connection

---

## 💡 Pro Tips

1. **Keep Terminal Visible** - See errors as they happen
2. **Keep Browser Console Open** - See client-side issues
3. **Copy-Paste Logs** - Save logs if reporting issues
4. **Test with Simple Data** - Use simple email/password for testing
5. **Clear Browser Data** - Sometimes old sessions interfere

---

## 📞 What to Share If Stuck

If you're stuck, share:

1. **Full client console log** (F12 → Console)
2. **Full server terminal log** - Signup request section
3. **MongoDB user collection** content
4. **Error message** from browser
5. **Contents of .env** (hide secrets)

This will help identify the exact issue!

---

## ✅ Testing Checklist

```bash
# 1. Make sure MongoDB is running
# 2. Make sure .env is configured
# 3. Run dev server
npm run dev

# 4. Open browser to http://localhost:3000/login
# 5. Open developer console (F12)
# 6. Try signup with:
#    Username: testuser
#    Email: test@example.com
#    Password: password123

# 7. Check both browser console and terminal for logs
# 8. If successful, try login with same email/password
```

Good luck debugging! 🎉
