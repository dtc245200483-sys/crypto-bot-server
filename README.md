# Local Orchestrator Server (Node.js Express + SQLite)

Máy chủ trung tâm chạy nội bộ (Windows), đóng vai trò nhận dữ liệu tín hiệu từ 2 extension (**OKX Futures Scanner** và **TradingView Multi-Timeframe Scanner**), lưu trữ vào SQLite cục bộ, tự động xác thực ngưỡng lọc và cung cấp Web Dashboard hiển thị các kèo đẹp.

---

## 🌟 Tính Năng Nổi Bật

1. **Express Server Cục Bộ**: Bind an toàn tại `127.0.0.1:8787` (cấu hình trong `.env`).
2. **Cơ Sở Dữ Liệu SQLite**: Lưu trữ file cục bộ `data/orchestrator.db` không cần cài server DB rời (tương thích cả `better-sqlite3` và native `node:sqlite` của Node.js).
3. **Nút Sao Chép Tên Coin Trực Tiếp**: Ngay cạnh tên từng con ở cột *Symbol & Hợp đồng*, có nút "Chép" 1 chạm để sao chép nhanh tên coin dán vào TradingView/OKX.
4. **Tự Động Thu Thập Nến OKX 3 Khung (30m, 1H, 4H)**: Ngay khi setup được duyệt và lưu vào SQLite, server tự động gọi OKX API public lấy 100 nến của 3 khung `30m`, `1H`, `4H` bất đồng bộ và lưu vào bảng `candles`.
5. **Biểu Đồ Nến Mini Tương Tác (TradingView Lightweight Charts)**: Bấm "Xem nến" trên mỗi dòng để mở rộng 3 biểu đồ nến mini tương ứng 3 khung thời gian, kèm đường kẻ giá tự động cho **Entry** (Cyan), **Stop Loss** (Đỏ), **TP1/TP2/TP3** (Xanh lá).
6. **Nút Tải Nến Thủ Công**: Nếu setup chưa kịp có nến, giao diện hiện nút "Tải nến" để kích hoạt lấy nến tức thì.
7. **Xác Thực Ngưỡng Tập Trung (`config.json`)**: Server tự động kiểm tra lại toàn bộ ngưỡng (`winRate >= 42%`, `profitFactor >= 0.8`, `totalPnL >= 0`, khung vào lệnh `30m/1h/4h`, khung `15m` chỉ xem xác nhận) trước khi lưu.
8. **Nhật Ký Hàng Ngày**: Mọi request/response được ghi tuần tự vào `logs/app.log` phục vụ debug khi chạy qua đêm.

---

## 📁 Cấu Trúc Thư Mục

```
local-server/
├── package.json         # Danh sách thư viện và lệnh start/dev
├── .env                 # File cấu hình môi trường (PORT=8787, HOST=127.0.0.1)
├── .env.example         # File mẫu biến môi trường
├── config.json          # Cấu hình tập trung các ngưỡng lọc
├── server.js            # Entry point chính của máy chủ Express & OKX Candles engine
├── db.js                # Quản lý kết nối SQLite, bảng setups & bảng candles
├── logger.js            # Ghi nhật ký vào console và file logs/app.log
├── public/              # Giao diện Web Dashboard tĩnh
│   ├── index.html       # Cấu trúc HTML dashboard
│   ├── style.css        # Giao diện Dark Theme chuyên nghiệp
│   ├── app.js           # Client script: fetch /api/setups, lightweight charts
│   └── vendor/          # Thư viện Lightweight Charts nội bộ (offline-first)
├── logs/                # Thư mục chứa file log
│   └── app.log          # File log tổng hợp
└── data/                # Thư mục chứa file database SQLite
    └── orchestrator.db  # Database SQLite cục bộ (setups, candles, tv_webhooks)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Server

### 1. Cài đặt thư viện:
Mở PowerShell tại thư mục dự án:
```powershell
cd "D:\ung dung tri tue nhan tao\okx\local-server"
npm install
```

### 2. Khởi chạy máy chủ:
- Chế độ Production:
  ```powershell
  npm start
  ```
- Chế độ tự động reload khi sửa code với nodemon:
  ```powershell
  npm run dev
  ```

### 3. Mở giao diện Web Dashboard:
Mở trình duyệt truy cập:
```
http://localhost:8787
```

---

## 🔌 Danh Sách API Endpoints

| Phương thức | Đường dẫn | Chức năng |
| :--- | :--- | :--- |
| `POST` | `/api/tv-webhook` | Nhận JSON Alert Webhook từ TradingView. |
| `POST` | `/api/setups` | Nhận kết quả setup từ Extension, validate ngưỡng và tự động kéo nến OKX 3 khung. |
| `GET` | `/api/setups?limit=50&status=active` | Lấy danh sách setup mới nhất (kèm trường `hasCandles: boolean`). |
| `GET` | `/api/setups/:id/candles` | Lấy dữ liệu nến 3 khung `30m`, `1H`, `4H` (sắp xếp tăng dần theo thời gian). |
| `POST` | `/api/setups/:id/candles/sync` | Kích hoạt lấy và đồng bộ nến thủ công từ OKX API. |
| `GET` | `/api/indicator-data?symbol=...&timeframe=...` | Cho phép tra cứu alert webhook mới nhất của một symbol/khung. |
| `GET` | `/api/okx-symbols` | Endpoint dự phòng trả về danh sách symbol hợp đồng OKX. |
| `GET` | `/api/config` & `POST /api/config` | Xem và cập nhật cấu hình ngưỡng lọc của server. |
| `DELETE` | `/api/setups` | Xóa sạch toàn bộ lịch sử setup và nến. |
| `GET` | `/api/health` | Kiểm tra tình trạng máy chủ. |

---

## 📡 Cấu Hình Alert Webhook Trên TradingView UI

Để TradingView bắn tín hiệu tự động vào máy chủ:
1. Mở biểu đồ TradingView với layout indicator của bạn.
2. Bấm `Alt + A` (Create Alert).
3. Tại tab **Notifications**: Tích chọn **Webhook URL** và điền:
   ```
   http://localhost:8787/api/tv-webhook
   ```
   *(Lưu ý: Nếu máy TradingView chạy trên cloud không kết nối trực tiếp được IP nội bộ `localhost`, bạn có thể dùng công cụ như ngrok/localtunnel để tạo tunnel URL trỏ về cổng `8787`).*
4. Tại ô **Message**, điền cú pháp JSON:
   ```json
   {
     "symbol": "{{ticker}}",
     "timeframe": "{{interval}}",
     "signal": "{{strategy.order.action}}",
     "entry": {{close}},
     "tp1": 0,
     "tp2": 0,
     "tp3": 0,
     "sl": 0,
     "winRate": 48.5,
     "profitFactor": 1.25,
     "totalPnL": 520.0
   }
   ```

---

## 🔗 Danh Sách Những Chỗ Cần Khớp Nối Cả 3 Prompt

1. **Extension 1 (OKX Scanner)**:
   - Cài đặt qua `chrome://extensions` (Load unpacked).
   - Lấy chuỗi **Extension ID** (32 ký tự).
2. **Extension 2 (TradingView Scanner)**:
   - Mở Popup của Extension 2.
   - Điền chuỗi **OKX Extension ID**.
   - Điền **Chart Layout ID** của TradingView.
   - Cổng kết nối Orchestrator mặc định đã được cấu hình chuẩn: **`8787`**.
3. **Local Orchestrator Server**:
   - Chạy trên cổng **`8787`**.
   - Mở `http://localhost:8787` để thưởng thức giao diện Dashboard trực quan.
