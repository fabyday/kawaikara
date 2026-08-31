#!/usr/bin/env bash

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
private_dir="$root/private"
key_path="$private_dir/fabyday.key"
certificate_path="$private_dir/fabyday.crt"
pfx_path="$private_dir/fabyday.pfx"
password_path="$private_dir/fabyday.pfx.password"
not_after='99991231235959Z'

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

resolve_openssl() {
  local candidate
  local candidates=()

  if [[ -n "${KAWAIKARA_OPENSSL:-}" ]]; then
    candidates+=("$KAWAIKARA_OPENSSL")
  fi
  if command -v openssl >/dev/null 2>&1; then
    candidates+=("$(command -v openssl)")
  fi
  candidates+=(
    '/opt/homebrew/opt/openssl@3/bin/openssl'
    '/opt/homebrew/bin/openssl'
    '/usr/local/opt/openssl@3/bin/openssl'
  )

  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]] && "$candidate" req -help 2>&1 | grep -q -- '-not_after'; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  fail 'OpenSSL with req -not_after support is required (Homebrew openssl@3 3.6 or newer).'
}

[[ -f "$key_path" ]] || fail "Existing private key not found: $key_path"
mkdir -p "$private_dir"
chmod 700 "$private_dir"

openssl_bin="$(resolve_openssl)"
"$openssl_bin" pkey -in "$key_path" -check -noout >/dev/null

if [[ -n "${KAWAIKARA_CERT_PASSWORD:-}" ]]; then
  pfx_password="$KAWAIKARA_CERT_PASSWORD"
elif [[ -f "$password_path" ]]; then
  pfx_password="$(tr -d '\r\n' < "$password_path")"
else
  pfx_password="$("$openssl_bin" rand -base64 36 | tr -d '\r\n')"
  umask 077
  printf '%s\n' "$pfx_password" > "$password_path"
fi
[[ -n "$pfx_password" ]] || fail 'The PKCS#12 password must not be empty.'

temporary_dir="$(mktemp -d "$private_dir/.macos-cert.XXXXXX")"
cleanup() {
  find "$temporary_dir" -type f -delete 2>/dev/null || true
  find "$temporary_dir" -depth -type d -empty -delete 2>/dev/null || true
}
trap cleanup EXIT

temporary_certificate="$temporary_dir/fabyday.crt"
temporary_pfx="$temporary_dir/fabyday.pfx"

"$openssl_bin" req -x509 \
  -config /dev/null \
  -key "$key_path" \
  -out "$temporary_certificate" \
  -sha256 \
  -not_after "$not_after" \
  -subj '/CN=Kawaikara Self-Signed Code Signing/O=Kawaikara' \
  -addext 'basicConstraints=critical,CA:FALSE' \
  -addext 'keyUsage=critical,digitalSignature' \
  -addext 'extendedKeyUsage=critical,codeSigning'

# OpenSSL 3 defaults to PKCS#12 algorithms that macOS Keychain cannot import.
"$openssl_bin" pkcs12 -export -legacy \
  -out "$temporary_pfx" \
  -inkey "$key_path" \
  -in "$temporary_certificate" \
  -passout "pass:$pfx_password"

"$openssl_bin" verify -CAfile "$temporary_certificate" "$temporary_certificate" >/dev/null
"$openssl_bin" x509 -in "$temporary_certificate" -noout -purpose |
  grep -Fxq 'Code signing : Yes' || fail 'Generated certificate is not valid for code signing.'
"$openssl_bin" pkcs12 -in "$temporary_pfx" -legacy -clcerts -nokeys \
  -passin "pass:$pfx_password" -out /dev/null

certificate_public_key="$({ "$openssl_bin" x509 -in "$temporary_certificate" -pubkey -noout; } |
  "$openssl_bin" pkey -pubin -outform DER 2>/dev/null |
  "$openssl_bin" dgst -sha256)"
private_public_key="$({ "$openssl_bin" pkey -in "$key_path" -pubout; } |
  "$openssl_bin" pkey -pubin -outform DER 2>/dev/null |
  "$openssl_bin" dgst -sha256)"
[[ "$certificate_public_key" == "$private_public_key" ]] ||
  fail 'Generated certificate does not match the existing private key.'

backup_suffix="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -f "$certificate_path" ]]; then
  cp -p "$certificate_path" "$certificate_path.backup.$backup_suffix"
fi
if [[ -f "$pfx_path" ]]; then
  cp -p "$pfx_path" "$pfx_path.backup.$backup_suffix"
fi

install -m 600 "$temporary_certificate" "$certificate_path"
install -m 600 "$temporary_pfx" "$pfx_path"
chmod 600 "$key_path" "$password_path"

printf 'Created macOS code-signing certificate using the existing private key.\n'
"$openssl_bin" x509 -in "$certificate_path" -noout -subject -dates -fingerprint -sha256
printf 'PKCS#12: %s\n' "$pfx_path"
printf 'Password file: %s\n' "$password_path"
