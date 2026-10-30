/**
 * หลังบ้านร้านครูจีน: Google Sheets + LINE Messaging API
 * ตั้งค่าใน Project Settings > Script Properties:
 *   STAFF_PIN          PIN สำหรับกระดานออเดอร์
 *   LINE_TOKEN         Channel access token (Messaging API channel)
 *   LOGIN_CHANNEL_ID   Channel ID ของ LINE Login channel (ที่มี LIFF)
 *   ORDER_URL          ลิงก์ LIFF ของหน้าสั่ง (https://liff.line.me/xxxx) ใช้ในข้อความต้อนรับ
 */

// ต้องตรงกับ web/config.js (ราคาคิดใหม่ฝั่งนี้เสมอ กันการแก้ราคาจากเบราว์เซอร์)
const PRICES = {
  beef: 59, chicken: 49, shrimp: 49, fish: 49, egg2: 39, kebab: 60,
  cheese: 15, egg: 10, charcoal: 10,
  fish160: 160, fish180: 180
};
const DELIVERY_FEE = 0;
const RULES = {
  transferAutoConfirm: true,
  trustedAutoConfirm: { enabled: false, minCompleted: 2 },
  payAtShopMaxAmount: { enabled: false, amount: 150 },
  fishRequiresTransfer: false,
  notifyCustomerOnStatus: false
};
const STATUS_TH = { pending: 'รอร้านยืนยัน', confirmed: 'ร้านรับแล้ว', ready: 'พร้อมแล้ว', done: 'เสร็จ', rejected: 'ร้านไม่รับ', cancelled: 'ยกเลิก' };
const COLS = ['uid', 'id', 'date', 'createdAt', 'type', 'channel', 'status', 'paid', 'customerKey', 'customerName', 'phone',
  'fulfil', 'address', 'time', 'note', 'payment', 'total', 'fishRoundId', 'items', 'slip', 'itemsText'];

const props = PropertiesService.getScriptProperties();

// ---------- จุดเข้า ----------
function doGet(e) {
  return handle(() => {
    const p = e.parameter;
    switch (p.action) {
      case 'settings': return getSettings();
      // หน้าลูกค้าเรียกครั้งเดียวตอนเปิด (แทน settings + customer)
      case 'init': return { settings: getSettings(), customer: p.idToken ? getCustomer(userFromToken(p.idToken)) : null };
      case 'myOrders': { const k = userFromToken(p.idToken); return readOrders().filter(o => o.customerKey === k).slice(-10).reverse(); }
      // กระดานร้านเรียกครั้งเดียวต่อรอบรีเฟรช (แทน orders + settings + customers)
      case 'board': requirePin(p.pin); return boardData();
    }
    throw new Error('unknown action');
  });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.events) { handleLineWebhook(body.events); return ContentService.createTextOutput('OK'); }
  return handle(() => {
    switch (body.action) {
      case 'createOrder': return createOrder(body);
      case 'updateOrder': requirePin(body.pin); return updateOrder(body.uid, body.patch);
      case 'saveSettings': requirePin(body.pin); return saveSettings(body.patch);
      case 'flagCustomer': requirePin(body.pin); return flagCustomer(body.key, body.requireTransfer);
    }
    throw new Error('unknown action');
  });
}

function handle(fn) {
  let out;
  try { out = { ok: true, data: fn() }; } catch (err) { out = { ok: false, error: err.message }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function requirePin(pin) {
  if (!pin || pin !== props.getProperty('STAFF_PIN')) throw new Error('PIN ไม่ถูกต้อง');
}

// ยืนยันตัวตนลูกค้าจาก LIFF ID token → คืน LINE userId (จำผลไว้ 10 นาที ไม่ต้องถาม LINE ซ้ำทุกครั้ง)
function userFromToken(idToken) {
  if (!idToken) throw new Error('กรุณาเปิดจาก LINE');
  const cache = CacheService.getScriptCache();
  const key = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  const hit = cache.get(key);
  if (hit) return hit;
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', muteHttpExceptions: true,
    payload: { id_token: idToken, client_id: props.getProperty('LOGIN_CHANNEL_ID') }
  });
  const j = JSON.parse(res.getContentText());
  if (!j.sub) throw new Error('เข้าสู่ระบบหมดอายุ กรุณาเปิดหน้าสั่งใหม่');
  cache.put(key, j.sub, 600);
  return j.sub;
}

