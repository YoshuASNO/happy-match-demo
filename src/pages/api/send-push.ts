import type { NextApiRequest, NextApiResponse } from 'next';
import webpush from 'web-push';

// VAPIDキー（本番は環境変数で管理）
const VAPID_PUBLIC_KEY = 'ここにVAPID公開鍵を入力';
const VAPID_PRIVATE_KEY = 'ここにVAPID秘密鍵を入力';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  const { subscription, title, body } = req.body;
  if (!subscription) {
    return res.status(400).json({ error: 'No subscription' });
  }
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body })
    );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
