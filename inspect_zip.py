import zipfile
import sys

zip_path = "blog-to-video-converter-fixed-3.zip"
try:
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        print(f"Listing contents of {zip_path}:")
        for file in zip_ref.namelist():
            print(file)
except FileNotFoundError:
    print("Zip file not found")
except Exception as e:
    print(f"Error: {e}")