// ---------- ชีต ----------
function sheet(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function readOrders() {
  const sh = sheet('Orders', COLS);
  const rows = sh.getDataRange().getValues().slice(1);
  return rows.map(r => {
    const o = {}; COLS.forEach((c, i) => o[c] = r[i]);
    o.items = JSON.parse(o.items || '[]'); o.paid = o.paid === true || o.paid === 'TRUE'; o.total = Number(o.total);
    o.date = typeof o.date === 'string' ? o.date : Utilities.formatDate(o.date, 'Asia/Bangkok', 'yyyy-MM-dd');
    o.createdAt = String(o.createdAt); o.time = String(o.time); o.phone = String(o.phone);
    return o;
  });
}
function writeOrder(o, rowIndex) {
  const sh = sheet('Orders', COLS);
  const row = COLS.map(c => c === 'items' ? JSON.stringify(o.items) : (o[c] === undefined ? '' : o[c]));
  if (rowIndex) sh.getRange(rowIndex, 1, 1, COLS.length).setValues([row]);
  else sh.appendRow(row);
}
function readCustomers() {
  const sh = sheet('Customers', ['key', 'name', 'completed', 'requireTransfer']);
  const out = {};
  sh.getDataRange().getValues().slice(1).forEach(r => out[r[0]] = { key: r[0], name: r[1], completed: Number(r[2]) || 0, requireTransfer: r[3] === true || r[3] === 'TRUE' });
  return out;
}
function saveCustomer(c) {
  const sh = sheet('Customers', ['key', 'name', 'completed', 'requireTransfer']);
  const keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
  const i = keys.indexOf(c.key);
  const row = [c.key, c.name, c.completed, c.requireTransfer];
  if (i > 0) sh.getRange(i + 1, 1, 1, 4).setValues([row]); else sh.appendRow(row);
}
function getCustomer(key) { return readCustomers()[key] || null; }

function getSettings(orders) {
  const s = JSON.parse(props.getProperty('SETTINGS') || '{"accepting":true,"fishRound":null}');
  s.fishBookedBySize = s.fishRound ? fishBookedBySize(orders || readOrders(), s.fishRound.id) : {};
  s.fishBooked = Object.values(s.fishBookedBySize).reduce((a, b) => a + b, 0);
  return s;
}
function saveSettings(patch) {
  const s = JSON.parse(props.getProperty('SETTINGS') || '{"accepting":true,"fishRound":null}');
  Object.assign(s, patch);
  props.setProperty('SETTINGS', JSON.stringify(s));
  return getSettings();
}
// ยอดจองของรอบ แยกตามไซซ์ { fish160: 3, ... }
function fishBookedBySize(orders, roundId) {
  const out = {};
  orders.filter(o => o.fishRoundId === roundId && o.status !== 'rejected' && o.status !== 'cancelled')
    .forEach(o => o.items.forEach(i => out[i.id] = (out[i.id] || 0) + i.qty));
  return out;
}
function today() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'); }

// ---------- ออเดอร์ ----------
function createOrder(body) {
  const o = body.order;
  if (o.channel === 'line') {
    o.customerKey = userFromToken(body.idToken);
  } else {
    requirePin(body.pin);
  }
  // คิดราคาใหม่จากตาราง PRICES (ปลา: ใช้ไซซ์/ราคาที่ตั้งไว้ในรอบ ถ้ารอบนั้นมี)
  const round = o.type === 'fish' ? JSON.parse(props.getProperty('SETTINGS') || '{}').fishRound : null;
  const table = round && round.sizes ? Object.fromEntries(round.sizes.map(s => [s.id, Number(s.price)])) : PRICES;
  o.items = o.items.map(i => ({
    id: i.id, name: String(i.name), qty: Math.max(1, Math.floor(i.qty)), unitPrice: priceOf(i.id, table),
    options: (i.options || []).map(x => ({ id: x.id, name: String(x.name), price: priceOf(x.id, table) }))
  }));
  o.deliveryFee = o.fulfil === 'delivery' ? DELIVERY_FEE : 0;
  o.total = o.items.reduce((s, i) => s + (i.unitPrice + i.options.reduce((a, x) => a + x.price, 0)) * i.qty, 0) + o.deliveryFee;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const orders = readOrders();
    const settings = getSettings(orders);
    const customers = readCustomers();
    const customer = customers[o.customerKey] || null;
    const err = validate(o, customer, settings);
    if (err) throw new Error(err);

    o.date = today();
    const seq = orders.filter(x => x.date === o.date).length + 1;
    o.id = (o.type === 'fish' ? 'F' : 'B') + ('00' + seq).slice(-3);
    o.uid = o.date + '-' + o.id;
    o.createdAt = new Date().toISOString();
    o.status = decideStatus(o, customer);
    o.slip = o.slip ? saveSlip(o.slip, o.uid) : '';
    o.paid = o.payment === 'transfer' && !!o.slip;
    o.itemsText = o.items.map(i => i.name + (i.options.length ? ' (' + i.options.map(x => x.name).join(', ') + ')' : '') + ' x' + i.qty).join(' / ');
    writeOrder(o);
    if (o.customerKey && !customer) saveCustomer({ key: o.customerKey, name: o.customerName, completed: 0, requireTransfer: false });
    return o;
  } finally { lock.releaseLock(); }
}

