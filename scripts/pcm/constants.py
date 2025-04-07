import os
import sys

IS_FORGE = False
IS_REFORGE = False
if 'modules_forge.forge_version' in sys.modules:
    IS_FORGE = True
    from modules_forge.forge_version import version as FORGE_VERSION
    if FORGE_VERSION.startswith('1.'):
        IS_REFORGE = True

extension_root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

image_folder = "prompt_cards" # Prompt Images Folder
thumbs_folder = "prompt_cards.thumbs" # Auto Generated Thumbnails Folder
cache_info_file = "cache_info.json" # Cache Info File
category_alias_file = "_category_alias.yaml" # Category Alias File

templates_folder = "html_templates" # HTML Templates Folder
endpoint_base = '/' + 'sd-webui-prompt-cards-manager' # API Endpoint Base ('/sd-webui-prompt-cards-manager')


is_debug = os.path.exists(os.path.join(extension_root_path, "scripts", "DEBUG_FLAG"))
DEBUG_PRINT = lambda *args: print(*args, file=sys.stdout) if is_debug else None
