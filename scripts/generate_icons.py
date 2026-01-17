#!/usr/bin/env python3
"""
Icon Generator for Chrome Extension - YouTube Playlist Enhancer
Uses ImageMagick to generate all required icon sizes from SVG source
"""

import os
import subprocess
import shutil

SIZES = [16, 32, 48, 128, 256, 512]
ICONS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "icons")
SOURCE_SVG = os.path.join(ICONS_DIR, "icon_source.svg")


def check_imagemagick():
    """Check if ImageMagick is available"""
    return shutil.which("magick") or shutil.which("convert")


def generate_icons():
    """Generate all required icon sizes"""
    if not os.path.exists(SOURCE_SVG):
        print(f"Error: Source SVG not found: {SOURCE_SVG}")
        return False

    print("=== YouTube Playlist Enhancer Icon Generator ===\n")
    print(f"Source: {SOURCE_SVG}")
    print(f"Output directory: {ICONS_DIR}\n")

    # Clean up old icons except source files
    for f in os.listdir(ICONS_DIR):
        if f.startswith("icon") and f.endswith(".png"):
            old_path = os.path.join(ICONS_DIR, f)
            os.remove(old_path)
            print(f"Removed: {f}")

    generated = []
    for size in SIZES:
        output_path = os.path.join(ICONS_DIR, f"icon{size}.png")
        cmd = [
            "magick",
            "convert",
            "-background",
            "none",
            SOURCE_SVG,
            "-resize",
            f"{size}x{size}",
            output_path,
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True)
            generated.append(output_path)
            print(f"Generated: {output_path}")
        except subprocess.CalledProcessError as e:
            print(f"Error generating icon{size}.png: {e}")
            return False

    # Generate favicon.ico (32x32 for compatibility)
    ico_path = os.path.join(ICONS_DIR, "favicon.ico")
    cmd = [
        "magick",
        "convert",
        "-background",
        "none",
        SOURCE_SVG,
        "-resize",
        "32x32",
        ico_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"Generated: {ico_path}\n")

    print("=== Done! ===")
    print("\nGenerated files:")
    for size in SIZES:
        print(f"  - icons/icon{size}.png")
    print(f"  - icons/favicon.ico")

    return True


if __name__ == "__main__":
    if not check_imagemagick():
        print("Error: ImageMagick not found. Please install ImageMagick.")
        exit(1)

    generate_icons()
