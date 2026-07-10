import { Connection, PublicKey } from '@solana/web3.js';

async function main() {
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const markets = [
    '5ZTzJqTZLwxkVrJ7Kk5U6SLKYT3TegM6udTof7ZisYQD',
    '4uDRRiASds6XHibjJ6sSEwmYdZneZ7ERnceWNzjuuHAk',
    'H27ccmmVDUxUGLVbpDeAerxvaBM9rAk3zMLHVQo91tha',
    '43GuvVPgV5Cxs6car1HXCTVKHLFiSb4wwA8S4tDkPBtw',
  ];
  
  for (const addr of markets) {
    const pk = new PublicKey(addr);
    const acc = await conn.getAccountInfo(pk);
    if (!acc) { console.log(addr.slice(0,8) + ' NOT FOUND'); continue; }
    const data = Buffer.from(acc.data);
    let o = 8;
    const fid = Number(data.readBigUInt64LE(o)); o += 8;
    const qLen = data.readUInt32LE(o); o += 4;
    const q = data.subarray(o, o+qLen).toString('utf8'); o += qLen;
    const creator = new PublicKey(data.subarray(o, o+32)).toBase58(); o += 32;
    o += 1;
    const tp = Number(data.readBigUInt64LE(o)); o += 8;
    const py = Number(data.readBigUInt64LE(o)); o += 8;
    const pn = Number(data.readBigUInt64LE(o)); o += 8;
    o += 16;
    const status = data[o]; o += 1;
    const wo = data[o]; o += 1;
    const smap = ['Pending','Open','Closed','Settled','Cancelled'];
    const winOpt = wo === 255 ? 'Unset' : wo === 0 ? 'YES' : 'NO';
    
    console.log('Market:', addr.slice(0,10) + '...');
    console.log('  Q:', q.slice(0,60));
    console.log('  Status:', smap[status], '| Winner:', winOpt);
    console.log('  Pool YES:', py/1e9, 'NO:', pn/1e9, '| Total:', tp/1e9);
    console.log('  Creator:', creator.slice(0,8) + '...');
    console.log('');
  }

  console.log('--- BETS at 5ZTzJqTL... ---');
  const pid = new PublicKey('58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x');
  const betDisc = Buffer.from('9317233b0f4b9b20', 'hex');
  const accounts = await conn.getProgramAccounts(pid);
  for (const a of accounts) {
    const d = Buffer.from(a.account.data);
    if (!d.subarray(0,8).equals(betDisc)) continue;
    const mPk = new PublicKey(d.subarray(8, 40)).toBase58();
    if (mPk !== '5ZTzJqTZLwxkVrJ7Kk5U6SLKYT3TegM6udTof7ZisYQD') continue;
    const bettor = new PublicKey(d.subarray(40, 72)).toBase58();
    const opt = d[72];
    const amt = Number(new DataView(d.buffer.slice(d.byteOffset+73, d.byteOffset+81)).getBigUint64(0, true));
    const claimed = d[81] === 1;
    const isWinner = wo => wo === 255 ? false : opt === wo;
    console.log('  Bettor:', bettor.slice(0,8)+'..', '| Option:', opt===0?'YES':'NO', '| Amt:', amt/1e9, 'SOL | Claimed:', claimed);
  }
}
main().catch(e => console.error(e));
