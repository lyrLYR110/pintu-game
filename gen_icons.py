import os
from PIL import Image, ImageDraw

output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images')
os.makedirs(output_dir, exist_ok=True)

def make_icon(draw_func, color, size=81):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, color, size)
    return img

def draw_puzzle(draw, color, size):
    s = size
    m = s * 0.12
    w = (s - 3 * m) / 2
    h = w
    for i in range(2):
        for j in range(2):
            x = m + j * (w + m)
            y = m + i * (h + m)
            draw.rounded_rectangle([x, y, x + w, y + h], radius=6, fill=color)
    cx1 = m + w * 0.4
    cy1 = m + h * 0.4
    r = w * 0.12
    draw.ellipse([cx1 - r, cy1 - r, cx1 + r, cy1 + r], fill='white')
    cx2 = m + w + m + w * 0.6
    cy2 = m + h + m + h * 0.6
    draw.ellipse([cx2 - r, cy2 - r, cx2 + r, cy2 + r], fill='white')

def draw_versus(draw, color, size):
    s = size
    r = s * 0.16
    cy = s * 0.5
    cx1 = s * 0.3
    cx2 = s * 0.7
    draw.ellipse([cx1 - r, cy - r, cx1 + r, cy + r], outline=color, width=4)
    draw.ellipse([cx2 - r, cy - r, cx2 + r, cy + r], outline=color, width=4)
    mx1 = cx1 + r * 0.4
    mx2 = cx2 - r * 0.4
    my = s * 0.37
    draw.arc([mx1, my - s * 0.05, mx2, my + s * 0.08], start=180, end=0, fill=color, width=4)
    my2 = s * 0.63
    draw.arc([mx1, my2 - s * 0.08, mx2, my2 + s * 0.05], start=0, end=180, fill=color, width=4)
    midx = s * 0.5
    draw.line([midx - s * 0.03, s * 0.4, midx - s * 0.03, s * 0.6], fill=color, width=3)
    draw.line([midx + s * 0.03, s * 0.4, midx + s * 0.03, s * 0.6], fill=color, width=3)
    cr = r * 0.22
    draw.ellipse([cx1 - cr, cy - cr, cx1 + cr, cy + cr], fill=color)
    draw.ellipse([cx2 - cr, cy - cr, cx2 + cr, cy + cr], fill=color)

def draw_person(draw, color, size):
    s = size
    head_r = s * 0.17
    head_cy = s * 0.34
    head_cx = s * 0.5
    draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r],
                 outline=color, width=4)
    shoulder_y = s * 0.58
    body_top = head_cy + head_r + s * 0.04
    left_x = s * 0.22
    right_x = s * 0.78
    bottom_y = s * 0.8
    draw.arc([left_x, shoulder_y - s * 0.22, right_x, bottom_y],
             start=180, end=360, fill=color, width=4)

colors = {
    'inactive': (153, 153, 153, 255),
    'active': (102, 126, 234, 255)
}

icons = [
    ('tab-home', draw_puzzle),
    ('tab-versus', draw_versus),
    ('tab-me', draw_person)
]

for name, func in icons:
    img_inactive = make_icon(func, colors['inactive'])
    img_active = make_icon(func, colors['active'])
    img_inactive.save(os.path.join(output_dir, f'{name}.png'))
    img_active.save(os.path.join(output_dir, f'{name}-active.png'))
    print(f'Generated {name}.png and {name}-active.png')

print('Done!')
