from PIL import Image, ImageDraw
import os

LOGO_SRC = r"C:\Users\se6po\.gemini\antigravity-ide\brain\2eb7d510-9553-4d60-abbc-c81ec0778b14\address_hub_logo_1789449800388.jpg"

SIZES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

# Directories to update
TARGET_DIRS = [
    r"E:\my project\address\android\app\src\main\res",
    r"E:\my project\address\decoded_apk\res",
]

img = Image.open(LOGO_SRC).convert("RGBA")

def create_rounded_icon(src_img, size, radius_ratio=0.22):
    w, h = size
    resized = src_img.resize((w, h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    r = int(min(w, h) * radius_ratio)
    draw.rounded_rectangle([(0, 0), (w, h)], radius=r, fill=255)
    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    result.paste(resized, (0, 0), mask)
    return result

def create_circular_icon(src_img, size):
    w, h = size
    resized = src_img.resize((w, h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([(0, 0), (w, h)], fill=255)
    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    result.paste(resized, (0, 0), mask)
    return result

def create_foreground_icon(src_img, size):
    w, h = size
    # In adaptive icons, foreground is typically centered with some padding
    fg_size = int(w * 0.72)
    resized = src_img.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    offset = ((w - fg_size) // 2, (h - fg_size) // 2)
    canvas.paste(resized, offset)
    return canvas

for target_base in TARGET_DIRS:
    if not os.path.exists(target_base):
        continue
    for density, (icon_sz, fg_sz) in SIZES.items():
        # Look for density with or without -v4
        matched_folders = [f for f in os.listdir(target_base) if f == density or f == f"{density}-v4"]
        if not matched_folders:
            matched_folders = [density]
        
        for folder in matched_folders:
            dir_path = os.path.join(target_base, folder)
            os.makedirs(dir_path, exist_ok=True)
            
            # Standard square/rounded launcher
            rounded = create_rounded_icon(img, (icon_sz, icon_sz))
            rounded.save(os.path.join(dir_path, "ic_launcher.png"), "PNG")
            
            # Round launcher
            circular = create_circular_icon(img, (icon_sz, icon_sz))
            circular.save(os.path.join(dir_path, "ic_launcher_round.png"), "PNG")
            
            # Foreground for adaptive icon
            fg = create_foreground_icon(img, (fg_sz, fg_sz))
            fg.save(os.path.join(dir_path, "ic_launcher_foreground.png"), "PNG")
            
    print("Updated icons in:", target_base)

# Also save a high-res web favicon and logo
web_public_logo = r"E:\my project\address\public\app-logo.png"
img.save(web_public_logo, "PNG")
print("Saved web app logo to:", web_public_logo)
