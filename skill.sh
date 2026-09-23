#!/usr/bin/env bash
# ==============================================================================
# LOCAL ORCHESTRATOR PRO - 5 CORE SKILLS CLI AUTOMATION (skill.sh)
# Quản lý, kiểm thử, khởi chạy và cấu hình trung tâm điều phối TradingView & OKX
# ==============================================================================

set -e

# Màu sắc giao diện Terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Chuyển về đúng thư mục chứa script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ██████╗ ██╗  ██╗██╗  ██╗    ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ "
  echo " ██╔═══██╗██║ ██╔╝╚██╗██╔╝    ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗"
  echo " ██║   ██║█████╔╝  ╚███╔╝     ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝"
  echo " ██║   ██║██╔═██╗  ██╔██╗     ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗"
  echo " ╚██████╔╝██║  ██╗██╔╝ ██╗    ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║"
  echo "  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝"
  echo -e "${NC}"
  echo -e "${PURPLE}${BOLD}   ⚡ LOCAL ORCHESTRATOR PRO — HỆ THỐNG 5 CORE SKILLS ĐA KHUNG THỜI GIAN${NC}"
  echo -e "${BLUE}   🌐 Máy chủ: http://127.0.0.1:8787 | Phục vụ TradingView & OKX Futures Perp${NC}"
  echo "------------------------------------------------------------------------------"
}

print_skills() {
  echo -e "${YELLOW}${BOLD}🎯 DANH SÁCH 5 CORE SKILLS ĐÃ TÍCH HỢP TRONG HỆ THỐNG:${NC}"
  echo -e "  ${GREEN}1. Skill 1: Multi-Timeframe Consensus Radar${NC}"
  echo -e "     - Quét và phân tích đồng thuận xu hướng đa khung (15p xem phụ, 30p, 1h, 4h vào lệnh)."
  echo -e "  ${GREEN}2. Skill 2: Centralized AI Risk & Thresholds Engine${NC}"
  echo -e "     - Kiểm duyệt độc lập các ngưỡng Win Rate (>=42%), Profit Factor (>=0.8), Total PnL (>=0)."
  echo -e "  ${GREEN}3. Skill 3: Multi-Timeframe OKX Candlestick Studio${NC}"
  echo -e "     - Tự động kéo 100 nến 30m, 1H, 4H từ OKX API v5, hiển thị Lightweight Charts v5."
  echo -e "  ${GREEN}4. Skill 4: 1-Click Instant Execution & Clipboard Engine${NC}"
  echo -e "     - Sao chép tên coin chuẩn hóa (RKLBUSDT, BTCUSDT) và trọn bộ thông số Entry/TP/SL."
  echo -e "  ${GREEN}5. Skill 5: Real-Time Audio-Visual Telemetry${NC}"
  echo -e "     - Tự động đồng bộ mỗi 30s, chuông báo âm thanh Chime Web Audio API khi có kèo mới."
  echo "------------------------------------------------------------------------------"
}

cmd_check() {
  print_banner
  echo -e "${CYAN}🔍 [1/4] Kiểm tra môi trường Node.js...${NC}"
  if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo -e "  ${GREEN}✓ Node.js đã cài đặt: ${NODE_VER}${NC}"
  else
    echo -e "  ${RED}✗ Không tìm thấy Node.js! Vui lòng cài đặt Node.js v20+ trước.${NC}"
    exit 1
  fi

  echo -e "${CYAN}📦 [2/4] Kiểm tra thư viện (node_modules)...${NC}"
  if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓ node_modules đã sẵn sàng.${NC}"
  else
    echo -e "  ${YELLOW}! Đang cài đặt npm dependencies...${NC}"
    npm install
  fi

  echo -e "${CYAN}📁 [3/4] Kiểm tra file cấu hình (config.json & .env)...${NC}"
  if [ -f "config.json" ]; then
    echo -e "  ${GREEN}✓ config.json tồn tại.${NC}"
  else
    echo -e "  ${RED}✗ Thiếu file config.json!${NC}"
  fi

  if [ -f ".env" ]; then
    echo -e "  ${GREEN}✓ .env tồn tại.${NC}"
  else
    echo -e "  ${YELLOW}! Chưa có .env, đang sao chép từ .env.example...${NC}"
    cp .env.example .env
  fi

  echo -e "${CYAN}📊 [4/4] Kiểm tra cơ sở dữ liệu SQLite...${NC}"
  node -e "
    const db = require('./db');
    console.log('  \x1b[32m✓ SQLite kết nối thành công! Đang lưu trữ ' + db.getSetups({ limit: 1000 }).length + ' setup.\x1b[0m');
  "
  echo ""
  echo -e "${GREEN}${BOLD}🎉 KIỂM TRA MÔI TRƯỜNG THÀNH CÔNG! HỆ THỐNG SẴN SÀNG HOẠT ĐỘNG.${NC}"
}

