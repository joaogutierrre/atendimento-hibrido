import Redis from 'ioredis';
const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
const channels = (process.env.CHANNELS ?? 'messaging:incoming,conversation:updated').split(',');

const sub = new Redis(url);
const received = [];

sub.on('message', (channel, message) => {
  const payload = JSON.parse(message);
  received.push({ channel, payload });
  console.log(`[${channel}]`, JSON.stringify(payload));
});

await sub.subscribe(...channels);
console.log(`subscribed to: ${channels.join(', ')}`);

const seconds = Number(process.env.SECONDS ?? 10);
setTimeout(async () => {
  console.log(`\n--- summary after ${seconds}s: ${received.length} events ---`);
  for (const ch of channels) {
    console.log(`  ${ch}: ${received.filter((r) => r.channel === ch).length}`);
  }
  await sub.quit();
  process.exit(0);
}, seconds * 1000);
