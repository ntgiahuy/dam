# Shop drawing thép dầm

Công cụ nhập số liệu dầm bê tông cốt thép (theo quy trình shop thép dầm) và **xuất bản vẽ PDF** gồm:

- Mặt dầm (trục, gối, đai, thép tăng cường) + kích thước nhịp
- Shop nổ T1 / T2 / B2 / B1, căn theo trục như bản vẽ mẫu
- Mặt cắt **1-1 … n-n** (TL 1/25) tại gối và giữa nhịp, kèm chi tiết đai
- **Bảng thống kê cốt thép** và **Tổng hợp cốt thép** (theo Ø, thanh 11.7 m)

Trọng lượng tính theo `d² / 162.2` (kg/m), nhân với số lượng dầm (SL).

## Địa chỉ

- Trên web: [https://dam.giahuy.net/](https://dam.giahuy.net/)
- Mã nguồn GitHub: [ntgiahuy/dam](https://github.com/ntgiahuy/dam)

## Chạy local

```bash
npm install
npm run dev
```

Mở trình duyệt tại cổng dev (mặc định in ra terminal). Ứng dụng nạp hình học mẫu **dầm D1** (5 nhịp); danh sách thép để trống — dùng **Thêm** trên từng tab thép để bố trí.

Xuất site tĩnh cho GitHub Pages:

```bash
npm run build
```

Thư mục `out/` (sao chép sang `docs/` trên repo GitHub) là bản phát hành.

## Cách dùng

1. Khai báo **số liệu nhịp**, **sàn**, **gối đỡ**.
2. Khai báo thép chủ / bổ sung lớp trên và lớp dưới (Thêm / Sửa / Xóa).
   - Thép chủ lớp trên / lớp dưới: không thêm hai dòng giống hệt (cùng Ø, số lượng và đoạn trục, ví dụ hai lần `2Ø18 (0→3)`). Đoạn khác thì được.
   - Thép chủ **lớp dưới**: mặc định **không móc**. Tick **Có móc 2 đầu** rồi nhập **chiều cao móc (mm)** nếu cần móc đứng hai đầu thanh (mặc định max(20d, 400) khi mới tick).
   - Thép chủ dài hơn **11,7 m** được cắt tự động khi xuất PDF. **Cắt thép tự động** mặc định **bật**. Chọn nối **30D / 35D / 40D**. **Lớp dưới** chỉ nối **trong** vùng gối l₀/4; **lớp trên** chỉ nối **ngoài** l₀/4 (giữa nhịp). **Mặt dầm** chỉ ghi số hiệu **1, 2…** (không 1a/1b, không DIM đoạn nối). Shop nổ tách **1a / 1b / 1c** kèm DIM, đoạn nối xếp **trên–dưới** xen kẽ cho gọn.
   - Thép bổ sung: không thêm hai dòng giống hệt (cùng lớp, Ø, số lượng và đoạn trục, ví dụ hai lần `Lớp 2: 2Ø20 (0→1)`). Vẫn được nhiều thanh cùng lớp nếu đoạn khác nhau (`0→1`, `0→2`, …).
   - Thép bổ sung **lớp trên**: vị trí **0→0, 1→1, 2→2…** (một gối). Bấm **Thêm** tự chuyển sang gối kế.
   - Thép bổ sung **lớp dưới**: vị trí **0→1, 1→2, 2→3…** (một nhịp). Bấm **Thêm** tự chuyển sang nhịp kế.
   - Thép bổ sung **lớp trên**: dạng **1** — M- tại gối, đoạn thẳng **l₀/4** làm tròn 50 mm (l₀=9825 → **2450**). **Gối biên** bẻ móc 2/3H (H=500 → 350); đoạn thẳng **không cộng** bề rộng cột. Dạng **2** — tới tim cột.
   - Thép bổ sung **lớp dưới**, dạng 1 (**M+ giữa nhịp**): chiều dài `l₀/2 + 2·max(h₀, 15d, l₀/16)`, dư 50 mm mỗi đầu rồi làm tròn 50 mm. Dạng 2–4 (mép gối / tim cột / móc 90°) giữ nguyên.
3. Khai báo **thép đai**: Ø, cách bố trí (**1/4** hoặc **Đai điều**), khoảng A1/A2 (1/4) hoặc một khoảng (đai điều), kiểu đai đơn/kép. Với 1/4, chiều dài vùng gối **tự bằng thép tăng cường M-** (không có thì l₀/4).
4. (Tuỳ chọn) dầm phụ / trụ trên dầm và đai gia cường chống cắt.
5. Điền **thông tin dầm** (tên, số lượng, cao độ).
6. Bấm **Xuất PDF** — khổ A2 ngang, tiêu đề `{Tên} (SL=…; L=…)` và `TL: 1/50` dưới mặt dầm.

Dữ liệu được lưu tự động trên trình duyệt (localStorage). **Save As** tải file `[Giahuy.net]-shop_dam.json`; **Open** mở lại file đó để sửa. **Mẫu D1** khôi phục bộ số liệu demo.

Nhấp vào nhịp hoặc gối trên bản vẽ preview để chọn đối tượng đang sửa.
