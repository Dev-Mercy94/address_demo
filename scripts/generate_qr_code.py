import os
import qrcode
from PIL import Image, ImageDraw
import numpy as np

BASE_DIR = r"E:\my project\address"
DOWNLOAD_URL = "https://addresshubmanagement.netlify.app/download"
LOGO_SRC = os.path.join(BASE_DIR, r"public\app-logo.png")
OUTPUT_QR = os.path.join(BASE_DIR, r"public\app-qr-code.png")
OUTPUT_ROOT = os.path.join(BASE_DIR, r"address_hub_qr_code.png")

# Create QR Code with high error correction so we can embed logo in center
qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=12,
    border=3,
)
qr.add_data(DOWNLOAD_URL)
qr.make(fit=True)

# Generate image with custom royal blue color scheme
BLUE_FILL = "#1d4ed8"    # Royal blue
ACCENT_BLUE = "#3b82f6"  # Sky blue accent

qr_img = qr.make_image(
    fill_color=BLUE_FILL,
    back_color="#ffffff"
).convert("RGBA")

qr_w, qr_h = qr_img.size

# Load logo and transform to matching blue
if os.path.exists(LOGO_SRC):
    logo = Image.open(LOGO_SRC).convert("RGBA")
    arr = np.array(logo, dtype=np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    new_r = np.clip(r * 0.3 + b * 0.4, 0, 255)
    new_g = np.clip(g * 0.4 + r * 0.3, 0, 255)
    new_b = np.clip(g * 1.1 + b * 0.5, 0, 255)
    blue_logo_arr = np.stack([new_r, new_g, new_b, a], axis=-1).astype(np.uint8)
    blue_logo = Image.fromarray(blue_logo_arr, mode="RGBA")
    
    # Logo size should be ~24% of QR code width
    logo_size = int(qr_w * 0.24)
    blue_logo = blue_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Create circular or rounded mask for the center logo
    mask = Image.new("L", (logo_size, logo_size), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle([(0, 0), (logo_size, logo_size)], radius=int(logo_size * 0.22), fill=255)
    
    # White background badge with blue border for center logo
    badge_size = logo_size + 16
    badge = Image.new("RGBA", (badge_size, badge_size), (255, 255, 255, 255))
    draw_badge = ImageDraw.Draw(badge)
    draw_badge.rounded_rectangle([(0, 0), (badge_size, badge_size)], radius=int(badge_size * 0.24), fill="#ffffff", outline=ACCENT_BLUE, width=3)
    
    # Paste logo onto badge
    badge.paste(blue_logo, (8, 8), mask)
    
    # Paste badge onto center of QR code
    pos = ((qr_w - badge_size) // 2, (qr_h - badge_size) // 2)
    qr_img.paste(badge, pos, badge)

# Add a polished outer card frame with title & caption
card_padding_top = 70
card_padding_bottom = 90
card_padding_x = 40

card_w = qr_img.width + (card_padding_x * 2)
card_h = qr_img.height + card_padding_top + card_padding_bottom

card = Image.new("RGBA", (card_w, card_h), "#ffffff")
draw_card = ImageDraw.Draw(card)

# Draw subtle outer border
draw_card.rounded_rectangle([(0, 0), (card_w - 1, card_h - 1)], radius=24, outline="#cbd5e1", width=2)

# Paste QR image
card.paste(qr_img, (card_padding_x, card_padding_top), qr_img)

# Save to public and root
card.save(OUTPUT_QR, "PNG")
card.save(OUTPUT_ROOT, "PNG")

print("Created blue branded QR code at:", OUTPUT_QR)
print("Created root QR code at:", OUTPUT_ROOT)
