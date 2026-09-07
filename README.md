# Shop drawing thép dầm

Công cụ nhập số liệu dầm bê tông cốt thép (theo quy trình shop thép dầm) và **xuất bản vẽ PDF / DWG / DXF** gồm:

- Mặt dầm (trục, gối, đai, thép tăng cường) + kích thước nhịp
- Shop nổ T1 / T2 / B2 / B1, căn theo trục như bản vẽ mẫu
- Mặt cắt **1-1 … n-n** (TL 1/25) tại gối và giữa nhịp, kèm chi tiết đai
- **Bảng thống kê cốt thép** và **Tổng hợp cốt thép** (theo Ø, thanh 11.7 m)

Trọng lượng tính theo `d² / 162.2` (kg/m), nhân với số lượng dầm (SL).

## Địa chỉ

- Trên web: [https://ntgiahuy.github.io/dam/](https://ntgiahuy.github.io/dam/)
- Mã nguồn GitHub: [ntgiahuy/dam](https://github.com/ntgiahuy/dam)

## Chạy local

```bash
npm install
npm run dev
```

Mở trình duyệt tại `/dam/` trên cổng dev (mặc định in ra terminal). Ứng dụng nạp hình học mẫu **dầm D1**: **SL = 4**, cao độ **4200**, **5 nhịp**, mỗi nhịp **L = 4000 mm**, **H = 500**, **B = 200**, **B1 = 100**, **dH = 0**; sàn **1 — Sàn hai bên**, **HSL = HSR = 120 mm**, **HL = HR = 0**; gối **Cột**, **B = 200**, **B1 = 100** (cân giữa), **H** để trống, tên trục **1 … 6**; lớp bảo vệ **25 mm**, bê tông **B25**, thép **CB400-V**; danh sách thép để trống — dùng **Thêm** trên từng tab thép để bố trí. Nút **Mới** cũng tạo **5 nhịp** L = 4000 (SL = 1).

Xuất site tĩnh cho GitHub Pages:

```bash
npm run build
```

Thư mục `out/` (sao chép sang `docs/` trên repo GitHub) là bản phát hành.

## Cách dùng

1. Khai báo **số liệu nhịp**, **sàn**, **gối đỡ**.
2. Khai báo thép chủ / bổ sung lớp trên và lớp dưới (Thêm / Sửa / Xóa).
   - Thép chủ lớp trên / lớp dưới: vị trí trục **1 … n+1** (10 nhịp → 11 trục, bắt đầu từ **1**). Kết thúc mặc định **trục cuối**. Không thêm hai dòng giống hệt (cùng Ø, số lượng và đoạn trục, ví dụ hai lần `2Ø18 (1→4)`). Đoạn khác thì được.
   - Thép chủ **lớp trên**: form mặc định **3Ø18**, vị trí **1 → trục cuối**, **cắt thép tự động** nối **30D** (nối chỉ ngoài l₀/4). Danh sách trống đến khi bấm **Thêm**.
   - Thép chủ **lớp dưới**: form mặc định **3Ø18**, vị trí **1 → trục cuối**, **không móc**, **cắt thép tự động** nối **30D**. Tick **Có móc 2 đầu** rồi nhập **chiều cao móc (mm)** nếu cần móc đứng hai đầu thanh (mặc định max(20d, 400) khi mới tick).
   - Thép chủ dài hơn **11,7 m** được cắt tự động khi xuất PDF. **Cắt thép tự động** mặc định **bật**. Chọn nối **30D / 35D / 40D**. **Lớp dưới** chỉ nối **trong** vùng gối l₀/4; **lớp trên** chỉ nối **ngoài** l₀/4 (giữa nhịp). **Mặt dầm và mặt cắt** chỉ ghi số hiệu **1, 2…** (không 1a/1b, không DIM đoạn nối). Shop nổ tách **1a / 1b / 1c** kèm DIM, đoạn nối xếp **trên–dưới** xen kẽ cho gọn.
   - Thép bổ sung: không thêm hai dòng giống hệt (cùng lớp, Ø, số lượng và đoạn trục, ví dụ hai lần `Lớp 2: 2Ø20 (0→1)`). Vẫn được nhiều thanh cùng lớp nếu đoạn khác nhau (`0→1`, `0→2`, …).
   - Thép bổ sung **lớp trên**: form mặc định **lớp 2** (cách lớp chủ 25 mm), **2Ø20**, đoạn **0→0** (gối đầu), dạng **1 — Cắt thẳng M- tại gối, l₀/4** hai đầu (làm tròn 50 mm; l₀=9825 → **2450**). Vị trí **0→0, 1→1, 2→2…** (một gối). Bấm **Thêm** tự chuyển sang gối kế. **Gối biên** bẻ móc 2/3H (H=500 → 350); đoạn thẳng **không cộng** bề rộng cột. Dạng **2** — tới tim cột.
   - Thép bổ sung **lớp dưới**: form mặc định **lớp 2** (cách lớp chủ 25 mm), **2Ø20**, đoạn **0→1**, dạng **1 — Cắt thẳng M+ giữa nhịp** hai đầu. Vị trí **0→1, 1→2, 2→3…** (một nhịp). Bấm **Thêm** tự chuyển sang nhịp kế.
   - Thép bổ sung **lớp dưới**, dạng 1 (**M+ giữa nhịp**): chiều dài `l₀/2 + 2·max(h₀, 15d, l₀/16)`, dư 50 mm mỗi đầu rồi làm tròn 50 mm. Dạng 2–4 (mép gối / tim cột / móc 90°) giữ nguyên.
3. Khai báo **thép đai**: mặc định **Ø8**, bố trí **1/4**, **A1 = 100 mm**, **A2 = 200 mm**. Chọn **Đai điều** nếu cần một khoảng trên cả nhịp. Với 1/4, chiều dài vùng gối **tự bằng thép tăng cường M-** (không có thì l₀/4).
   - **Thép bổ sung** (shop thép cột): **Đai C** khi một lớp thép chủ có số thanh lẻ, hoặc khi tick thép chống phình. **Đai lồng** / **Đai kép** chỉ hiện khi một lớp thép chủ ≥ 4 thanh. **Đai kép thay đai đơn** — không vẽ / không thống kê đai đơn; cạnh ngắn theo B = 2/3 đai đơn, ôm ngoài thép chủ được ôm. Lồng và kép loại trừ nhau. Mỗi loại chọn Ø6 / 8 / 10 / 12 / 14. **Thép chống phình** vẽ trên mặt dầm và shop nổ (2Ø); chọn **1 / 2 / 3 đoạn** — `L` từ **tim gối đầu** đến **tim gối cuối** khoảng đó; hàng **CP nằm giữa M− và M+**; cùng Ø dùng **một số hiệu**, ghi `L=…-CP`. Mặt cắt: số hiệu đai đơn ở **2/3 H**, chống phình giữa H; đai C ghi **số hiệu** (Cx móc chống phình / Cy đứng), không ghi chữ C. Dưới **TL: 1/25** không còn khối chú thích.
4. (Tuỳ chọn) dầm phụ / trụ trên dầm và đai gia cường chống cắt.
5. Điền **thông tin dầm** (tên, số lượng, cao độ).
6. Bấm **Xuất PDF** — khổ A2 ngang, tiêu đề `{Tên} (SL=…; L=…)` và `TL: 1/50` dưới mặt dầm. Dầm dài / nhiều mặt cắt: các mặt cắt **xuống hàng** (không đè nhau); bảng kê nhiều số hiệu **sang trang 2**.
7. Bấm **Xuất CAD (DWG)** khi dầm lớn — file DWG thật (AutoCAD 2013, đơn vị mm, mặt dầm TL 1/50), không bị cắt theo khổ giấy. **Xuất DXF** vẫn có nếu cần NanoCAD / LibreCAD.

Dữ liệu được lưu tự động trên trình duyệt (localStorage). **Save As** mở hộp thoại chọn nơi lưu (tên mặc định `[Giahuy.net]-shop_dam.json`); **Open** mở lại file đó để sửa. Dùng Chrome hoặc Edge để hiện hộp thoại. **Mẫu D1** khôi phục bộ số liệu demo.

Nhấp vào nhịp hoặc gối trên bản vẽ preview để chọn đối tượng đang sửa.
