"""Prueba local de continuidad: paneo desde una escena de reconstrucción ya preparada.

Blender --background archivo.blend --python scripts/blender/reconstruction_motion.py
-- --out /privado/secuencia --frames 48 --degrees 12
No es un paseo completo ni acredita la correspondencia con el diseño aceptado.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).parent))
from hk_render import _gpu


parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True)
parser.add_argument('--frames', type=int, default=48)
parser.add_argument('--degrees', type=float, default=12)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
scene = bpy.context.scene
if scene.get('purpose') != 'reconstruction-draft' or scene.get('eligibleForFinalVideo') is not False:
    raise ValueError('La escena no es un borrador de reconstrucción.')
if not 2 <= args.frames <= 120 or not 0 < abs(args.degrees) <= 20:
    raise ValueError('Esta prueba admite 2–120 fotogramas y hasta 20 grados.')
out = Path(args.out).resolve()
out.mkdir(parents=True, exist_ok=True)
scene.render.fps = 24
scene.render.resolution_x, scene.render.resolution_y = 960, 540
scene.cycles.samples = 32
scene.cycles.device = 'GPU' if _gpu() else 'CPU'
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
start = time.monotonic()
rotation = scene.camera.rotation_euler.to_matrix().to_4x4()
for index in range(args.frames):
    t = index / (args.frames - 1)
    smooth = t * t * (3 - 2 * t)
    scene.camera.rotation_euler = (Matrix.Rotation(math.radians(args.degrees) * smooth, 4, 'Z') @ rotation).to_euler()
    scene.render.filepath = str(out / f'{index:04d}.png')
    bpy.ops.render.render(write_still=True)
result = {'frames': args.frames, 'fps': 24, 'durationSeconds': args.frames / 24,
          'elapsedSeconds': round(time.monotonic() - start, 2), 'width': 960, 'samples': 32,
          'paidCalls': 0, 'device': scene.cycles.device, 'eligibleForFinalVideo': False, 'motion': 'stationary-pan'}
(out / 'motion-report.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
