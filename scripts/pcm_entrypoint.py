import sys
IS_FORGE = False
if 'modules_forge.forge_version' in sys.modules:
    IS_FORGE = True

import scripts.pcm.constants
import scripts.pcm.extension_settings
import scripts.pcm.cache_info
import scripts.pcm.prompt_card_info
import scripts.pcm.prompt_card_info_editor_ui
import scripts.pcm.prompt_cards_page_ui
import scripts.pcm.api_routes
import scripts.pcm.misc_functionality
import scripts.pcm.mini_gallery
