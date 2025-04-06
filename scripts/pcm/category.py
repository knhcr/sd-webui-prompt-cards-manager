import os
import yaml
import re
import sys
from modules import shared
from scripts.pcm.extension_settings import PCM_SETTINGS_KEYS
from scripts.pcm.constants import image_folder, category_alias_file
from scripts.pcm.constants import DEBUG_PRINT


class CategoryAlias:
    _singleton = None
    _extension_root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    def __new__(cls, *args, **kwargs):
        if cls._singleton is None:
            cls._singleton = super().__new__(cls)
        return cls._singleton

    def __init__(self):
        if not hasattr(self, "initialized"):
            self.category_aliases = {}
            self.refresh_aliases()

    def get_aliases(self) -> dict[str, str]:
        ''' エイリアスの一覧を取得
        - return {'raw_category': 'aliased_category', ...} の辞書
        - エイリアスが掛からない物はキー自体無し '''
        return self.category_aliases

    def refresh_aliases(self):
        ''' 現在の画像フォルダとエイリアス定義ファイルを読み込んでエイリアスを更新 '''
        category_alias_path = os.path.join(self._extension_root_path, image_folder, category_alias_file)
        if not os.path.exists(category_alias_path):
            self.category_aliases = {}
            return

        alias_definitions = {}
        try:
            with open(category_alias_path, "r") as f:
                alias_definitions = yaml.safe_load(f)
        except Exception as e:
            print(f"Error loading category alias file: {category_alias_path}", file=sys.stderr)
            return

        files = os.listdir(os.path.join(self._extension_root_path, image_folder))
        raw_categories = [x for x in files if os.path.isdir(os.path.join(self._extension_root_path, image_folder, x))]
        if getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["ignore_dot_starts"]):
            raw_categories = [x for x in raw_categories if not x.startswith('.')]
        
        self.category_aliases = self._create_aliases(raw_categories, alias_definitions)
        return

    def _create_aliases(self, raw_categories, alias_definitions):
        ''' エイリアス適用処理の実体 '''
        aliases = {}
        patterns = [[
            re.compile('^' + k.replace('*', '.*') + '$'),
            v
        ] for (k, v) in alias_definitions.items()]

        for raw_category in raw_categories:
            for pattern in patterns:
                if pattern[0].match(raw_category):
                    aliases[raw_category] = pattern[1]
                    break
        #DEBUG_PRINT(raw_categories)
        #DEBUG_PRINT(alias_definitions)
        #DEBUG_PRINT(patterns)
        #DEBUG_PRINT(aliases)
        return aliases
