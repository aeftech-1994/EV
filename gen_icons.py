#!/usr/bin/env python3
"""Génère des icônes PNG simples pour l'extension Chrome EV Sync."""
import struct, zlib, os

def make_png(size, bg=(13,71,161), fg=(66,165,245), text_color=(255,255,255)):
    """Crée un PNG carré avec fond bleu et lettres EV."""
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # Fond arrondi
            cx, cy = size//2, size//2
            r = size//2 - 1
            dist = ((x-cx)**2 + (y-cy)**2)**0.5
            if dist > r:
                row.extend([0,0,0,0])  # transparent
                continue
            # Lettre E (gauche) et V (droite)
            px = (x / size)
            py = (y / size)
            on_E = False
            on_V = False
            # E : colonne gauche + 3 barres horizontales
            if 0.15 <= px <= 0.25 and 0.15 <= py <= 0.85: on_E = True
            if 0.15 <= px <= 0.50 and (0.15 <= py <= 0.25 or 0.46 <= py <= 0.56 or 0.75 <= py <= 0.85): on_E = True
            # V : deux diagonales
            if 0.55 <= px <= 0.70 and (px - 0.55) * 1.4 <= py - 0.15 <= (px - 0.55) * 1.4 + 0.12: on_V = True
            if 0.70 <= px <= 0.85 and (0.85 - px) * 1.4 <= py - 0.15 <= (0.85 - px) * 1.4 + 0.12: on_V = True
            if on_E or on_V:
                row.extend([*text_color, 255])
            else:
                row.extend([*bg, 255])
        pixels.append(row)

    def write_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)
    compressed = zlib.compress(raw, 9)

    png = b'\x89PNG\r\n\x1a\n'
    png += write_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += write_chunk(b'IDAT', compressed)
    png += write_chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)
for sz in [16, 48, 128]:
    with open(f'icons/icon{sz}.png', 'wb') as f:
        f.write(make_png(sz))
    print(f'✓ icons/icon{sz}.png ({sz}x{sz})')

print('Icônes générées avec succès.')
