import os
import zipfile
import shutil

BASE_DIR = r"E:\my project\address"
SRC_APK = os.path.join(BASE_DIR, r"android\app\build\outputs\apk\debug\app-debug.apk")
BACKUP_APK = os.path.join(BASE_DIR, r"android\app\build\outputs\apk\debug\app-debug.original.apk")
TEMP_APK = os.path.join(BASE_DIR, r"android\app\build\outputs\apk\debug\app-debug.unsigned.apk")
DIST_DIR = os.path.join(BASE_DIR, "dist")

if not os.path.exists(BACKUP_APK):
    shutil.copy2(SRC_APK, BACKUP_APK)
    print("Created backup of original APK at:", BACKUP_APK)

# Collect all files from dist/ to put into assets/public/
dist_files = {}
for root, dirs, files in os.walk(DIST_DIR):
    for f in files:
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, DIST_DIR).replace("\\", "/")
        archive_name = f"assets/public/{rel_path}"
        dist_files[archive_name] = full_path

print(f"Prepared {len(dist_files)} files from dist/ to inject into APK.")

# Read the original APK, write to temp APK replacing assets/public/*
with zipfile.ZipFile(BACKUP_APK, 'r') as zin:
    with zipfile.ZipFile(TEMP_APK, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            # Skip old assets/public files and old META-INF signatures
            if item.filename.startswith("assets/public/"):
                continue
            if item.filename.startswith("META-INF/") and (
                item.filename.endswith(".SF") or 
                item.filename.endswith(".RSA") or 
                item.filename.endswith(".DSA") or 
                item.filename.endswith("MANIFEST.MF")
            ):
                continue
            
            # Copy other items
            data = zin.read(item.filename)
            zout.writestr(item, data)
        
        # Inject updated dist files
        for archive_name, file_path in dist_files.items():
            with open(file_path, "rb") as f:
                content = f.read()
            # Write with standard timestamp
            zinfo = zipfile.ZipInfo(archive_name)
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zinfo, content)

print("Temp unsigned APK created successfully at:", TEMP_APK)
