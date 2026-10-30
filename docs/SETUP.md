# คู่มือติดตั้ง (จากโหมดเดโมในเครื่อง → ใช้งานจริงใน LINE)

## สิ่งที่ติดตั้งแล้วสำหรับเดโม (30 ต.ค. 2569)
| ส่วน | ค่า |
|---|---|
| LINE OA | ร้านครูจีน เดโม `@699gazwu` (เพิ่มเพื่อน: https://line.me/R/ti/p/@699gazwu) |
| Provider | ระบบร้านค้า ครูจีน |
| Messaging API channel | 2012288930 |
| LINE Login channel | 2012289018 (Published) |
| LIFF | `2012289018-moWlUmNn` → https://liff.line.me/2012289018-moWlUmNn |
| หน้าเว็บ (GitHub Pages) | https://tantaitantaka24.github.io/krujeen-line-demo/web/order.html |
| กระดานร้าน | https://tantaitantaka24.github.io/krujeen-line-demo/web/board.html |
| Google Sheet | "ออเดอร์ร้านครูจีน (เดโม)" |
| Apps Script | "หลังบ้านร้านครูจีน (เดโม)" (ผูกกับชีต) — Script Properties ครบ 4 ค่า |
| Script ID | `1hwYcyK1m_jrrsZROs7luttroxV_ufFtgiyLh3CJ-jat29jS1pgq7TAxD` (อยู่ใน `apps-script/.clasp.json`) |
| Web app deployment | `AKfycby2uWJErT5Y2JMzsLe-bciZH5sOWHI5raKzqOU4D9dRbU3r9usEjm8Xmv-pyL4kcyWSXw` (= `apiUrl` ใน `web/config.js`) |
| บัญชี Google ที่ clasp ใช้ | tantaiyipz@gmail.com |

แก้หน้าเว็บ: แก้ไฟล์ใน `web/` แล้ว `git push` (GitHub Pages อัปเดตเองภายใน ~1 นาที)

แก้ `Code.gs`: อัปเดตหลังบ้านด้วย clasp จากโฟลเดอร์ `apps-script/` (ทำหลังบ้านก่อน แล้วค่อย push หน้าเว็บ)
```bash
cd apps-script && clasp push -f && clasp deploy -i AKfycby2uWJErT5Y2JMzsLe-bciZH5sOWHI5raKzqOU4D9dRbU3r9usEjm8Xmv-pyL4kcyWSXw -d "สรุปสิ่งที่แก้"
```
- ต้อง deploy ด้วย `-i` deployment เดิมเสมอ URL `/exec` จึงไม่เปลี่ยน (ไม่ต้องแก้ `config.js`)
- เช็คว่าขึ้นแล้ว: `clasp deployments` ต้องเห็นเลขเวอร์ชันใหม่ที่ deployment นี้
- ก่อน push ถ้าไม่แน่ใจว่ามีคนแก้โค้ดในหน้า Apps Script ตรง ๆ ให้ `clasp pull` มาเทียบก่อน (pull จะเขียนทับ `Code.gs` ในเครื่อง — commit งานไว้ก่อน)

ทำตามลำดับ ใช้เวลาประมาณ 1–2 ชั่วโมงในครั้งแรก ทุกบริการในคู่มือนี้ใช้ฟรี

## 0. ลองโหมดเดโมในเครื่องก่อน (ไม่ต้องตั้งค่าอะไร)
เปิดเทอร์มินัลในโฟลเดอร์โปรเจกต์ แล้วรัน:
```bash
python3 -m http.server 8765
```
- หน้าลูกค้า: http://localhost:8765/web/order.html
- กระดานร้าน: http://localhost:8765/web/board.html

เปิดคนละแท็บ สั่งของในหน้าลูกค้า แล้วออเดอร์จะเด้งขึ้นในกระดาน (ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น)

## 1. สร้าง LINE OA สำหรับเดโม (แยกจากบัญชีที่ใช้อยู่)
1. เข้า https://manager.line.biz → สร้างบัญชีใหม่ ตั้งชื่อ เช่น "เดโม ร้านเบอร์เกอร์ & ปลากระพง"
2. ตั้งค่า → Messaging API → เปิดใช้ (จะสร้าง Provider ให้ ตั้งชื่อ Provider เป็นชื่อคุณ เช่น "ระบบร้านค้า ครูจีน")
3. ตั้งค่าการตอบกลับ: เปิด **แชท** และ **Webhook** ไว้ทั้งคู่ (เจ้าของยังตอบแชทเองได้ บอทแค่ตอบยืนยันออเดอร์)

## 2. LINE Developers (https://developers.line.biz)
1. เลือก Provider เดียวกับข้อ 1
2. Messaging API channel → แท็บ Messaging API → ออก **Channel access token** (เก็บไว้ใช้ข้อ 3)
3. สร้าง **LINE Login channel** ใหม่ใน Provider เดียวกัน → จด **Channel ID**
   - Linked LINE Official Account: เลือกบัญชีเดโม (ให้ลูกค้าเพิ่มเพื่อนตอนเปิดหน้าสั่ง)
4. ใน LINE Login channel → แท็บ LIFF → Add
   - Size: Full
   - Endpoint URL: ใส่หลังทำข้อ 4 (เช่น `https://ชื่อเว็บ.netlify.app/web/order.html`)
   - Scopes: `openid`, `profile`, `chat_message.write`
   - จด **LIFF ID** และลิงก์ `https://liff.line.me/LIFF_ID`

## 3. Google Sheet + Apps Script (หลังบ้าน)
1. สร้าง Google Sheet ใหม่ ตั้งชื่อ "ออเดอร์ร้านครูจีน (เดโม)"
2. เมนู ส่วนขยาย → Apps Script → ลบโค้ดเดิม วางโค้ดจาก `apps-script/Code.gs`
3. ไอคอนเฟือง (Project Settings) → Script Properties → เพิ่ม:
   | Property | ค่า |
   |---|---|
   | `STAFF_PIN` | PIN ที่เจ้าของจะใช้เปิดกระดาน (ตัวเลข 4–6 หลัก) |
   | `LINE_TOKEN` | Channel access token จากข้อ 2.2 |
   | `LOGIN_CHANNEL_ID` | Channel ID จากข้อ 2.3 |
   | `ORDER_URL` | `https://liff.line.me/LIFF_ID` |
4. Deploy → New deployment → ประเภท **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด Deploy → อนุญาตสิทธิ์ (Google จะเตือนว่าแอปยังไม่ผ่านการตรวจ ให้กด Advanced → ไปต่อ เพราะเป็นสคริปต์ของเราเอง)
   - คัดลอก **Web app URL** (ลงท้าย `/exec`)
5. กลับไป LINE Developers → Messaging API channel → Webhook URL = Web app URL → เปิด **Use webhook**
   - ปุ่ม Verify อาจขึ้น error เพราะ Apps Script ตอบแบบ redirect — ทดสอบจริงด้วยการสั่งของแทน

> แก้โค้ด Apps Script ทีหลัง: ใช้ clasp ตามหัวข้อด้านบน หรือในหน้าเว็บ Deploy → Manage deployments → แก้ไข → Version: New version (URL เดิมใช้ต่อได้)

## 4. ใส่ค่าใน `web/config.js` แล้วอัปโหลดหน้าเว็บ
1. แก้ `web/config.js`:
   - `liffId`: LIFF ID จากข้อ 2.4
   - `apiUrl`: Web app URL จากข้อ 3.4
   - `promptPay`: เบอร์/ชื่อบัญชีพร้อมเพย์ของร้าน
2. อัปโหลดทั้งโฟลเดอร์โปรเจกต์ (ต้องมี `web/` และ `assets/`) ขึ้นโฮสต์ฟรี วิธีง่ายสุด: https://app.netlify.com/drop → ลากโฟลเดอร์ไปวาง
3. นำ URL ที่ได้ + `/web/order.html` ไปใส่เป็น Endpoint URL ของ LIFF (ข้อ 2.4)
4. กระดานร้านอยู่ที่ URL เดียวกัน + `/web/board.html` (เปิดในมือถือ/แท็บเล็ต ใส่ PIN)

## 5. ริชเมนู (เมนูด้านล่างแชท)
รูปพร้อมใช้: `richmenu/richmenu-2500x1686.jpg` (แก้ข้อความได้ที่ `richmenu/richmenu.html` แล้วสร้างรูปใหม่ตามคำสั่งท้ายหัวข้อนี้)

1. LINE OA Manager → ริชเมนู → สร้าง
2. ตั้งช่วงเวลาแสดง และเลือก "แถบเมนู" เป็นข้อความ เช่น "สั่ง / จอง"
3. เทมเพลต: แบบ **ใหญ่ 4 ช่อง (2x2)** → อัปโหลดรูป
4. ตั้งการกระทำของแต่ละช่อง (A = ซ้ายบน, B = ขวาบน, C = ซ้ายล่าง, D = ขวาล่าง):

| ช่อง | ปุ่ม | ประเภท | ลิงก์ |
|---|---|---|---|
| A | สั่งเบอร์เกอร์ | ลิงก์ | `https://liff.line.me/LIFF_ID?tab=burger` |
| B | จองปลากระพง | ลิงก์ | `https://liff.line.me/LIFF_ID?tab=fish` |
| C | ออเดอร์ของฉัน | ลิงก์ | `https://liff.line.me/LIFF_ID?tab=mine` |
| D | โทรหาร้าน | ลิงก์ | `tel:เบอร์ร้าน` |

5. บันทึก แล้วเปิดแชทบัญชีในมือถือเพื่อลองกดทุกช่อง

สร้างรูปใหม่หลังแก้ `richmenu.html` (ต้องเปิดเซิร์ฟเวอร์ในเครื่องที่พอร์ต 8765 อยู่):
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=2500,1686 --virtual-time-budget=8000 --screenshot="$PWD/richmenu/_render.png" http://localhost:8765/richmenu/richmenu.html && sips -s format jpeg -s formatOptions 82 richmenu/_render.png --out richmenu/richmenu-2500x1686.jpg && rm richmenu/_render.png
```
(LINE รับรูป JPG/PNG ไม่เกิน 1 MB — รูปปัจจุบันประมาณ 550 KB)

## 6. ทดสอบก่อนโชว์เจ้าของร้าน
- [ ] เพิ่มเพื่อนบัญชีเดโม → ได้ข้อความต้อนรับ
- [ ] สั่งเบอร์เกอร์แบบโอน + แนบสลิป → ในแชทมีข้อความออเดอร์ → บอทตอบ "ร้านรับออเดอร์แล้ว" → กระดานขึ้นในช่อง "รับแล้ว"
- [ ] สั่งแบบจ่ายหน้าร้าน → บอทตอบ "รอร้านยืนยัน" → กระดานขึ้นในช่อง "รอยืนยัน" → กดรับ → "ออเดอร์ของฉัน" เปลี่ยนสถานะ
- [ ] เปิดรอบปลาในกระดาน → จองปลาในไลน์ → แถบยอดจองเพิ่ม
- [ ] เพิ่มออเดอร์โทรจากกระดาน → สรุปช่องทางนับถูก
- [ ] Google Sheet มีแท็บ Orders / Customers และโฟลเดอร์ "สลิปร้านครูจีน" ใน Drive

## 7. ส่งมอบให้ร้านจริง
ทำข้อ 1–5 ใหม่ทั้งหมดด้วย **บัญชี LINE และ Google ของเจ้าของร้าน** แล้วเชิญคุณเป็นแอดมิน/ผู้แก้ไข
(บัญชีเดโมเก็บไว้เป็นของคุณ ใช้โชว์ร้านอื่นต่อได้)

## ข้อควรรู้
- แก้เมนู/ราคา: แก้ทั้ง `web/config.js` และ `PRICES` ใน `apps-script/Code.gs` ให้ตรงกัน (ราคาจริงคิดที่หลังบ้าน)
  - ยกเว้นราคาปลา: ตั้งต่อรอบได้จากกระดาน (ปุ่มเปิดรอบ / แก้ไขรอบ) ค่าใน config เป็นแค่ค่าเริ่มต้นของฟอร์ม
- เปิด/ปิดตัวเลือกลดงานเจ้าของ: แก้ `rules` ในทั้งสองไฟล์ให้ตรงกัน (ดู `docs/SPEC.md` หัวข้อ 7)
- `notifyCustomerOnStatus: true` จะส่งข้อความแจ้งลูกค้าทุกครั้งที่เปลี่ยนสถานะ ซึ่งกินโควตาข้อความของแพ็กเกจ
- สลิปเก็บใน Google Drive ของบัญชีร้านแบบส่วนตัว เปิดดูได้เฉพาะบัญชีที่ล็อกอินอยู่
