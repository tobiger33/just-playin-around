import math
import re
from bisect import bisect_right
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BACKGROUND = (246, 245, 242)
TRACK = (220, 222, 226)
BLUE = (83, 111, 196)
PATH = """
M43 24
C43 25.24 42.37 26.48 41.22 27.42
C40.06 28.37 38.37 29 36.41 29.14
C34.45 29.28 32.22 28.92 30.05 28.04
C27.87 27.16 25.76 25.76 24 24
C22.24 22.24 20.84 20.13 19.96 17.95
C19.08 15.78 18.72 13.55 18.86 11.59
C19 9.63 19.63 7.94 20.58 6.78
C21.52 5.63 22.76 5 24 5
C25.24 5 26.48 5.63 27.42 6.78
C28.37 7.94 29 9.63 29.14 11.59
C29.28 13.55 28.92 15.78 28.04 17.95
C27.16 20.13 25.76 22.24 24 24
C22.24 25.76 20.13 27.16 17.95 28.04
C15.78 28.92 13.55 29.28 11.59 29.14
C9.63 29 7.94 28.37 6.78 27.42
C5.63 26.48 5 25.24 5 24
C5 22.76 5.63 21.52 6.78 20.58
C7.94 19.63 9.63 19 11.59 18.86
C13.55 18.72 15.78 19.08 17.95 19.96
C20.13 20.84 22.24 22.24 24 24
C25.76 25.76 27.16 27.87 28.04 30.05
C28.92 32.22 29.28 34.45 29.14 36.41
C29 38.37 28.37 40.06 27.42 41.22
C26.48 42.37 25.24 43 24 43
C22.76 43 21.52 42.37 20.58 41.22
C19.63 40.06 19 38.37 18.86 36.41
C18.72 34.45 19.08 32.22 19.96 30.05
C20.84 27.87 22.24 25.76 24 24
C25.76 22.24 27.87 20.84 30.05 19.96
C32.22 19.08 34.45 18.72 36.41 18.86
C38.37 19 40.06 19.63 41.22 20.58
C42.37 21.52 43 22.76 43 24
"""


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def scale(vector, factor):
    return tuple(value * factor for value in vector)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def unit(vector):
    return scale(vector, 1 / math.sqrt(dot(vector, vector)))


def parse_path(path):
    tokens = re.findall(r"[MC]|-?\d+(?:\.\d+)?", path)
    segments = []
    current = None
    index = 0
    while index < len(tokens):
        command = tokens[index]
        index += 1
        if command == "M":
            current = (float(tokens[index]), float(tokens[index + 1]))
            index += 2
        elif command == "C":
            values = [float(value) for value in tokens[index : index + 6]]
            index += 6
            p1 = (values[0], values[1])
            p2 = (values[2], values[3])
            p3 = (values[4], values[5])
            segments.append((current, p1, p2, p3))
            current = p3
        else:
            raise ValueError(f"Unsupported path command: {command}")
    return segments


def sample_path(segments, steps=20):
    points = []
    for p0, p1, p2, p3 in segments:
        for step in range(steps):
            t = step / steps
            u = 1 - t
            x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
            points.append((x - 24, 24 - y))
    points.append(points[0])
    lengths = [0.0]
    for first, second in zip(points, points[1:]):
        lengths.append(lengths[-1] + math.dist(first, second))
    return points, lengths


def section(points, lengths, start, end):
    start = max(0.0, min(start, lengths[-1]))
    end = max(start, min(end, lengths[-1]))
    last_segment = len(points) - 2
    first = min(last_segment, bisect_right(lengths, start) - 1)
    last = min(last_segment, bisect_right(lengths, end) - 1)

    def at(distance, index):
        span = lengths[index + 1] - lengths[index]
        amount = 0 if span == 0 else (distance - lengths[index]) / span
        a, b = points[index], points[index + 1]
        return (a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount)

    result = [at(start, first)]
    result.extend(points[first + 1 : last + 1])
    result.append(at(end, last))
    return result


