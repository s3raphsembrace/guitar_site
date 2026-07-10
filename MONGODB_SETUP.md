# ⚙️ MongoDB Setup for Guitar Site

## Current Situation
- Linux environment doesn't have Docker or MongoDB installed
- Need external MongoDB instance

## 🚀 BEST OPTION: MongoDB Atlas (Cloud - Easiest)

### Step 1: Create Free MongoDB Account
1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up for free
3. Click "Create a Project"
4. Click "Create a Deployment" (select M0 Free Tier)
5. Choose AWS, any region
6. Create cluster (takes ~2 minutes)

### Step 2: Get Connection String
1. Click "Connect"
2. Choose "Drivers" → Node.js v5.9 or later
3. Copy the connection string
4. It will look like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`

### Step 3: Update .env
Edit `/home/skuangster/guitar_site/.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/guitar-game
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

Replace `username`, `password`, and `cluster0.xxxxx` with your actual values.

### Step 4: Start Dev Server
```bash
cd /home/skuangster/guitar_site
npm run dev
```

### Step 5: Test Everything
1. Open: http://localhost:3000/login
2. Click "Sign Up"
3. Enter credentials and sign up
4. Check console for success message

---

## Alternative: Windows MongoDB

If you have MongoDB installed on Windows:

### Step 1: Start on Windows
Open Command Prompt/PowerShell on Windows:
```powershell
mongod
```

Keep it running.

### Step 2: Update .env in WSL2
```env
MONGODB_URI=mongodb://10.255.255.254:27017/guitar-game
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

### Step 3: Start Dev Server in WSL2
```bash
npm run dev
```

---

## Alternative: Install MongoDB in WSL2

If you want local MongoDB in WSL2:

```bash
# Update package lists
sudo apt-get update

# Install MongoDB
curl https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

Then use:
```env
MONGODB_URI=mongodb://localhost:27017/guitar-game
```

---

## Quick Decision Guide

| Option | Setup Time | Cost | Best For |
|--------|-----------|------|----------|
| **MongoDB Atlas** | 5 min | Free (12 months) | ✅ Everyone |
| **Windows MongoDB** | Already have it | Free | If installed on Windows |
| **WSL2 MongoDB** | 10 min + sudo | Free | Local development |

---

## RECOMMENDED: Use MongoDB Atlas Right Now

1. Go to: https://www.mongodb.com/cloud/atlas
2. Create account (2 minutes)
3. Create cluster (takes ~2 minutes)
4. Get connection string
5. Paste in .env
6. Run: `npm run dev`
7. Test at: http://localhost:3000/login

**Total time: ~10 minutes, then you're ready!**
