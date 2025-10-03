** Document your bugs here **

# Bankly Application - Bug Fixes Documentation 

## 📋 Table of Contents
- [Overview](#overview)
- [Bug Summary](#bug-summary)
- [Detailed Bug Reports](#detailed-bug-reports)
  - [Bug #1: JWT Token Not Verified](#bug-1-jwt-token-not-verified)
  - [Bug #2: Missing await on User.authenticate()](#bug-2-missing-await-on-userauthenticate)
  - [Bug #3: Missing throw in User.get()](#bug-3-missing-throw-in-userget)
  - [Bug #4: Missing await on User.delete()](#bug-4-missing-await-on-userdelete)
  - [Bug #5: Broken Authorization for PATCH](#bug-5-broken-authorization-for-patch)
  - [Bug #6: Password Exposed in Response](#bug-6-password-exposed-in-response)
  - [Bug #7: Unused Parameters in User.getAll()](#bug-7-unused-parameters-in-usergetall)
- [Running Tests](#running-tests)
- [Setup Instructions](#setup-instructions)

---

## Overview

This document details **7 critical bugs** discovered in the Bankly banking application. Each bug includes:
- A clear description of the problem
- The impact on the application
- The exact location in the code
- A test that catches the bug
- The fix with proper comments

---

## Bug Summary

| # | Severity | Issue | File | Status |
|---|----------|-------|------|--------|
| 1 | 🔴 **CRITICAL** | JWT tokens not verified - complete auth bypass | `middleware/auth.js` | ✅ Fixed |
| 2 | 🟠 **HIGH** | Missing `await` breaks admin login tokens | `routes/auth.js` | ✅ Fixed |
| 3 | 🟠 **HIGH** | Missing `throw` returns undefined instead of 404 | `models/user.js` | ✅ Fixed |
| 4 | 🟡 **MEDIUM** | Missing `await` on delete creates race condition | `routes/users.js` | ✅ Fixed |
| 5 | 🟠 **HIGH** | Users can't update their own profiles | `routes/users.js` | ✅ Fixed |
| 6 | 🟡 **MEDIUM** | Password hash exposed in API response | `models/user.js` | ✅ Fixed |
| 7 | 🟢 **LOW** | Confusing unused parameters | `models/user.js` | ✅ Fixed |

---

## Detailed Bug Reports

### Bug #1: JWT Token Not Verified

**🔴 Severity:** CRITICAL - Complete authentication bypass

#### Description
The authentication middleware uses `jwt.decode()` instead of `jwt.verify()`. This means tokens are decoded but **never verified**. Anyone can create a fake token with any username and admin privileges.

#### Impact
- ⚠️ Complete authentication bypass
- ⚠️ Attackers can impersonate any user
- ⚠️ Admin privileges can be falsely claimed
- ⚠️ All protected routes are vulnerable

#### Location
**File:** `middleware/auth.js`  
**Line:** 49

#### The Bug
```javascript
function authUser(req, res, next) {
  try {
    const token = req.body._token || req.query._token;
    if (token) {
      let payload = jwt.decode(token);  // ❌ BUG: Only decodes, doesn't verify!
      req.curr_username = payload.username;
      req.curr_admin = payload.admin;
    }
    return next();
  } catch (err) {
    err.status = 401;
    return next(err);
  }
}
```

#### The Fix
```javascript
function authUser(req, res, next) {
  try {
    const token = req.body._token || req.query._token;
    if (token) {
      // FIXES BUG #1: Use jwt.verify() with SECRET_KEY to validate signature
      let payload = jwt.verify(token, SECRET_KEY);
      req.curr_username = payload.username;
      req.curr_admin = payload.admin;
    }
    return next();
  } catch (err) {
    err.status = 401;
    return next(err);
  }
}
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #1: JWT token must be verified, not just decoded
test('should reject forged tokens', async () => {
  // Create a forged token with wrong secret
  const forgedToken = jwt.sign(
    { username: 'hacker', admin: true }, 
    'wrong-secret'
  );
  
  const response = await request(app)
    .get('/users')
    .query({ _token: forgedToken });
  
  expect(response.statusCode).toBe(401);  // Should reject forged token
});
```

---

### Bug #2: Missing await on User.authenticate()

**🟠 Severity:** HIGH - Breaks admin authentication

#### Description
The login route calls `User.authenticate()` without `await`. This returns a **Promise object** instead of the actual user data, causing `user.admin` to be `undefined`.

#### Impact
- ⚠️ Admin users can't get proper admin tokens
- ⚠️ All tokens created with `admin: undefined`
- ⚠️ Admin-only operations fail

#### Location
**File:** `routes/auth.js`  
**Line:** 39

#### The Bug
```javascript
router.post('/login', async function(req, res, next) {
  try {
    const { username, password } = req.body;
    let user = User.authenticate(username, password);  // ❌ BUG: Missing await!
    const token = createTokenForUser(username, user.admin);  // user.admin is undefined
    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});
```

#### The Fix
```javascript
router.post('/login', async function(req, res, next) {
  try {
    const { username, password } = req.body;
    // FIXES BUG #2: Added await to properly wait for authentication
    let user = await User.authenticate(username, password);
    const token = createTokenForUser(username, user.admin);
    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #2: Login must await User.authenticate() for correct admin status
test('admin login should return token with admin=true', async () => {
  // Create an admin user in database
  const hashedPassword = await bcrypt.hash('adminpass', 1);
  await db.query(
    `INSERT INTO users (username, password, first_name, last_name, email, phone, admin)
     VALUES ('adminuser', $1, 'Admin', 'User', 'admin@test.com', '555-0000', true)`,
    [hashedPassword]
  );

  // Login as admin
  const response = await request(app)
    .post('/auth/login')
    .send({ username: 'adminuser', password: 'adminpass' });

  const decoded = jwt.verify(response.body.token, SECRET_KEY);
  expect(decoded.admin).toBe(true);  // Should have admin privileges
});
```

---

### Bug #3: Missing throw in User.get()

**🟠 Severity:** HIGH - Silent failures

#### Description
When a user doesn't exist, the code creates an error but **doesn't throw it**. The function continues and returns `undefined` instead of raising a 404 error.

#### Impact
- ⚠️ Returns `undefined` instead of proper error
- ⚠️ No 404 response for missing users
- ⚠️ Can cause crashes accessing properties on undefined
- ⚠️ Misleading API behavior

#### Location
**File:** `models/user.js`  
**Line:** 118

#### The Bug
```javascript
static async get(username) {
  const result = await db.query(
    `SELECT username, first_name, last_name, email, phone
     FROM users WHERE username = $1`,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    new ExpressError('No such user', 404);  // ❌ BUG: Created but not thrown!
  }

  return user;  // Returns undefined if user not found
}
```

#### The Fix
```javascript
static async get(username) {
  const result = await db.query(
    `SELECT username, first_name, last_name, email, phone
     FROM users WHERE username = $1`,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    // FIXES BUG #3: Added throw keyword to properly raise 404 error
    throw new ExpressError('No such user', 404);
  }

  return user;
}
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #3: User.get() should throw 404 for non-existent users
test('should throw 404 for non-existent user', async () => {
  try {
    await User.get('nonexistentuser');
    fail('Should have thrown an error');
  } catch (err) {
    expect(err.status).toBe(404);
    expect(err.message).toBe('No such user');
  }
});
```

---

### Bug #4: Missing await on User.delete()

**🟡 Severity:** MEDIUM - Race condition

#### Description
The delete route calls `User.delete()` without `await`. The response is sent **before** the database operation completes, creating a race condition.

#### Impact
- ⚠️ Response sent before deletion completes
- ⚠️ User might still exist despite success message
- ⚠️ Data integrity issues
- ⚠️ Unreliable deletion

#### Location
**File:** `routes/users.js`  
**Line:** 99

#### The Bug
```javascript
router.delete('/:username', authUser, requireAdmin, async function(req, res, next) {
  try {
    User.delete(req.params.username);  // ❌ BUG: Missing await!
    return res.json({ message: 'deleted' });  // Responds immediately
  } catch (err) {
    return next(err);
  }
});
```

#### The Fix
```javascript
router.delete('/:username', authUser, requireAdmin, async function(req, res, next) {
  try {
    // FIXES BUG #4: Added await to ensure deletion completes before responding
    await User.delete(req.params.username);
    return res.json({ message: 'deleted' });
  } catch (err) {
    return next(err);
  }
});
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #4: User.delete() must be awaited
test('should actually delete user from database', async () => {
  // Create admin and target user
  const hashedPassword = await bcrypt.hash('adminpass', 1);
  await db.query(
    `INSERT INTO users (username, password, first_name, last_name, email, phone, admin)
     VALUES ('admin', $1, 'Admin', 'User', 'admin@test.com', '555-0000', true)`,
    [hashedPassword]
  );

  await db.query(
    `INSERT INTO users (username, password, first_name, last_name, email, phone)
     VALUES ('deleteme', $1, 'Delete', 'Me', 'delete@test.com', '555-1111')`,
    [await bcrypt.hash('password', 1)]
  );

  // Get admin token and delete user
  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'admin', password: 'adminpass' });

  await request(app)
    .delete('/users/deleteme')
    .query({ _token: loginResponse.body.token });

  // Verify user is actually gone
  const result = await db.query('SELECT * FROM users WHERE username = $1', ['deleteme']);
  expect(result.rows.length).toBe(0);
});
```

---

### Bug #5: Broken Authorization for PATCH

**🟠 Severity:** HIGH - Feature completely broken

#### Description
The PATCH route includes `requireAdmin` middleware, but then checks if user is NOT admin for self-updates. Regular users **can't reach the handler** because they fail the admin check first.

#### Impact
- ⚠️ Regular users can't update their own profiles
- ⚠️ Feature is completely broken
- ⚠️ Poor user experience
- ⚠️ Authorization logic contradicts itself

#### Location
**File:** `routes/users.js`  
**Line:** 67

#### The Bug
```javascript
// ❌ BUG: requireAdmin blocks regular users from reaching the handler
router.patch('/:username', authUser, requireLogin, requireAdmin, async function(req, res, next) {
  try {
    // Regular users never reach here because of requireAdmin middleware above
    if (!req.curr_admin && req.curr_username !== req.params.username) {
      throw new ExpressError('Only that user or admin can edit a user.', 401);
    }

    let fields = { ...req.body };
    delete fields._token;
    let user = await User.update(req.params.username, fields);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});
```

#### The Fix
```javascript
// FIXES BUG #5: Removed requireAdmin to allow users to update themselves
router.patch('/:username', authUser, requireLogin, async function(req, res, next) {
  try {
    // Allow if user is admin OR updating their own profile
    if (!req.curr_admin && req.curr_username !== req.params.username) {
      throw new ExpressError('Only that user or admin can edit a user.', 401);
    }

    let fields = { ...req.body };
    delete fields._token;
    let user = await User.update(req.params.username, fields);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #5: Users should update their own profile
test('regular user can update own profile', async () => {
  const regResponse = await request(app)
    .post('/auth/register')
    .send({
      username: 'normaluser',
      password: 'password',
      first_name: 'Normal',
      last_name: 'User',
      email: 'normal@test.com',
      phone: '555-2222'
    });

  const response = await request(app)
    .patch('/users/normaluser')
    .send({
      _token: regResponse.body.token,
      first_name: 'Updated',
      email: 'updated@test.com'
    });

  expect(response.statusCode).toBe(200);
  expect(response.body.user.first_name).toBe('Updated');
});

test('user cannot update another user', async () => {
  await request(app)
    .post('/auth/register')
    .send({
      username: 'user1',
      password: 'password',
      first_name: 'User',
      last_name: 'One',
      email: 'user1@test.com',
      phone: '555-3333'
    });

  const user2Response = await request(app)
    .post('/auth/register')
    .send({
      username: 'user2',
      password: 'password',
      first_name: 'User',
      last_name: 'Two',
      email: 'user2@test.com',
      phone: '555-4444'
    });

  const response = await request(app)
    .patch('/users/user1')
    .send({
      _token: user2Response.body.token,
      first_name: 'Hacked'
    });

  expect(response.statusCode).toBe(401);
});
```

---

### Bug #6: Password Exposed in Response

**🟡 Severity:** MEDIUM - Information disclosure

#### Description
The `User.register()` method returns the hashed password in the response. Even though it's hashed, passwords should **never** be exposed in API responses.

#### Impact
- ⚠️ Sensitive data leaked
- ⚠️ Violates security best practices
- ⚠️ Potential for offline cracking attempts
- ⚠️ Information disclosure vulnerability

#### Location
**File:** `models/user.js`  
**Line:** 32

#### The Bug
```javascript
const result = await db.query(
  `INSERT INTO users 
      (username, password, first_name, last_name, email, phone) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING username, password, first_name, last_name, email, phone`,
  // ❌ BUG: Returns password in response
  [username, hashedPassword, first_name, last_name, email, phone]
);
```

#### The Fix
```javascript
const result = await db.query(
  `INSERT INTO users 
      (username, password, first_name, last_name, email, phone) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING username, first_name, last_name, email, phone`,
  // FIXES BUG #6: Removed password from RETURNING clause
  [username, hashedPassword, first_name, last_name, email, phone]
);
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #6: Password should never be in response
test('registration should not return password', async () => {
  const response = await request(app)
    .post('/auth/register')
    .send({
      username: 'secureuser',
      password: 'mysecretpassword',
      first_name: 'Secure',
      last_name: 'User',
      email: 'secure@test.com',
      phone: '555-7777'
    });

  expect(response.body).toHaveProperty('token');
  expect(response.body).not.toHaveProperty('password');
});

test('User.register() should not return password field', async () => {
  const user = await User.register({
    username: 'testuser',
    password: 'password123',
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '555-8888'
  });

  expect(user).not.toHaveProperty('password');
  expect(user).toHaveProperty('username');
});
```

---

### Bug #7: Unused Parameters in User.getAll()

**🟢 Severity:** LOW - Code quality issue

#### Description
The `User.getAll()` method accepts `username` and `password` parameters but never uses them. This is confusing and misleading.

#### Impact
- ⚠️ Confusing API design
- ⚠️ Reduced code maintainability
- ⚠️ Misleading function signature
- ⚠️ Could lead to developer confusion

#### Location
**File:** `models/user.js`  
**Line:** 83

#### The Bug
```javascript
// ❌ BUG: Parameters are never used
static async getAll(username, password) {
  const result = await db.query(
    `SELECT username, first_name, last_name, email, phone
     FROM users ORDER BY username`
  );
  return result.rows;
}
```

#### The Fix
```javascript
// FIXES BUG #7: Removed unused parameters
static async getAll() {
  const result = await db.query(
    `SELECT username, first_name, last_name, email, phone
     FROM users ORDER BY username`
  );
  return result.rows;
}
```

#### Test That Catches This Bug
```javascript
// TESTS BUG #7: getAll should work without parameters
test('getAll should return all users', async () => {
  await User.register({
    username: 'user1',
    password: 'pass1',
    first_name: 'User',
    last_name: 'One',
    email: 'user1@test.com',
    phone: '555-0001'
  });

  await User.register({
    username: 'user2',
    password: 'pass2',
    first_name: 'User',
    last_name: 'Two',
    email: 'user2@test.com',
    phone: '555-0002'
  });

  const users = await User.getAll();  // Called without parameters
  
  expect(users.length).toBeGreaterThanOrEqual(2);
  expect(users[0]).not.toHaveProperty('password');
});
```

---

## Running Tests

### Setup Test File

Create `__tests__/bugs.test.js` and add all the test code from above.

### Run All Tests

```bash
npm test
```

### Run Specific Test

```bash
npm test -- --testNamePattern="BUG #1"
```

### Expected Results

All tests should **PASS** ✅ after applying the fixes.

---

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Config File

Create `config.js` in the root directory:

```javascript
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || "secret-dev-key";
const BCRYPT_WORK_FACTOR = 12;

const DB_URI = process.env.NODE_ENV === "test"
  ? "postgresql:///bankly_test"
  : "postgresql:///bankly";

module.exports = {
  SECRET_KEY,
  BCRYPT_WORK_FACTOR,
  DB_URI
};
```

### 3. Setup Database

```bash
# Create databases
createdb bankly
createdb bankly_test

# Load schema
psql bankly < data.sql
psql bankly_test < data.sql
```

### 4. Start the Server

```bash
npm start
```

### 5. Test the API

```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "phone": "555-1234"
  }'
```

---

## Summary

All **7 bugs** have been identified, documented, tested, and fixed:

- ✅ Bug #1: JWT verification fixed
- ✅ Bug #2: Login await added
- ✅ Bug #3: Error throw added
- ✅ Bug #4: Delete await added
- ✅ Bug #5: Authorization logic corrected
- ✅ Bug #6: Password removed from response
- ✅ Bug #7: Unused parameters removed

Each fix includes proper code comments for easy identification during code review.