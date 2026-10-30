// ชั้นข้อมูล: ถ้า config.apiUrl ว่าง ใช้โหมดเดโม (localStorage) ไม่งั้นเรียก Apps Script
(function () {
  const cfg = window.APP_CONFIG;
  const DEMO = !cfg.apiUrl;

  // ---------- กติกา (ต้องตรงกับ apps-script/Code.gs) ----------
  function payAtShopBlockedReason(order, customer) {
    const r = cfg.rules;
    if (order.payment !== 'shop' || order.channel !== 'line') return '';
    if (customer && customer.requireTransfer) return 'บัญชีนี้ต้องโอนก่อน กรุณาเลือกโอนเงิน';
    if (order.type === 'fish' && r.fishRequiresTransfer) return 'การจองปลาต้องโอนก่อน';
    if (r.payAtShopMaxAmount.enabled && order.total > r.payAtShopMaxAmount.amount)
      return 'ยอดเกิน ' + r.payAtShopMaxAmount.amount + ' บาท กรุณาโอนก่อน';
    return '';
  }

  function decideStatus(order, customer) {
    const r = cfg.rules;
    if (order.channel !== 'line') return 'confirmed';
    if (order.payment === 'transfer') return r.transferAutoConfirm ? 'confirmed' : 'pending';
    const t = r.trustedAutoConfirm;
    if (t.enabled && customer && !customer.requireTransfer && customer.completed >= t.minCompleted) return 'confirmed';
    return 'pending';
  }

  function itemPrice(item) {
    return (item.unitPrice + (item.options || []).reduce((s, o) => s + o.price, 0)) * item.qty;
  }
  function orderTotal(order) {
    return order.items.reduce((s, i) => s + itemPrice(i), 0) + (order.deliveryFee || 0);
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- โหมดเดโม ----------
  const LS = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  const demo = {
    async getSettings() {
      const s = LS.get('demo_settings', { accepting: true, fishRound: null });
      s.fishBooked = s.fishRound ? fishBooked(LS.get('demo_orders', []), s.fishRound.id) : 0;
      return s;
    },
    async saveSettings(patch) {
      LS.set('demo_settings', Object.assign(LS.get('demo_settings', { accepting: true, fishRound: null }), patch));
      return demo.getSettings();
    },
    async getCustomer(key) { return LS.get('demo_customers', {})[key] || null; },
    async createOrder(order) {
      const orders = LS.get('demo_orders', []);
      const customers = LS.get('demo_customers', {});
      const settings = await demo.getSettings();
      const customer = customers[order.customerKey] || null;
      const err = validate(order, customer, settings);
      if (err) throw new Error(err);
      order.total = orderTotal(order);
      order.date = today();
      const seq = orders.filter(o => o.date === order.date).length + 1;
      order.id = (order.type === 'fish' ? 'F' : 'B') + String(seq).padStart(3, '0');
      order.uid = order.date + '-' + order.id;
      order.createdAt = new Date().toISOString();
      order.status = decideStatus(order, customer);
      order.paid = order.payment === 'transfer' && !!order.slip;
      orders.push(order);
      if (order.customerKey && !customers[order.customerKey])
        customers[order.customerKey] = { key: order.customerKey, name: order.customerName, completed: 0, requireTransfer: false };
      LS.set('demo_orders', orders);
      LS.set('demo_customers', customers);
      return order;
    },
    async myOrders(key) {
      return LS.get('demo_orders', []).filter(o => o.customerKey === key).slice(-10).reverse();
    },
    async listOrders() {
      const s = await demo.getSettings();
      const d = today();
      return LS.get('demo_orders', []).filter(o => o.date === d || (s.fishRound && o.fishRoundId === s.fishRound.id));
    },
    async updateOrder(uid, patch) {
      const orders = LS.get('demo_orders', []);
      const o = orders.find(x => x.uid === uid);
      if (!o) throw new Error('ไม่พบออเดอร์');
      if (patch.status === 'done' && o.status !== 'done' && o.customerKey) {
        const c = LS.get('demo_customers', {});
        if (c[o.customerKey]) { c[o.customerKey].completed++; LS.set('demo_customers', c); }
      }
      Object.assign(o, patch);
      LS.set('demo_orders', orders);
      return o;
    },
    async listCustomers() { return LS.get('demo_customers', {}); },
    async flagCustomer(key, requireTransfer) {
      const c = LS.get('demo_customers', {});
      if (!c[key]) c[key] = { key, name: key, completed: 0, requireTransfer: false };
      c[key].requireTransfer = requireTransfer;
      LS.set('demo_customers', c);
      return c[key];
    },
    resetAll() { ['demo_orders', 'demo_customers', 'demo_settings'].forEach(k => localStorage.removeItem(k)); }
  };

  function fishBooked(orders, roundId) {
    return orders.filter(o => o.fishRoundId === roundId && o.status !== 'rejected' && o.status !== 'cancelled')
      .reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  }

  function validate(order, customer, settings) {
    if (order.channel === 'line' && !settings.accepting) return 'ร้านปิดรับออเดอร์ชั่วคราว';
    if (!order.items.length) return 'ยังไม่ได้เลือกเมนู';
    if (order.type === 'fish') {
      const r = settings.fishRound;
      if (!r) return 'ยังไม่เปิดรอบจองปลา';
      if (order.channel === 'line' && r.closeAt && new Date() > new Date(r.closeAt)) return 'รอบนี้ปิดรับจองแล้ว';
      const qty = order.items.reduce((a, i) => a + i.qty, 0);
      if (settings.fishBooked + qty > r.quota) return 'รอบนี้เหลือ ' + Math.max(0, r.quota - settings.fishBooked) + ' ตัว';
    }
    if (order.fulfil === 'delivery' && (!order.address || !order.phone)) return 'กรุณาใส่ที่อยู่และเบอร์โทรสำหรับจัดส่ง';
    order.total = orderTotal(order);
    return payAtShopBlockedReason(order, customer);
  }

  // ---------- โหมดจริง (Apps Script) ----------
  let pin = '', idToken = '';
  async function get(action, params) {
    const q = new URLSearchParams(Object.assign({ action, pin, idToken }, params || {}));
    const res = await fetch(cfg.apiUrl + '?' + q.toString());
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
    return j.data;
  }
  async function post(action, body) {
    // text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight (Apps Script ไม่รองรับ)
    const res = await fetch(cfg.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, pin, idToken }, body)) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
    return j.data;
  }
  const remote = {
    getSettings: () => get('settings'),
    saveSettings: patch => post('saveSettings', { patch }),
    getCustomer: key => get('customer', { key }),
    createOrder: order => post('createOrder', { order }),
    myOrders: key => get('myOrders', { key }),
    listOrders: () => get('orders'),
    updateOrder: (uid, patch) => post('updateOrder', { uid, patch }),
    listCustomers: () => get('customers'),
    flagCustomer: (key, requireTransfer) => post('flagCustomer', { key, requireTransfer })
  };

  window.Store = Object.assign({}, DEMO ? demo : remote, {
    DEMO, itemPrice, orderTotal, payAtShopBlockedReason, today,
    setPin(p) { pin = p; },
    setIdToken(t) { idToken = t; }
  });
})();
