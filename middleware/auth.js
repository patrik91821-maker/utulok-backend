const jwt = require('jsonwebtoken');
require('dotenv').config();
const knex = require('../db'); // if needed

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Bad token format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No token' });
  if (req.user.role !== 'platform_admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

module.exports = { authMiddleware, adminOnly };
