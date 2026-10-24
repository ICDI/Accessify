#!/usr/bin/env bash
# Roda o harness com o Chromium fora da GPU (renderização por software: Mesa/lavapipe +
# --disable-gpu). Contorno da decisão D10 (docs/ESTADO_ATUAL.md): na máquina do lote, a
# GPU em carga CUDA com clock livre reinicia a máquina; o Ollama fica na GPU com clock
# travado (serviço nvidia-clock-lock) e o Chromium não toca o driver NVIDIA.
# Uso: eval/tools/run-chromium-software.sh [argumentos do src/run.js]   (ex.: --smoke)
set -euo pipefail
cd "$(dirname "$0")/.."
export LIBGL_ALWAYS_SOFTWARE=1
export __GLX_VENDOR_LIBRARY_NAME=mesa
export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
export EVAL_CHROMIUM_ARGS="--disable-gpu ${EVAL_CHROMIUM_ARGS:-}"
exec node src/run.js "$@"
