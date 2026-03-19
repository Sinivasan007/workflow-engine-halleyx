const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

/**
 * SIGN UP
 */
async function signup(req, res) {
  const { username, email, password } = req.body;

  // Input validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (username.length < 2 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be between 2 and 50 characters' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // 1. Check if user already exists
    const [[existing]] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // 3. Create user
    await pool.execute(
      'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
      [userId, username, email, hashedPassword]
    );

    // 4. Generate token
    const token = jwt.sign({ id: userId, email, username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, username, email }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
}

/**
 * SIGN IN
 */
async function signin(req, res) {
  const { email, password } = req.body;

  try {
    // 1. Find user
    const [[user]] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during signin' });
  }
}

/**
 * GET ME
 */
async function getMe(req, res) {
  try {
    // req.user is attached by the auth middleware
    const [[user]] = await pool.execute('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Server error fetching user' });
  }
}

/**
 * UPDATE PROFILE
 */
async function updateProfile(req, res) {
  const { username, email } = req.body;
  const userId = req.user.id;

  try {
    // Check if new email is taken by someone else
    if (email) {
      const [[existing]] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    await pool.execute(
      'UPDATE users SET username = ?, email = ? WHERE id = ?',
      [username, email, userId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
}

module.exports = {
  signup,
  signin,
  getMe,
  updateProfile
};
