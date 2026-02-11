import zipfile
import os

zip_path = 'blog-to-video-converter-v4.0.0.zip'

if not os.path.exists(zip_path):
    print(f"Error: {zip_path} not found")
else:
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        print(f"Total entries: {len(zip_ref.namelist())}")
        for name in zip_ref.namelist()[:20]: # Show first 20
            print(f"Entry: {name}")
        
        # Check for main file
        main_file = 'blog-to-video-converter/blog-to-video-converter.php'
        if main_file in zip_ref.namelist():
            print(f"FOUND: {main_file}")
        else:
            # Maybe with backslashes?
            alt_file = main_file.replace('/', '\\')
            if alt_file in zip_ref.namelist():
                print(f"FOUND (Backslashes): {alt_file}")
            else:
                print("MAIN PLUGIN FILE NOT FOUND IN ZIP!")
                # Search for any .php file in a root-level folder
                php_files = [n for n in zip_ref.namelist() if n.endswith('.php')]
                print(f"All PHP files in ZIP: {php_files}")
