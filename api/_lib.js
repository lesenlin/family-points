// 共享工具：Upstash Redis REST 调用 + 密码哈希 + token 签发/校验（零依赖，Node 自带 crypto）
const crypto = require('crypto');

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.AUTH_SECRET || RTOKEN || 'dev-secret-change-me';

// 执行一条 Redis 命令，例如 redis(['GET','user:abc'])
async function redis(cmd) {
  if (!RURL || !RTOKEN) throw new Error('数据库未配置：缺少 Upstash Redis 的环境变量');
  const r = await fetch(RURL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RTOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 30 天有效的简易签名 token
function sign(uid) {
  const payload = b64url(JSON.stringify({ uid, exp: Date.now() + 30 * 24 * 3600 * 1000 }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return payload + '.' + sig;
}

function verify(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  if (expect !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch { return null; }
}

function hashPw(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

// 从请求头取出已登录的用户 ID（无效返回 null）
function authUid(req) {
  const h = req.headers['authorization'] || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  return verify(t);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = { redis, sign, verify, hashPw, authUid, readBody };
