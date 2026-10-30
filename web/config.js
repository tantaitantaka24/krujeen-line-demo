// ตั้งค่าร้าน: แก้เมนู ราคา กติกา และการเชื่อมต่อที่ไฟล์นี้ที่เดียว
window.APP_CONFIG = {
  shopName: 'ร้านเบอร์เกอร์ครูจีน',

  // เว้นว่างทั้งสองค่า = โหมดเดโม (ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น)
  liffId: '2012289018-moWlUmNn',  // จาก LINE Developers > LINE Login channel > LIFF
  apiUrl: 'https://script.google.com/macros/s/AKfycby2uWJErT5Y2JMzsLe-bciZH5sOWHI5raKzqOU4D9dRbU3r9usEjm8Xmv-pyL4kcyWSXw/exec',  // URL ของ Apps Script web app (ลงท้าย /exec)

  promptPay: { id: '0XX-XXX-XXXX', name: 'ชื่อบัญชีร้าน' },
  deliveryFee: 0,
  imgBase: '../assets/items/',  // รูปเมนูแต่ละชิ้น

  burgers: [
    { id: 'beef',    name: 'เบอร์เกอร์เนื้อ',      price: 59, img: 'beef.jpg' },
    { id: 'chicken', name: 'เบอร์เกอร์ไก่',        price: 49, img: 'chicken.jpg' },
    { id: 'shrimp',  name: 'เบอร์เกอร์กุ้ง',       price: 49, img: 'shrimp.jpg' },
    { id: 'fish',    name: 'เบอร์เกอร์ปลา',        price: 49, img: 'fish.jpg' },
    { id: 'egg2',    name: 'เบอร์เกอร์ดับเบิ้ลไข่', price: 39, img: 'egg2.jpg' },
    { id: 'kebab',   name: 'เคบับเนื้อเบอร์เกอร์',  price: 60, img: 'kebab.jpg' }
  ],
  burgerOptions: [
    { id: 'cheese',   name: 'เพิ่มชีส',      price: 15, img: 'opt-cheese.jpg' },
    { id: 'egg',      name: 'เพิ่มไข่',      price: 10, img: 'opt-egg.jpg' },
    { id: 'charcoal', name: 'ขนมปังชาโคล', price: 10, img: 'opt-charcoal.jpg' }
  ],
  fishSizes: [
    { id: 'fish160', name: 'ปลากระพง ไซซ์ 160', price: 160, img: 'seabass.jpg' },
    { id: 'fish180', name: 'ปลากระพง ไซซ์ 180', price: 180, img: 'seabass.jpg' }
  ],

  // กติกาการยืนยันออเดอร์ (ดู docs/SPEC.md หัวข้อ 7)
  rules: {
    transferAutoConfirm: true,                                // โอน+สลิป = รับทันที
    trustedAutoConfirm: { enabled: false, minCompleted: 2 },  // ลูกค้าประจำไม่ต้องรอยืนยัน
    payAtShopMaxAmount: { enabled: false, amount: 150 },      // เกินยอดนี้ต้องโอน
    fishRequiresTransfer: false,                              // ปลาต้องโอนก่อนเสมอ
    notifyCustomerOnStatus: false                             // push แจ้งลูกค้า (กินโควตา)
  }
};
