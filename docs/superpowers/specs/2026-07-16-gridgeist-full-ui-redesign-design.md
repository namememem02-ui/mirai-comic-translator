# ComicTranslator Gridgeist Full UI Redesign

**วันที่:** 2026-07-16  
**สถานะ:** อนุมัติทิศทาง Compatibility-first  
**ขอบเขต:** Workspace หลัก, Settings, Export และ Chapter Review

## เป้าหมาย

ปรับ ComicTranslator ให้เป็น Translation Workbench ที่อ่านง่าย ใช้งานเต็มจอได้มีประสิทธิภาพ และมีลำดับคำสั่งชัดเจน โดยรักษาพฤติกรรมเดิมทั้งหมด รวมถึงการเปิดโปรเจกต์ แปล แก้กรอบข้อความ รีทัช ทาสี ลายน้ำ รีวิว ส่งออก Facebook และการตั้งค่า

## Visual thesis

โต๊ะแปลการ์ตูนที่แม่นยำ: Canvas เป็นพื้นที่หลัก ข้อมูลเกาะอยู่บนรางที่ชัด และคำสั่งปรากฏตามขั้นตอนของงาน โดยใช้เส้นกริด ตัวอักษร และระยะห่างเป็นภาษาภาพหลัก

## แนวทางที่เลือก

ใช้ **Compatibility-first structural redesign**: จัดกลุ่มและจัดวาง HTML/CSS ใหม่ได้ แต่ต้องคง DOM contract ที่ JavaScript ใช้อยู่ ไม่เขียน renderer ใหม่และไม่เปลี่ยน data flow

ข้อห้าม:

- ห้ามลบหรือเปลี่ยน `id` ที่ `src/index.js` อ้างถึง
- ห้ามเปลี่ยน event handler, IPC contract, Canvas drawing pipeline หรือรูปแบบข้อมูลที่บันทึก
- ห้ามเปลี่ยนลำดับชั้นของ Canvas, SVG overlay, watermark และ paint layer จนทำให้การวาดหรือ pointer interaction ต่างจากเดิม
- ห้ามลดความสามารถหรือซ่อนฟังก์ชันจนผู้ใช้เข้าถึงไม่ได้
- ห้ามเพิ่ม UI framework หรือ runtime dependency ใหม่

## โครงสร้าง Workspace

Workspace ใช้สามราง:

1. **Page Rail** ด้านซ้าย แสดงการเปิดโฟลเดอร์ โปรเจกต์ที่บันทึก ข้อมูลตอน และรายการหน้าแบบกระชับ
2. **Canvas Stage** ตรงกลาง เป็นพื้นที่เด่นที่สุด มีชื่อหน้า มุมมอง ซูม และคำสั่งแปลหลักอยู่เหนือ Canvas
3. **Inspector** ด้านขวา แสดงคำศัพท์ รายการบทสนทนา การค้นหา และการแก้ไขตามสิ่งที่เลือก

Toolbar แบ่งเป็นสองระดับเท่านั้น:

- Command bar: แปลหน้านี้ แปลทั้งหมด ดูคำแปล รีวิวรวม และส่งออก
- Context tool bar: เลือก เพิ่มกรอบ แปรง ทาสี ลายน้ำ Undo/Redo และตัวเลือกเฉพาะเครื่องมือ

ทุกปุ่มเดิมยังอยู่และยังใช้ `id` เดิม การเปลี่ยนเป็นกลุ่มหรือย้ายตำแหน่งต้องไม่เปลี่ยนพฤติกรรม

## ระบบภาพ

- พื้นหลังสีเข้มเป็นกลาง เพื่อให้ภาพการ์ตูนและสถานะงานเด่นกว่า chrome ของโปรแกรม
- ใช้ accent ฟ้าเพียงตระกูลเดียวสำหรับ active/primary; เขียวสำหรับสำเร็จ; ส้มสำหรับคำเตือน; แดงสำหรับหยุดหรือลบ
- ลด gradient, emoji และสีตกแต่งที่ไม่สื่อสถานะ
- ใช้เส้น 1px แบ่งรางและส่วนงาน แทนการใส่กรอบโค้งทุกกล่อง
- Radius ใช้ชุดเล็กและสม่ำเสมอ: 0, 4, 8px
- ตัวอักษร UI ขั้นต่ำ 13px ที่ scale 100%; เนื้อหาหลัก 14px; heading 16–20px
- Mono ใช้เฉพาะเลขหน้า เปอร์เซ็นต์ซูม จำนวนรายการ และ metadata
- spacing ใช้ token 4, 8, 12, 16, 24, 32px

## Page Rail

- ความกว้างตั้งต้นประมาณ 220–248px และยังตอบสนองต่อระบบ UI Scale เดิม
- Thumbnail แต่ละหน้าเป็นแถวกระชับ มีภาพย่อ เลขหน้า ชื่อไฟล์ และสถานะแปล
- หน้าที่เลือกต้องเห็นชัดด้วย accent bar และพื้นหลัง ไม่พึ่งสีอย่างเดียว
- Drop zone, Saved Projects และ Project Info ยังทำงานเดิม

## Canvas Stage

