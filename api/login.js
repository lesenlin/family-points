// 登录：POST { userId, password } -> { token, userId }
const { redis, sign, hashPw, readBody } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: '方法不允许' });
  try {
    const { userId, password } = readBody(req);
    const uid = String(userId || '').trim();
    if (!uid || !password) return res.status(400).json({ error: '请输入用户ID和密码' });

    const raw = await redis(['GET', 'user:' + uid]);
    if (!raw) return res.status(401).json({ error: '用户不存在或密码错误' });
    const u = JSON.parse(raw);
    if (hashPw(password, u.salt) !== u.hash) return res.status(401).json({ error: '用户不存在或密码错误' });

    return res.status(200).json({ token: sign(uid), userId: uid });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误：' + e.message });
  }
};
