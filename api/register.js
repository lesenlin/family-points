// 注册：POST { userId, password } -> { token, userId }
const crypto = require('crypto');
const { redis, sign, hashPw, readBody } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: '方法不允许' });
  try {
    const { userId, password } = readBody(req);
    const uid = String(userId || '').trim();
    if (!uid || !password) return res.status(400).json({ error: '请输入用户ID和密码' });
    if (uid.length < 2) return res.status(400).json({ error: '用户ID至少 2 位' });
    if (String(password).length < 4) return res.status(400).json({ error: '密码至少 4 位' });
    if (!/^[\w一-龥.-]+$/.test(uid)) return res.status(400).json({ error: '用户ID只能用字母/数字/中文/._-' });

    const key = 'user:' + uid;
    const exists = await redis(['EXISTS', key]);
    if (exists) return res.status(409).json({ error: '该用户ID已被注册，请直接登录' });

    const salt = crypto.randomBytes(16).toString('hex');
    await redis(['SET', key, JSON.stringify({ salt, hash: hashPw(password, salt), created: Date.now() })]);
    return res.status(200).json({ token: sign(uid), userId: uid });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误：' + e.message });
  }
};