- Canvas ได้พื้นที่มากที่สุดและไม่ถูก Toolbar หลายแถวเบียด
- Zoom, Fit Width และ Fit Page ยังเข้าถึงได้ตลอด
- รักษา `viewportContainer`, `activeImage`, Canvas ทุก layer และ `bubbleOverlay` ตาม DOM contract เดิม
- Loading, placeholder, preview และ tool state ต้องแสดงชัดโดยไม่บดบังงานเกินจำเป็น

## Inspector

- Glossary และ Dialogues เป็นส่วนที่แยกชัด แต่ไม่ทำเป็นการ์ดซ้อนหลายชั้น
- Search และ Add Bubble อยู่ใกล้หัวข้อรายการบทสนทนา
- Bubble editor ที่ renderer สร้างแบบ dynamic ต้องรับ visual system เดียวกันผ่าน class selector โดยไม่เปลี่ยนข้อมูลหรือ event
- สถานะ selected, editing, error และ empty ต้องอ่านได้ชัด

## Settings

- แบ่งเป็นหมวด API, Interface, Typography และ Processing
- Label อยู่เหนือ control; helper/status อยู่ใต้ control
- Footer มี Cancel/Close และ Save โดย Save เป็น primary action เพียงจุดเดียว
- Input และ `id` เดิมทั้งหมดต้องคงอยู่ รวม UI Scale, font size, font family, alignment และ inpaint mode

## Export

- แสดงลำดับงาน: เลือกขอบเขต → ตั้งชื่อ/ตัวเลือก → ตรวจจำนวน → ส่งออก
- โหมดทั้งหมดและเลือกหน้าเองยังอยู่ครบ
- Facebook archive name และจำนวนภาพสูงสุดยังทำงานเดิม
- Progress, Cancel, Facebook Export และ Export ปกติยังใช้ event เดิม
- ห้ามเปลี่ยน logic การตั้งชื่อไฟล์ ZIP หรือไฟล์ภายใน

## Chapter Review

- เป็น review workspace เต็มพื้นที่ มี selector ซ้ายและ continuous preview กลาง
- ปุ่มความกว้าง ชื่อไฟล์ เส้นแบ่งหน้า การเลือกทั้งหมด/ไม่เลือก/เฉพาะแปลแล้ว และปิด ยังอยู่ครบ
- แถบควบคุมต้อง sticky และ preview ต้องไม่ถูกบีบจนอ่านไม่ได้

## Responsive behavior

- `>= 1280px`: สามรางเต็ม
- `960–1279px`: Page Rail แคบลง, Inspector คงใช้งานได้, toolbar wrap แบบมีลำดับ
- `< 960px`: Inspector ย้ายลงหรือเป็น overlay panel โดย control ทุกตัวต้องเข้าถึงได้
- `< 720px`: Page Rail เป็น drawer/stack และ Canvas มาก่อน; dialog ใช้เกือบเต็ม viewport
- Responsive ต้องเป็นการจัดองค์ประกอบใหม่ ไม่ใช่ย่อทุกอย่างจนตัวหนังสือเล็ก

## Accessibility และ interaction

- Focus ring เห็นชัดบน button, input, select และ editable content
- ขนาดเป้ากดขั้นต่ำ 32px สำหรับ dense desktop และ 40px ใน layout แคบ
- สถานะ disabled, active, selected และ destructive แยกจากกันอย่างชัดเจน
- รองรับ `prefers-reduced-motion`
- ห้ามเพิ่ม interaction ที่ต้องใช้ hover อย่างเดียว

## การป้องกัน regression

ก่อนแก้ production code ต้องเพิ่ม contract tests ที่ล้มเหลวเมื่อ:

- DOM `id` ที่ renderer ต้องใช้หายไปหรือซ้ำ
- Canvas/overlay layer สำคัญหาย หรือ z-order contract ถูกเปลี่ยน
- Workspace, Settings, Export หรือ Chapter Review ขาด control เดิม
- CSS ไม่มี responsive breakpoints, focus-visible หรือ reduced-motion contract ตามสเปก

จากนั้นรัน `npm test` ทั้งชุด และทดสอบ smoke flow ใน Electron อย่างน้อย:

1. เปิดโฟลเดอร์และเลือกหน้า
2. ซูม/Fit Width/Fit Page
3. แปลหน้าเดียวและทุกหน้า รวม Stop
4. Preview, แก้กรอบ, เพิ่มกรอบ, Brush, Paint, Undo/Redo และ Watermark
5. Glossary, search และแก้ข้อความ
6. Settings และบันทึกค่า
7. Chapter Review
8. Export ทั้งหมด, เลือกหน้า และ Facebook ZIP

## เกณฑ์สำเร็จ

- ฟังก์ชันและข้อมูลเดิมยังทำงานครบ
- Canvas เป็นพื้นที่เด่นและมีพื้นที่ใช้งานมากขึ้นอย่างเห็นได้ชัด
- ผู้ใช้แยก primary, secondary, active และ destructive actions ได้ทันที
- ตัวหนังสืออ่านง่ายเมื่อขยายเต็มจอและยังตอบสนองต่อ UI Scale เดิม
- ทุกหน้ามี grid, typography, color และ interaction system เดียวกัน
- ชุดทดสอบเดิมและ contract tests ใหม่ผ่านทั้งหมด

