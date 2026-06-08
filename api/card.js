// 积分卡数据（需登录）
//   GET  /api/card?date=YYYY-MM-DD        -> { data: {...}|null }
//   GET  /api/card?list=1                 -> { dates: ["2026-06-08", ...] }
//   POST /api/card  { date, data }        -> { ok:true }
const { redis, authUid, readBody } = require('./_lib');

// 当天得分 = 总加分 − 总扣分（基础分 0，可正可负，全部累计进账户）
function netOf(data) {
  const sum = (arr) => (Array.isArray(arr) ? arr : []).reduce(
    (s, r) => s + (parseFloat(r.lv) || 0) * (parseInt(r.ct) || 1), 0);
  return sum(data && data.adds) - sum(data && data.deducts);
}

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
      // 维护存折：只把"当天净结余的变化量"累加进余额（重复保存 / 修改当天都不会重复计）
      const newNet = netOf(data);
      const oldRaw = await redis(['GET', `net:${uid}:${d}`]);
      const oldNet = oldRaw ? parseFloat(oldRaw) : 0;
      await redis(['SET', `card:${uid}:${d}`, JSON.stringify(data || {})]);
      await redis(['SET', `net:${uid}:${d}`, String(newNet)]);
      await redis(['SADD', `dates:${uid}`, d]);
      const balance = await redis(['INCRBYFLOAT', `bank:${uid}`, String(newNet - oldNet)]);
      return res.status(200).json({ ok: true, net: newNet, balance: Number(balance) });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误：' + e.message });
  }
};
