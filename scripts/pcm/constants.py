import os
import sys
extension_root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

image_folder = "prompt_cards" # Prompt Images Folder
thumbs_folder = "prompt_cards.thumbs" # Auto Generated Thumbnails Folder
cache_info_file = "cache_info.json" # Cache Info File
templates_folder = "html_templates" # HTML Templates Folder
endpoint_base = '/' + 'sd-webui-prompt-cards-manager' # API Endpoint Base ('/sd-webui-prompt-cards-manager')


is_debug = os.path.exists(os.path.join(extension_root_path, "scripts", "DEBUG_FLAG"))
DEBUG_PRINT = lambda *args: print(*args, file=sys.stdout) if is_debug else None
