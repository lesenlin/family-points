// 积分卡数据（需登录）
//   GET  /api/card?date=YYYY-MM-DD        -> { data: {...}|null }
//   GET  /api/card?list=1                 -> { dates: ["2026-06-08", ...] }
//   POST /api/card  { date, data }        -> { ok:true }
const { redis, authUid, readBody } = require('./_lib');

module.exports = async (req, res) => {
  const uid = authUid(req);
  if (!uid) return res.status(401).json({ error: '请先登录' });
  try {
    if (req.method === 'GET') {
      if (req.query.list) {
        const dates = (await redis(['SMEMBERS', `dates:${uid}`])) || [];
        dates.sort().reverse();
        return res.status(200).json({ dates });
      }
      const date = String(req.query.date || '').slice(0, 10);
      if (!date) return res.status(400).json({ error: '缺少日期' });
      const raw = await redis(['GET', `card:${uid}:${date}`]);
      return res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    }

    if (req.method === 'POST') {
      const { date, data } = readBody(req);
      const d = String(date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
      await redis(['SET', `card:${uid}:${d}`, JSON.stringify(data || {})]);
      await redis(['SADD', `dates:${uid}`, d]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误：' + e.message });
  }
};