function priceOf(id, table) {
  if (!(id in table)) throw new Error('ไม่พบเมนู ' + id + ' (ร้านอาจแก้ไซซ์ในรอบนี้ กรุณาเปิดหน้าสั่งใหม่)');
  return table[id];
}

function validate(o, customer, settings) {
  if (o.channel === 'line' && !settings.accepting) return 'ร้านปิดรับออเดอร์ชั่วคราว';
  if (!o.items.length) return 'ยังไม่ได้เลือกเมนู';
  if (o.type === 'fish') {
    const r = settings.fishRound;
    if (!r || r.id !== o.fishRoundId) return 'รอบจองปลาเปลี่ยนแล้ว กรุณาเปิดหน้าสั่งใหม่';
    if (o.channel === 'line' && r.closeAt && new Date() > new Date(r.closeAt)) return 'รอบนี้ปิดรับจองแล้ว';
    const qty = o.items.reduce((a, i) => a + i.qty, 0);
    if (settings.fishBooked + qty > r.quota) return 'รอบนี้เหลือ ' + Math.max(0, r.quota - settings.fishBooked) + ' ตัว';
    for (const i of o.items) {
      const size = (r.sizes || []).find(x => x.id === i.id), booked = settings.fishBookedBySize[i.id] || 0;
      if (size && size.quota && booked + i.qty > size.quota) return size.name + ' เหลือ ' + Math.max(0, size.quota - booked) + ' ตัว';
    }
  }
  if (o.fulfil === 'delivery' && (!o.address || !o.phone)) return 'กรุณาใส่ที่อยู่และเบอร์โทรสำหรับจัดส่ง';
  if (o.payment === 'shop' && o.channel === 'line') {
    if (customer && customer.requireTransfer) return 'บัญชีนี้ต้องโอนก่อน กรุณาเลือกโอนเงิน';
    if (o.type === 'fish' && RULES.fishRequiresTransfer) return 'การจองปลาต้องโอนก่อน';
    if (RULES.payAtShopMaxAmount.enabled && o.total > RULES.payAtShopMaxAmount.amount) return 'ยอดเกิน ' + RULES.payAtShopMaxAmount.amount + ' บาท กรุณาโอนก่อน';
  }
  if (o.payment === 'transfer' && o.channel === 'line' && !o.slip) return 'กรุณาแนบสลิป';
  return '';
}

