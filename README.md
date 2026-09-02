# Blogger thép bê tông PDF

Công cụ nhập số liệu dầm bê tông cốt thép (theo quy trình shop thép dầm) và **xuất bản vẽ PDF** gồm:

- Shop thép lớp trên / lớp dưới (thanh chủ + bổ sung, móc neo)
- Mặt cắt dọc dầm, gối, đai, ghi kích thước nhịp
- Mặt cắt ngang **MC 1-1** (vùng gối) và **MC 2-2** (giữa nhịp)
- **Bảng thống kê cốt thép**: hình dạng, đường kính, chiều dài, số lượng 1 CK / toàn bộ, trọng lượng

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
   - Thép bổ sung: không thêm hai dòng giống hệt (cùng lớp, Ø, số lượng và đoạn trục, ví dụ hai lần `Lớp 2: 2Ø20 (0→1)`). Vẫn được nhiều thanh cùng lớp nếu đoạn khác nhau (`0→1`, `0→2`, …).
   - Thép bổ sung **lớp trên**: vị trí **0→0, 1→1, 2→2…** (một gối). Bấm **Thêm** tự chuyển sang gối kế. Dạng **1** — M- tại gối, đoạn thẳng **l₀/4** làm tròn 50 mm (l₀=9825 → **2450**). **Gối biên** bẻ móc 2/3H (H=500 → 350); đoạn thẳng **không cộng** bề rộng cột. Dạng **2** — tới tim cột.
   - Thép bổ sung **lớp dưới**, dạng 1 (**M+ giữa nhịp**): chiều dài `l₀/2 + 2·max(h₀, 15d, l₀/16)`, dư 50 mm mỗi đầu rồi làm tròn 50 mm. Dạng 2–4 (mép gối / tim cột / móc 90°) giữ nguyên.
3. Khai báo **thép đai** theo 3 vùng mỗi nhịp (gối trái – giữa – gối phải).
4. (Tuỳ chọn) dầm phụ / trụ trên dầm và đai gia cường chống cắt.
5. Điền **thông tin dầm** (tên, số lượng, cao độ).
6. Bấm **Xuất PDF** — file A2 ngang, tiêu đề `KẾT CẤU DẦM …`.

Dữ liệu được lưu tự động trên trình duyệt (localStorage). **Mẫu D1** khôi phục bộ số liệu demo.

Nhấp vào nhịp hoặc gối trên bản vẽ preview để chọn đối tượng đang sửa.
