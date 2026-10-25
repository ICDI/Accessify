#!/usr/bin/env bash
# Captura a tela em intervalo fixo enquanto a pessoa troca de aba no Chrome com a WAVE já
# acionada à mão em cada aba (D16). O script não aciona a WAVE nem lê o painel: só grava a
# imagem da tela, como um Shift+Print repetido. A barra de endereço identifica a página e o
# estado (/p/<n>/<estado> do roteiro); a conferência contra o CSV é feita depois.
#
# Uso: eval/tools/wave-prints.sh [intervalo_s=3] [destino=docs/evidencias/wave/prints]
# Encerre com Ctrl+C. Requer gnome-screenshot (sudo apt install gnome-screenshot); sem ele,
# use Shift+Print em cada aba (GNOME salva em Imagens/Capturas de tela) e copie a pasta.
set -euo pipefail
INTERVALO="${1:-3}"; DEST="${2:-$(dirname "$0")/../../docs/evidencias/wave/prints}"
mkdir -p "$DEST"; DEST="$(cd "$DEST" && pwd)"
command -v gnome-screenshot >/dev/null || { echo "gnome-screenshot não encontrado: sudo apt install gnome-screenshot"; exit 1; }
n=$(ls "$DEST" 2>/dev/null | grep -cE '^print-[0-9]{3}-' || true)
echo "Capturando a cada ${INTERVALO}s em $DEST (já existem $n). Troque de aba entre as capturas; Ctrl+C encerra."
sleep "$INTERVALO"
while true; do
  n=$((n+1)); f="$DEST/print-$(printf '%03d' "$n")-$(date +%H%M%S).png"
  if gnome-screenshot -f "$f" 2>/dev/null; then printf '\a%s\n' "  $(basename "$f")"; else echo "  falhou a captura $n"; n=$((n-1)); fi
  sleep "$INTERVALO"
done
