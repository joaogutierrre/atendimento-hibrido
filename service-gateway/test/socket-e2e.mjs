import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3115';
const login = async (email, password) => {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return j.accessToken;
};

const connect = (token, label) => new Promise((resolve, reject) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
  s.on('connect', () => {
    console.log(`[${label}] connected id=${s.id}`);
    resolve(s);
  });
  s.on('connect_error', (err) => reject(new Error(`connect_error: ${err.message}`)));
  s.on('error', (err) => console.log(`[${label}] error:`, err));
});

const collect = (socket, event, label) => {
  socket.on(event, (p) => console.log(`[${label}] ← ${event}`, JSON.stringify(p).slice(0, 200)));
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  console.log('=== 1. Unauthorized connect ===');
  try {
    await connect('invalid.jwt.here', 'bad');
    console.log('UNEXPECTED: bad token connected');
  } catch (e) {
    console.log('bad token rejected:', e.message);
  }

  console.log('\n=== 2. Connect acme admin + beta admin ===');
  const tokenA = await login('admin@acme.test', 'admin123');
  const tokenB = await login('admin@beta.test', 'admin123');
  const socketA = await connect(tokenA, 'acme');
  const socketB = await connect(tokenB, 'beta');
  ['conversation:new', 'conversation:message', 'conversation:updated', 'conversation:escalated']
    .forEach((e) => {
      collect(socketA, e, 'acme');
      collect(socketB, e, 'beta');
    });

  console.log('\n=== 3. Simular webhook Telegram (gera conversation:new + conversation:message) ===');
  const chRes = await fetch(`${BASE}/tenant/channels`, {
    headers: { authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  const channelId = chRes[0].id;
  console.log('channelId=', channelId);

  await fetch(`${BASE}/telegram/webhook/${channelId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'dev-secret',
    },
    body: JSON.stringify({
      update_id: 901,
      message: {
        message_id: 900,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 77777, type: 'private', first_name: 'Carla' },
        from: { id: 77777, is_bot: false, first_name: 'Carla' },
        text: 'Boa noite, vocês atendem sabado?',
      },
    }),
  }).then((r) => r.json()).then((j) => console.log('webhook →', j));

  await delay(300);

  console.log('\n=== 4. Atendedor acme envia mensagem -> conversation:message ===');
  const list = await fetch(`${BASE}/conversations?status=OPEN`, {
    headers: { authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  const convId = list.items[0].id;
  await fetch(`${BASE}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ content: 'Atendemos, sim!' }),
  });
  await delay(300);

  console.log('\n=== 5. Join/leave/typing ===');
  socketA.emit('conversation:join', { conversationId: convId }, (ack) =>
    console.log('join ack:', ack),
  );
  socketA.emit('typing', { conversationId: convId });
  await delay(300);

  console.log('\n=== 6. PATCH /mode HUMAN -> conversation:updated ===');
  await fetch(`${BASE}/conversations/${convId}/mode`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ mode: 'HUMAN' }),
  });
  await delay(300);

  console.log('\n=== done ===');
  socketA.disconnect();
  socketB.disconnect();
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
