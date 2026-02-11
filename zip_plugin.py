import zipfile
import os

def zip_plugin():
    source_dir = r"wp-content/plugins/blog-to-video-converter"
    zip_name = "blog-to-video-converter-final.zip"
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Calculate the arcname (relative path inside zip)
                # We want the zip to start with 'blog-to-video-converter/'
                # source_dir is 'wp-content/plugins/blog-to-video-converter'
                # so we get the relative path from 'wp-content/plugins'
                arcname = os.path.relpath(file_path, start="wp-content/plugins")
                print(f"Adding {file_path} as {arcname}")
                zipf.write(file_path, arcname)

if __name__ == "__main__":
    zip_plugin()
