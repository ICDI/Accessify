#!/usr/bin/env python3
"""Captura a tela em intervalo fixo pelo portal XDG (org.freedesktop.portal.Screenshot), o
caminho oficial no GNOME/Wayland. A pessoa troca de aba do Chrome, com a WAVE já acionada
à mão em cada aba (D16); o script só grava a imagem, como um Shift+Print repetido, e não
aciona a WAVE nem lê o painel. Na primeira captura o GNOME pode pedir autorização: aceite
e, se houver a opção, marque para lembrar.

Uso: python3 eval/tools/wave-captura.py [--intervalo 3] [--destino docs/evidencias/wave/prints] [--uma]
Ctrl+C encerra.
"""
import os, sys, time, shutil, urllib.parse
import gi; gi.require_version('Gio', '2.0'); from gi.repository import Gio, GLib
args = sys.argv[1:]
def opt(n, d):
    return args[args.index(f'--{n}') + 1] if f'--{n}' in args else d
INTERVALO = float(opt('intervalo', '3')); UMA = '--uma' in args
DEST = os.path.abspath(opt('destino', os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'evidencias', 'wave', 'prints')))
os.makedirs(DEST, exist_ok=True)
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
sender = bus.get_unique_name()[1:].replace('.', '_')
contador = [len([f for f in os.listdir(DEST) if f.startswith('print-')])]
def capturar():
    token = f'accessify{int(time.time()*1000)}'
    handle = f'/org/freedesktop/portal/desktop/request/{sender}/{token}'
    loop = GLib.MainLoop(); resultado = {}
    def resposta(conn, sname, opath, iface, signal, params):
        code, res = params.unpack(); resultado['code'] = code; resultado['uri'] = res.get('uri'); loop.quit()
    sub = bus.signal_subscribe('org.freedesktop.portal.Desktop', 'org.freedesktop.portal.Request', 'Response', handle, None, Gio.DBusSignalFlags.NONE, resposta)
    bus.call_sync('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop', 'org.freedesktop.portal.Screenshot', 'Screenshot',
                  GLib.Variant('(sa{sv})', ('', {'interactive': GLib.Variant('b', False), 'handle_token': GLib.Variant('s', token)})), None, Gio.DBusCallFlags.NONE, 120000, None)
    GLib.timeout_add_seconds(120, loop.quit); loop.run(); bus.signal_unsubscribe(sub)
    if resultado.get('code') != 0 or not resultado.get('uri'):
        return None
    origem = urllib.parse.unquote(urllib.parse.urlparse(resultado['uri']).path)
    contador[0] += 1
    destino = os.path.join(DEST, f"print-{contador[0]:03d}-{time.strftime('%H%M%S')}.png")
    shutil.move(origem, destino); return destino
print(f'Capturando a cada {INTERVALO:g}s em {DEST} (já existem {contador[0]}). Troque de aba entre as capturas; Ctrl+C encerra.', flush=True)
try:
    while True:
        time.sleep(INTERVALO)
        f = capturar()
        print(('  ' + os.path.basename(f)) if f else '  captura recusada ou cancelada', flush=True); sys.stdout.write('\a')
        if UMA: break
except KeyboardInterrupt:
    print('\nencerrado')
