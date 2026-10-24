#!/bin/sh
# Chạy một lần mỗi khi khởi động stack: sinh secret còn thiếu vào volume /secrets (không ghi đè secret đã có).
# Mỗi file là một khoá cấu hình của CMS (đọc bằng AddKeyPerFile), vd Jwt__Secret.
# Builder chỉ nhận 3 secret nó cần (volume riêng /builder-secrets) — mã theme/plugin chạy trong Builder không đọc được
# khoá ký phiên đăng nhập hay mật khẩu database.
set -eu
umask 077
cd /secrets
gen() { [ -s "$1" ] || head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$2" > "$1"; }
gen db_password 32
gen redis_password 32
gen Jwt__Secret 64
gen Frontend__RevalidateSecret 40
gen Extensions__BuilderSecret 40
gen Security__FrontendApiKey 48
# Chuỗi kết nối DB, Redis dựng từ mật khẩu đã sinh
printf 'Host=postgres;Database=cms;Username=cms;Password=%s;GSS Encryption Mode=Disable' "$(cat db_password)" > ConnectionStrings__Default
printf 'redis:6379,password=%s' "$(cat redis_password)" > ConnectionStrings__Redis

# API chạy bằng user "app" (uid 1654); Postgres (uid 70) cần đọc mật khẩu của nó; Redis đọc mật khẩu lúc khởi động (root)
chown 1654:1654 /secrets/*
chmod 600 /secrets/*
chmod 644 db_password

# Secret của Builder: chỉ tiến trình Builder (root) đọc được — mã theme/plugin chạy bằng user "node" thì không
if [ -d /builder-secrets ]; then
  for f in Extensions__BuilderSecret Frontend__RevalidateSecret Security__FrontendApiKey; do cp "$f" "/builder-secrets/$f"; done
  chown 0:0 /builder-secrets/*
  chmod 600 /builder-secrets/*
fi
echo "Secret đã sẵn sàng."
