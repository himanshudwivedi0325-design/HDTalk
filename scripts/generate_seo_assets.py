import os
from PIL import Image, ImageDraw, ImageFont

public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public'))
os.makedirs(public_dir, exist_ok=True)

# 1. Generate Favicon and PWA icons (icon-192.png, icon-512.png, favicon.ico)
def generate_app_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer Rounded Rectangle with gradient-like solid
    corner_radius = int(size * 0.22)
    padding = int(size * 0.05)
    
    # Draw background rounded rect
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=(0, 102, 255, 255) # Electric blue #0066FF
    )
    
    # Add subtle lighter inner accent circle/glow
    inner_pad = int(size * 0.12)
    draw.ellipse(
        [inner_pad, inner_pad, size - inner_pad, size - inner_pad],
        fill=(0, 119, 255, 120)
    )
    
    # Draw speech bubble tail
    tail_w = int(size * 0.2)
    tail_h = int(size * 0.16)
    x0 = int(size * 0.6)
    y0 = int(size * 0.72)
    draw.polygon([(x0, y0), (x0 + tail_w, y0 + tail_h), (x0 + tail_w - int(size * 0.08), y0)], fill=(0, 102, 255, 255))
    
    # Render "HD" text
    font_size = int(size * 0.44)
    try:
        font = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', font_size)
    except:
        font = ImageFont.load_default()
        
    text = "HD"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2
    ty = (size - th) // 2 - int(size * 0.04)
    
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))
    return img

icon_512 = generate_app_icon(512)
icon_512.save(os.path.join(public_dir, 'icon-512.png'), format='PNG')
print("Generated icon-512.png")

icon_192 = generate_app_icon(192)
icon_192.save(os.path.join(public_dir, 'icon-192.png'), format='PNG')
print("Generated icon-192.png")

icon_48 = generate_app_icon(48)
icon_32 = generate_app_icon(32)
icon_16 = generate_app_icon(16)
icon_48.save(
    os.path.join(public_dir, 'favicon.ico'),
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)]
)
print("Generated favicon.ico")

# 2. Generate OG Image (1200x630)
def generate_og_image():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), (7, 11, 20)) # Dark sleek #070b14
    draw = ImageDraw.Draw(img)
    
    # Background gradient approximation using bands
    for y in range(H):
        r = int(7 + (y / H) * 12)
        g = int(11 + (y / H) * 15)
        b = int(20 + (y / H) * 28)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
        
    # Blue Radial Glow on Top Left
    for rad in range(350, 0, -5):
        alpha = int((1 - rad / 350) * 45)
        draw.ellipse([80 - rad, 80 - rad, 80 + rad, 80 + rad], outline=(0, 102, 255), width=3)

    # Cyan Radial Glow on Bottom Right
    for rad in range(320, 0, -5):
        alpha = int((1 - rad / 320) * 35)
        draw.ellipse([1100 - rad, 550 - rad, 1100 + rad, 550 + rad], outline=(0, 198, 255), width=3)
        
    # Border
    draw.rounded_rectangle([24, 24, W - 24, H - 24], radius=28, outline=(0, 102, 255), width=2)
    
    # Fonts
    font_brand = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', 72)
    font_title = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', 38)
    font_sub = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 24)
    font_badge = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', 18)
    font_footer = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 20)
    font_url = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', 22)
    
    # App Icon on OG Image (100x100)
    app_icon_100 = generate_app_icon(100)
    img.paste(app_icon_100, (80, 80), app_icon_100)
    
    # Brand Name next to icon
    draw.text((205, 88), "HDTalk", font=font_brand, fill=(255, 255, 255))
    
    # Version / Tag badge
    draw.rounded_rectangle([480, 102, 600, 140], radius=8, fill=(0, 102, 255))
    draw.text((495, 108), "v2.4 PRO", font=font_badge, fill=(255, 255, 255))
    
    # Main Headline
    draw.text((80, 225), "Ultra-Fast Real-Time Chat & 1080p Video Calling", font=font_title, fill=(241, 245, 249))
    
    # Description
    desc = "Peer-to-peer WebRTC video calling, sub-50ms Socket.IO messaging, screen sharing, voice notes,\nand professional synergy matchmaking. 100% Free, zero ads, installable PWA."
    draw.text((80, 290), desc, font=font_sub, fill=(148, 163, 184), spacing=10)
    
    # Feature Badges
    badges = [
        ("⚡ Sub-50ms Chat", 80),
        ("📹 1080p WebRTC Calling", 280),
        ("🖥️ Screen Sharing", 540),
        ("📱 Installable PWA", 750),
        ("🔒 E2E Encrypted", 945)
    ]
    for text, bx in badges:
        bw = len(text) * 11 + 24
        draw.rounded_rectangle([bx, 420, bx + bw, 465], radius=10, fill=(15, 23, 42), outline=(30, 41, 59), width=1)
        draw.text((bx + 14, 432), text, font=font_badge, fill=(56, 189, 248))
        
    # Divider line
    draw.line([(80, 520), (W - 80, 520)], fill=(30, 41, 59), width=1)
    
    # Footer - Creator & URL
    draw.text((80, 550), "Engineered with ❤️ by Himanshu Dwivedi", font=font_footer, fill=(148, 163, 184))
    draw.text((W - 380, 548), "https://hdtalk.onrender.com", font=font_url, fill=(56, 189, 248))
    
    return img

og_img = generate_og_image()
og_img.save(os.path.join(public_dir, 'og-image.png'), format='PNG', quality=95)
og_img.save(os.path.join(public_dir, 'twitter-image.png'), format='PNG', quality=95)
print("Generated og-image.png and twitter-image.png (1200x630)")
