#!/bin/bash
# Script para baixar base GeoIP diretamente

# Diretório de dados
DATA_DIR="/opt/render/project/src/data"
MMDB_FILE="$DATA_DIR/GeoLite2-City.mmdb"

# Obter chave de licença da variável de ambiente
LICENSE_KEY="${MAXMIND_LICENSE_KEY:-JOJ3REIKfJWLIAqf}"
echo "Usando chave de licença: $LICENSE_KEY"

# Criar diretório se não existir
mkdir -p "$DATA_DIR"

# Backup da base atual se existir
if [ -f "$MMDB_FILE" ]; then
  echo "Fazendo backup da base atual..."
  cp "$MMDB_FILE" "$MMDB_FILE.bak"
fi

# Baixar base diretamente (usando curl)
echo "Baixando base GeoIP..."
curl -s "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=$LICENSE_KEY&suffix=tar.gz" -o "$DATA_DIR/geolite2-city.tar.gz"

# Verificar se o download foi bem-sucedido
if [ ! -f "$DATA_DIR/geolite2-city.tar.gz" ] || [ ! -s "$DATA_DIR/geolite2-city.tar.gz" ]; then
  echo "Erro no download da base GeoIP!"
  if [ -f "$MMDB_FILE.bak" ]; then
    echo "Restaurando backup..."
    cp "$MMDB_FILE.bak" "$MMDB_FILE"
  fi
  exit 1
fi

# Extrair arquivo
echo "Extraindo arquivo..."
mkdir -p "$DATA_DIR/temp_extract"
tar -xzf "$DATA_DIR/geolite2-city.tar.gz" -C "$DATA_DIR/temp_extract"

# Localizar arquivo mmdb
MMDB_FILE_PATH=$(find "$DATA_DIR/temp_extract" -name "*.mmdb" | head -1)

if [ -n "$MMDB_FILE_PATH" ]; then
    echo "Arquivo encontrado: $MMDB_FILE_PATH"
    cp "$MMDB_FILE_PATH" "$MMDB_FILE"
    echo "Base GeoIP instalada com sucesso!"
else
    echo "Erro: arquivo MMDB não encontrado!"
    if [ -f "$MMDB_FILE.bak" ]; then
      echo "Restaurando backup..."
      cp "$MMDB_FILE.bak" "$MMDB_FILE"
    fi
    exit 1
fi

# Limpar arquivos temporários
rm -rf "$DATA_DIR/temp_extract"
rm -f "$DATA_DIR/geolite2-city.tar.gz"

echo "Limpeza concluída"
echo "Base GeoIP atualizada com sucesso!" 