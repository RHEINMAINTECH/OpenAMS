#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/OpenAMS"
VENV_DIR="${APP_DIR}/venv"
SERVICE_NAME="openams"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PYTHON_BIN="python3"

echo "========================================"
echo " OpenAMS – Deploy / Update"
echo "========================================"

if [[ $EUID -ne 0 ]]; then
    echo "Bitte als root ausführen (sudo)."
    exit 1
fi

echo "[1/7] Systemabhängigkeiten installieren (Python, Tesseract, PostgreSQL)..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip curl tesseract-ocr tesseract-ocr-deu postgresql postgresql-contrib libpq-dev > /dev/null 2>&1

echo "[2/7] PostgreSQL Datenbank einrichten..."
# Service stoppen um Datenbank-Locks zu lösen
systemctl stop "${SERVICE_NAME}" > /dev/null 2>&1 || true

systemctl start postgresql
systemctl enable postgresql --quiet

DB_NAME="openams"
DB_USER="openams"
DB_RESET=false

# Parameter prüfen
for arg in "$@"; do
    if [ "$arg" == "-dbreset" ]; then
        DB_RESET=true
    fi
done

# PW aus bestehender .env extrahieren oder neu generieren
if [ -f "${APP_DIR}/.env" ]; then
    DB_PASS=$(grep DATABASE_URL "${APP_DIR}/.env" | sed -n 's/.*:\(.*\)@.*/\1/p')
fi
if [ -z "${DB_PASS:-}" ]; then
    DB_PASS=$(openssl rand -base64 12)
fi

# User-Management
USER_EXISTS=$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [ "${USER_EXISTS}" != "1" ]; then
    runuser -u postgres -- psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
else
    runuser -u postgres -- psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi

# DB-Management
if [ "$DB_RESET" = true ]; then
    echo "  → -dbreset aktiv: Lösche bestehende Datenbank '${DB_NAME}'..."
    # Erzwinge das Beenden aller aktiven Verbindungen zur Datenbank
    runuser -u postgres -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
    runuser -u postgres -- psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
fi

DB_EXISTS=$(runuser -u postgres -- psql -lqt | cut -d \| -f 1 | grep -qw "${DB_NAME}" && echo "yes" || echo "no")
if [ "${DB_EXISTS}" != "yes" ]; then
    runuser -u postgres -- psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

# Berechtigungen
runuser -u postgres -- psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
runuser -u postgres -- psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "[3/7] Verzeichnisstruktur prüfen..."
mkdir -p "${APP_DIR}/data"
mkdir -p "${APP_DIR}/uploads"
mkdir -p "${APP_DIR}/logs"

echo "[4/7] Python Virtual Environment einrichten..."
# Falls venv korrupt ist, neu erstellen
if [ -d "${VENV_DIR}" ] && [ ! -f "${VENV_DIR}/bin/python3" ]; then
    rm -rf "${VENV_DIR}"
fi
if [ ! -d "${VENV_DIR}" ]; then
    ${PYTHON_BIN} -m venv "${VENV_DIR}"
fi
source "${VENV_DIR}/bin/activate"

echo "[5/7] Python-Abhängigkeiten installieren..."
pip install --upgrade pip -q
# Installiere Pakete einzeln oder erzwinge Cache-Refresh bei Fehlern
if ! pip install -r "${APP_DIR}/requirements.txt" -q; then
    echo "  → Fehler bei Standard-Installation. Versuche ohne Cache..."
    pip install --no-cache-dir -r "${APP_DIR}/requirements.txt" -q
fi

echo "[6/7] .env Konfiguration sicherstellen (PostgreSQL)..."
if [ ! -f "${APP_DIR}/.env" ]; then
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    sed -i "s/password/${DB_PASS}/g" "${APP_DIR}/.env"
else
    # Sicherstellen, dass DATABASE_URL auf postgres zeigt (SQLite Legacy entfernen)
    if grep -q "sqlite" "${APP_DIR}/.env"; then
        sed -i "s|DATABASE_URL=sqlite:///.*|DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}|" "${APP_DIR}/.env"
    fi
fi

echo "[6/7] Systemd-Service einrichten..."
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=OpenAMS Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONPATH=${APP_DIR}
Environment=PATH=${VENV_DIR}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
ExecStart=${VENV_DIR}/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8090 --workers 1 --proxy-headers --log-level info
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" --quiet

echo "[7/7] Service (neu) starten..."
# Aufräumen von Python Cache-Files gegen Import-Leichen
find "${APP_DIR}" -name "__pycache__" -type d -exec rm -rf {} +
systemctl stop "${SERVICE_NAME}" > /dev/null 2>&1 || true
systemctl start "${SERVICE_NAME}"
sleep 3

if systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo ""
    echo "========================================"
    echo " ✓ OpenAMS läuft!"
    echo "   URL: http://$(hostname -I | awk '{print $1}'):8090"
    echo "========================================"
else
    echo ""
    echo " !!! FEHLER: Service konnte nicht gestartet werden !!!"
    echo "--------------------------------------------------------"
    journalctl -u "${SERVICE_NAME}" -n 50 --no-pager
    echo "--------------------------------------------------------"
    exit 1
fi