def trace_segment(points, lengths, phase, fraction):
    total = lengths[-1]
    start = phase % 1 * total
    end = start + fraction * total
    if end <= total:
        return section(points, lengths, start, end)
    return section(points, lengths, start, total) + section(points, lengths, 0, end - total)[1:]


def plane_bases():
    normals = [
        (0, 0, 1),
        (1, 0, 0),
        (0, 1, 0),
        (1, 1, 1),
        (1, -1, -1),
        (-1, 1, -1),
        (-1, -1, 1),
    ]
    bases = []
    for normal in normals:
        n = unit(normal)
        reference = (0, 1, 0) if abs(n[2]) > 0.9 else (0, 0, 1)
        u = unit(cross(reference, n))
        v = cross(n, u)
        bases.append((u, v))
    return bases


def rotate(point, angle):
    axis = unit((1, 1, 1))
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return add(
        add(scale(point, cosine), scale(cross(axis, point), sine)),
        scale(axis, dot(axis, point) * (1 - cosine)),
    )


def render(size, time, tracks=True):
    supersample = 2
    canvas_size = size * supersample
    unit_scale = canvas_size / 48
    camera = canvas_size * 2.8
    focal = camera
    center = canvas_size / 2
    angle = time * math.tau / 8
    bases = plane_bases()
    path_points, path_lengths = sample_path(parse_path(PATH))
    rendered = Image.new("RGB", (canvas_size, canvas_size), BACKGROUND)
    draw = ImageDraw.Draw(rendered)
    projected_planes = []
    trace_planes = []

    def project(local, basis):
        x, y = local
        world = add(scale(basis[0], x * unit_scale), scale(basis[1], y * unit_scale))
        rotated = rotate(world, angle)
        denominator = camera - rotated[2]
        return (
            center + focal * rotated[0] / denominator,
            center - focal * rotated[1] / denominator,
            rotated[2],
        )

    for layer, basis in enumerate(bases):
        projected = [project(point, basis) for point in path_points]
        projected_planes.append(projected)
        phase = time / 4 + (0 if layer < 3 else 0.25)
        trace = trace_segment(path_points, path_lengths, phase, 0.075)
        trace_planes.append([project(point, basis) for point in trace])

    if tracks:
        for projected in sorted(projected_planes, key=lambda plane: sum(point[2] for point in plane) / len(plane)):
            draw.line(
                [(round(x), round(y)) for x, y, _ in projected],
                fill=tuple(round(BACKGROUND[i] * 0.45 + TRACK[i] * 0.55) for i in range(3)),
                width=max(2, round(size * 0.012)),
                joint="curve",
            )

    for projected in sorted(trace_planes, key=lambda plane: sum(point[2] for point in plane) / len(plane)):
        xy = [(round(x), round(y)) for x, y, _ in projected]
        width = max(3, round(size * 0.017))
        draw.line(xy, fill=BLUE, width=width, joint="curve")
        for x, y in (xy[0], xy[-1]):
            radius = width // 2
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=BLUE)

    return rendered.resize((size, size), Image.Resampling.LANCZOS)


def save_gif(frames, path):
    palette = frames[0].quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    indexed = [palette]
    indexed.extend(frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames[1:])
    indexed[0].save(
        path,
        save_all=True,
        append_images=indexed[1:],
        duration=50,
        loop=0,
        optimize=True,
        disposal=2,
    )


def main():
    ASSETS.mkdir(exist_ok=True)
    gif_frames = []
    lines_frames = []
    for frame in range(160):
        time = frame * 0.05
        gif_frames.append(render(240, time))
        lines_frames.append(render(240, time, tracks=False))
    save_gif(gif_frames, ASSETS / "four-petals-octahedral-360.gif")
    save_gif(lines_frames, ASSETS / "four-petals-octahedral-360-lines-only.gif")

    webp_frames = [render(128, frame * 0.02) for frame in range(400)]
    webp_frames[0].save(
        ASSETS / "four-petals-octahedral-360.webp",
        save_all=True,
        append_images=webp_frames[1:],
        duration=20,
        loop=0,
        quality=90,
        method=6,
    )
    render(128, 0).save(ASSETS / "four-petals-octahedral-static.png")


if __name__ == "__main__":
    main()