cmd_test() {
  print_banner
  echo -e "${CYAN}🧪 Đang kiểm thử kết nối API nến OKX và Database...${NC}"
  node -e "
    (async () => {
      try {
        console.log('1. Kiểm tra API nến OKX Public (30m, 1H, 4H)...');
        const [r30m, r1h, r4h] = await Promise.all([
          fetch('https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP&bar=30m&limit=5').then(r=>r.json()),
          fetch('https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP&bar=1H&limit=5').then(r=>r.json()),
          fetch('https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP&bar=4H&limit=5').then(r=>r.json())
        ]);

        if (r30m.code === '0' && r1h.code === '0' && r4h.code === '0') {
          console.log('   \x1b[32m✓ OKX Candles API hoạt động hoàn hảo! Nến trả về hợp lệ.\x1b[0m');
        } else {
          console.log('   \x1b[31m✗ Lỗi phản hồi từ OKX API\x1b[0m');
        }

        console.log('2. Kiểm tra Healthcheck Server cục bộ...');
        const health = await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()).catch(()=>null);
        if (health && health.status === 'ok') {
          console.log('   \x1b[32m✓ Máy chủ đang trực tuyến tại http://127.0.0.1:8787 (Uptime: ' + health.uptimeSeconds + 's)\x1b[0m');
        } else {
          console.log('   \x1b[33m! Máy chủ chưa bật hoặc đang tắt.\x1b[0m');
        }
      } catch (e) {
        console.error('Lỗi kiểm thử:', e.message);
      }
    })();
  "
}

cmd_start() {
  print_banner
  print_skills
  echo -e "${GREEN}${BOLD}🚀 Đang khởi chạy máy chủ Local Orchestrator (Production)...${NC}"
  node server.js
}

cmd_dev() {
  print_banner
  print_skills
  echo -e "${YELLOW}${BOLD}⚡ Đang khởi chạy máy chủ ở chế độ Development (Nodemon)...${NC}"
  npx nodemon server.js || node --watch server.js
}

cmd_reset() {
  echo -e "${YELLOW}⚠️ Bạn có chắc chắn muốn xóa sạch toàn bộ lịch sử setup và nến? (y/N)${NC}"
  read -r confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    node -e "
      const db = require('./db');
      db.clearSetups();
      console.log('\x1b[32m✓ Đã xóa sạch dữ liệu setups và candles.\x1b[0m');
    "
  else
    echo "Đã hủy thao tác."
  fi
}

cmd_help() {
  print_banner
  print_skills
  echo -e "${BOLD}CÁCH SỬ DỤNG SCRIPT skill.sh:${NC}"
  echo -e "  ${CYAN}./skill.sh check${NC}    - Kiểm tra môi trường Node.js, SQLite, file cấu hình"
  echo -e "  ${CYAN}./skill.sh test${NC}     - Kiểm thử kết nối OKX Candles API & database"
  echo -e "  ${CYAN}./skill.sh start${NC}    - Chạy máy chủ Local Orchestrator (Production)"
  echo -e "  ${CYAN}./skill.sh dev${NC}      - Chạy máy chủ chế độ tự động reload (Nodemon)"
  echo -e "  ${CYAN}./skill.sh reset${NC}    - Dọn dẹp dữ liệu cũ / reset toàn bộ lịch sử"
  echo -e "  ${CYAN}./skill.sh skills${NC}   - Xem chi tiết 5 Core Skills của hệ thống"
  echo -e "  ${CYAN}./skill.sh help${NC}     - Hiển thị hướng dẫn này"
  echo ""
}

# Điều hướng lệnh
case "${1:-help}" in
  check)
    cmd_check
    ;;
  test)
    cmd_test
    ;;
  start)
    cmd_start
    ;;
  dev)
    cmd_dev
    ;;
  reset)
    cmd_reset
    ;;
  skills)
    print_banner
    print_skills
    ;;
  help|*)
    cmd_help
    ;;
esac