function decideStatus(o, customer) {
  if (o.channel !== 'line') return 'confirmed';
  if (o.payment === 'transfer') return RULES.transferAutoConfirm ? 'confirmed' : 'pending';
  const t = RULES.trustedAutoConfirm;
  if (t.enabled && customer && !customer.requireTransfer && customer.completed >= t.minCompleted) return 'confirmed';
  return 'pending';
}

function saveSlip(dataUrl, uid) {
  const m = String(dataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return '';
  const folders = DriveApp.getFoldersByName('สลิปร้านครูจีน');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('สลิปร้านครูจีน');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], uid + '.jpg'));
  return file.getUrl(); // ไฟล์เป็นส่วนตัว เปิดได้เฉพาะบัญชีร้าน
}

function boardData() {
  const all = readOrders(), s = getSettings(all), d = today();
  return {
    orders: all.filter(o => o.date === d || (s.fishRound && o.fishRoundId === s.fishRound.id)),
    settings: s,
    customers: readCustomers()
  };
}

function updateOrder(uid, patch) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const orders = readOrders();
    const i = orders.findIndex(o => o.uid === uid);
    if (i < 0) throw new Error('ไม่พบออเดอร์');
    const o = orders[i], before = o.status;
    if ('status' in patch) o.status = String(patch.status);
    if ('paid' in patch) o.paid = !!patch.paid;
    writeOrder(o, i + 2);
    if (o.status === 'done' && before !== 'done' && o.customerKey) {
      const c = getCustomer(o.customerKey);
      if (c) { c.completed++; saveCustomer(c); }
    }
    if (RULES.notifyCustomerOnStatus && o.channel === 'line' && o.status !== before)
      push(o.customerKey, 'ออเดอร์ #' + o.id + ': ' + STATUS_TH[o.status]);
    return o;
  } finally { lock.releaseLock(); }
}

function flagCustomer(key, requireTransfer) {
  const c = getCustomer(key) || { key, name: key, completed: 0, requireTransfer: false };
  c.requireTransfer = !!requireTransfer;
  saveCustomer(c);
  return c;
}

// ---------- LINE ----------
// หมายเหตุ: Apps Script อ่าน header X-Line-Signature ไม่ได้ บอทจึงทำแค่ "ตอบ" ไม่แก้ข้อมูลใด ๆ
function handleLineWebhook(events) {
  events.forEach(ev => {
    if (!ev.replyToken) return;
    if (ev.type === 'follow') {
      reply(ev.replyToken, 'ขอบคุณที่เพิ่มเพื่อนครับ 🍔🐟\nกดเมนูด้านล่าง หรือสั่งที่นี่: ' + (props.getProperty('ORDER_URL') || ''));
      return;
    }
    if (ev.type !== 'message' || ev.message.type !== 'text') return;
    const m = ev.message.text.match(/ออเดอร์ #([BF]\d{3})/);
    if (!m) return; // ข้อความทั่วไป ปล่อยให้ร้านตอบเองในแชท
    const o = readOrders().find(x => x.date === today() && x.id === m[1] && x.customerKey === ev.source.userId);
    if (!o) return;
    reply(ev.replyToken, o.status === 'pending'
      ? '⏳ ได้รับออเดอร์ #' + o.id + ' แล้ว รอร้านยืนยันสักครู่นะครับ'
      : '✅ ร้านรับออเดอร์ #' + o.id + ' แล้ว ขอบคุณครับ');
  });
}

function reply(token, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + props.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ replyToken: token, messages: [{ type: 'text', text }] })
  });
}

function push(to, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + props.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ to, messages: [{ type: 'text', text }] })
  });
}
