#!/usr/bin/env bash
# AND — 기기 조건을 바꿔 가며 앱이 견디는지 본다. 각 조건마다 화면과 로그를 남긴다.
# 기준선 9797477fe73a (4.8.14 / build 29804584)
#
# 실행: bash verification/adversarial-4.8.13/tools/and/and-matrix.sh [반복회차]
set -u
export MSYS_NO_PATHCONV=1

ADB="${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe"
PKG=com.gyo6.jobskill
RUN="${1:-1}"
EV="D:/apps/sugar-salt-campus/verification/adversarial-4.8.13/evidence/and/run${RUN}"
mkdir -p "$EV"

log() { echo "[$(date +%H:%M:%S)] $*"; }

launch() {
  "$ADB" shell am force-stop $PKG
  "$ADB" logcat -c
  "$ADB" shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 11
}

# 조건 이름으로 증거를 남기고, 그 사이 오류 로그를 센다.
capture() {
  local name="$1"
  "$ADB" exec-out screencap -p > "$EV/${name}.png"
  local errs
  errs=$("$ADB" logcat -d 2>/dev/null | grep -icE "ErrorBoundary|FATAL EXCEPTION|AndroidRuntime: E|Uncaught|chromium: \[ERROR:.*(render|crash)" || true)
  local size
  size=$(stat -c%s "$EV/${name}.png" 2>/dev/null || echo 0)
  echo "${name},${errs},${size}" >> "$EV/summary.csv"
  log "$name — 오류로그 ${errs}건 · 화면 ${size}B"
}

echo "condition,error_log_lines,screenshot_bytes" > "$EV/summary.csv"

log "기본 상태"
launch; capture "01-base"

# ── 노치·컷아웃 ────────────────────────────────────────────────────────────
for cut in corner tall waterfall; do
  "$ADB" shell cmd overlay enable "com.android.internal.display.cutout.emulation.${cut}" >/dev/null 2>&1
  sleep 3; launch; capture "02-cutout-${cut}"
  "$ADB" shell cmd overlay disable "com.android.internal.display.cutout.emulation.${cut}" >/dev/null 2>&1
  sleep 2
done

# ── 제스처 내비 vs 3버튼 ───────────────────────────────────────────────────
for nav in gestural threebutton; do
  "$ADB" shell cmd overlay enable "com.android.internal.systemui.navbar.${nav}" >/dev/null 2>&1
  sleep 3; launch; capture "03-nav-${nav}"
done
"$ADB" shell cmd overlay enable com.android.internal.systemui.navbar.gestural >/dev/null 2>&1

# ── 가로 회전 ──────────────────────────────────────────────────────────────
"$ADB" shell settings put system accelerometer_rotation 0
"$ADB" shell settings put system user_rotation 1
sleep 3; capture "04-rotate-landscape"
"$ADB" shell settings put system user_rotation 0
sleep 3; capture "04-rotate-portrait"

# ── 폰트 크게 / 디스플레이 크게 ────────────────────────────────────────────
"$ADB" shell settings put system font_scale 1.30
sleep 2; launch; capture "05-font130"
"$ADB" shell settings put system font_scale 1.00
"$ADB" shell wm density 480
sleep 3; launch; capture "06-density480"
"$ADB" shell wm density reset
sleep 3

# ── 뒤로가기 연타 · 강제 종료 후 재실행 ────────────────────────────────────
launch
for i in 1 2 3 4 5; do "$ADB" shell input keyevent KEYCODE_BACK; sleep 0.4; done
sleep 2; capture "07-back-x5"
launch; capture "07-relaunch"

# ── 네트워크 단절 → 복구 ───────────────────────────────────────────────────
launch
"$ADB" shell svc wifi disable; "$ADB" shell svc data disable
sleep 6; capture "08-offline"
"$ADB" shell svc wifi enable; "$ADB" shell svc data enable
sleep 10; capture "08-online-recovered"

# ── 알림 권한 거부 → 허용 ──────────────────────────────────────────────────
"$ADB" shell pm revoke $PKG android.permission.POST_NOTIFICATIONS >/dev/null 2>&1
launch; capture "09-notif-revoked"
"$ADB" shell pm grant $PKG android.permission.POST_NOTIFICATIONS >/dev/null 2>&1
launch; capture "09-notif-granted"

# ── 성능·메모리 지표 ───────────────────────────────────────────────────────
"$ADB" shell dumpsys gfxinfo $PKG framestats > "$EV/gfxinfo.txt" 2>&1
"$ADB" shell dumpsys meminfo $PKG > "$EV/meminfo.txt" 2>&1
"$ADB" shell dumpsys battery > "$EV/battery.txt" 2>&1
"$ADB" shell dumpsys window displays > "$EV/window-displays.txt" 2>&1

log "완료 — 증거: $EV"
cat "$EV/summary.csv"
