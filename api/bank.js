// 成长存折（需登录）
//   GET  /api/bank             -> { balance }
//   POST /api/bank { redeem }  -> { ok, balance }  兑换扣减
const { redis, authUid, readBody } = require('./_lib');

module.exports = async (req, res) => {
  const uid = authUid(req);
  if (!uid) return res.status(401).json({ error: '请先登录' });
  try {
    if (req.method === 'GET') {
      const b = await redis(['GET', `bank:${uid}`]);
      return res.status(200).json({ balance: b ? Number(b) : 0 });
    }
    if (req.method === 'POST') {
      const { redeem } = readBody(req);
      const pts = parseFloat(redeem);
      if (!pts || pts <= 0) return res.status(400).json({ error: '请输入要扣减的分数' });
      const curRaw = await redis(['GET', `bank:${uid}`]);
      const cur = curRaw ? Number(curRaw) : 0;
      if (cur < pts) return res.status(400).json({ error: `余额不足，当前 ${cur} 分` });
      const balance = await redis(['INCRBYFLOAT', `bank:${uid}`, String(-pts)]);
      await redis(['LPUSH', `redeems:${uid}`, JSON.stringify({ pts, t: Date.now() })]);
      return res.status(200).json({ ok: true, balance: Number(balance) });
    }
    return res.status(405).json({ error: '方法不允许' });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误：' + e.message });
  }
};
