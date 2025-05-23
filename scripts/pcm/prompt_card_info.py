from __future__ import annotations

import sys
import os
from typing import Dict, Tuple
import json
import traceback
from pathlib import Path
from scripts.pcm.constants import image_folder, extension_root_path
from scripts.pcm.cache_info import CacheInfo
from scripts.pcm.category import CategoryAlias
from scripts.pcm.constants import DEBUG_PRINT
from base64 import b64encode
from modules import shared
from scripts.pcm.extension_settings import PCM_SETTINGS_KEYS
from scripts.pcm.utility import safe_join
import html

class PromptCardInfoManager:
    """ プロンプトカード情報管理 """

    __card_info_dict : dict[str, PromptCardInfo] = {}

    @classmethod
    def init(cls):
        cls.refresh_card_info_dict()

    @classmethod
    def get_card_info(cls, thumbs_name, is_refresh=True) -> PromptCardInfo:
        # カード情報がメモリに無い場合は新規作成
        if thumbs_name not in cls.__card_info_dict:
            #DEBUG_PRINT(f"PromptCardInfoManager card initialize: {thumbs_name}")
            cls.__card_info_dict[thumbs_name] = PromptCardInfo(thumbs_name)

        # カード情報が既にメモリにある場合でも refresh が True なら既存を破棄して新規作成
        elif is_refresh:
            #DEBUG_PRINT(f"PromptCardInfoManager card refresh: {thumbs_name}")
            cls.refresh_card_info_dict()
            cls.__card_info_dict[thumbs_name] = PromptCardInfo(thumbs_name)
        
        return cls.__card_info_dict[thumbs_name]


    @classmethod
    def get_all_card_info(cls, dir_path=None, is_refresh=True) -> list[PromptCardInfo] :
        ''' 指定されたディレクトリの全カード情報を取得
        dir_path が指定されている場合はそのディレクトリのみを取得, recurse無し (Default: None)
        is_refresh が True の場合はキャッシュを全更新(Default: True)

        Parameters:
            dir_path: 対象ディレクトリの相対パス (セパレータは任意) (Default: None)
            is_refresh: キャッシュを全更新するかどうか (Default: True)
        Returns:
            [card_info, ...]
        '''
        ret = []
        if is_refresh:
            CacheInfo.update_all_caches()

        # 対象の画像リストを取得して各カードに対して get_card_info を実行
        targets = [] # 対象カードのサムネイル名リスト

        if dir_path is None:
            targets = CacheInfo.cache_info.keys()
        else:
            dir_path = os.path.normpath(dir_path)
            if dir_path == ".": # root ディレクトリの場合は空文字に変換
                dir_path = ""
            DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info dir_path (normalized): {dir_path}")

            targets = [x for x in CacheInfo.cache_info.keys() if os.path.dirname(CacheInfo.cache_info[x].get("rel_path", "")) == dir_path]
            DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info targets: {len(targets)}")

        for thumbs_name in targets:
            card_info = cls.get_card_info(thumbs_name, is_refresh=is_refresh)
            ret.append(card_info)

        return ret


    @classmethod
    def refresh_card_info_dict(cls):
        ''' 
         - 不要なメモリを削除
         - (カードの読み直しはget_card_infoで個別に行う) '''
        cls.__remove_unused_card_info()

    @classmethod
    def __remove_unused_card_info(cls):
        for thumbs_name in list(cls.__card_info_dict.keys()):
            if thumbs_name not in CacheInfo.cache_info:
                del cls.__card_info_dict[thumbs_name]

    @classmethod
    def get_all_card_info_for_search(cls, dir_path=None, is_refresh=True) -> dict:
        ''' ブラウザ上でカードを検索するための全情報を取得, 
        org_name をキーとして全カードの下記のような辞書を返す
            { <org_name> : {
                path : {search_terms}, prompt : {prompt}, desc : {description} }
            }
         prompt, desc は lower case に変換
        
        dir_path が指定されている場合はそのディレクトリのみを取得, recurse無し (Default: None)
        is_refresh が True の場合はキャッシュを全更新(Default: True)

        Parameters:
            dir_path: 対象ディレクトリの相対パス (セパレータは任意) (Default: None)
            is_refresh: キャッシュを全更新するかどうか (Default: True)
        Returns:
            { <org_name> : {path: {search_terms}, prompt: {prompt}, desc: {description}}}
        '''
        ret = {}
        if is_refresh:
            CacheInfo.update_all_caches()

        # 対象カードを探索して情報を取得
        targets = []
        if dir_path is None:
            targets = CacheInfo.cache_info.keys()
        else:
            dir_path = os.path.normpath(dir_path)
            if dir_path == ".": # root ディレクトリの場合は空文字に変換
                dir_path = ""
            DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info_for_search dir_path (normalized): {dir_path}")
            
            targets = [x for x in CacheInfo.cache_info.keys() if os.path.dirname(CacheInfo.cache_info[x].get("rel_path", "")) == dir_path]
            DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info_for_search targets: {len(targets)}")

        for thumbs_name in targets:
            card_info = cls.get_card_info(thumbs_name, is_refresh=False).card_info

            rel_path = CacheInfo.cache_info[thumbs_name].get("rel_path", "")
            rel_path = rel_path.replace('\\', '/') # パスの区切り文字を '/' に統一

            rel_path_dir = os.path.dirname(rel_path)
            search_path = image_folder + '/' + rel_path_dir if rel_path_dir != "" else image_folder
            search_path += "$"

            org_name = html.escape(os.path.splitext(rel_path)[0])

            #DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info_for_search org_name: {org_name}")

            ret[org_name] = {
                "path": search_path,
                "prompt": card_info.get("prompt", "").lower(),
                "desc": card_info.get("description", "").lower()
            }
        return ret
    

class PromptCardInfo:
    """ プロンプトカード情報コンテナ """
    image_folder_path = os.path.join(extension_root_path, image_folder)

    @classmethod
    def __get_default_card_info(cls):
        """ デフォルトのカード情報を生成 """
        __default_card_info =  {
            'prompt': '',
            'negative_prompt': '',
            'isReplace': getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["default_is_replace"]),
            'enableCnet': getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["default_cnet_enabled"]),
            'apply_resolution': getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["default_apply_resolution"]),
            'resolution': {
                'width': getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["default_resolution_width"]),
                'height': getattr(shared.opts, PCM_SETTINGS_KEYS["cards"]["default_resolution_height"])
            },
        }
        return __default_card_info

    def __init__(self, thumbs_name):
        """ デフォルト値で初期化、既にカード情報ファイルがあれば読み込む
        この時点でサムネイルキャッシュ情報が無いことは想定しない
        """
        # self.thumbs_name
        if thumbs_name is None or len(thumbs_name) == 0:
            raise ValueError("image_name is required")
        if thumbs_name not in CacheInfo.cache_info:
            raise ValueError(f"thumbs_name not found in CacheInfo: {thumbs_name}")
        self.thumbs_name = thumbs_name

        # self.image_path
        image_path = CacheInfo.cache_info[self.thumbs_name].get('image_path', '')
        if len(image_path) == 0:
            raise ValueError(f"image_path not found in CacheInfo: {self.thumbs_name}")
        self.image_path = image_path

        # self.category
        rel_path = CacheInfo.cache_info[self.thumbs_name].get('rel_path', '')
        tmp_category = rel_path.split(os.path.sep)[0] if os.path.sep in rel_path else ''
        self.category = CategoryAlias().get_aliases().get(tmp_category, tmp_category)

        # self.card_info, self.has_card_info
        self.card_info : dict = PromptCardInfo.__get_default_card_info() # JSON ファイルに書き込む情報そのもの
        self.has_card_info = False # json が存在しない場合 False (未初期化の強調(カードの枠線)フラグ)
        self.has_some_data = False # json, txt のいずれも存在しない場合 False (プロンプトテキストの処理実施フラグ)
        self.load_card_info_from_file()


    def load_card_info_from_file(self):
        ''' プロンプトカード情報をファイルから読み込んで更新
        json, txt の優先順で読み込む
        '''
        tmp = {}
        card_info_path = self.image_path.rsplit('.', 1)[0] + '.json'
        #DEBUG_PRINT(f"PromptCardInfo.load_card_info_from_file card_info_path: {card_info_path}")
        try:
            if os.path.exists(card_info_path):
                with open(card_info_path, 'r', encoding="utf-8") as f:
                    tmp = json.load(f)
                    self.has_card_info = True
                    self.has_some_data = True
            else:
                card_info_path = self.image_path.rsplit('.', 1)[0] + '.txt'
                if os.path.exists(card_info_path):
                    with open(card_info_path, 'r', encoding="utf-8") as f:
                        tmp['prompt'] = f.read()
                        self.has_card_info = False
                        self.has_some_data = True
        except:
            print(f"Error loading prompt card info: {card_info_path}", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)

        self.card_info |= tmp


    def update_card_info(self, card_info):
        self.card_info |= card_info


    def save_card_info_to_file(self):
        ''' プロンプトカード情報をファイルに保存する '''
        try:
            card_info_path = self.image_path.rsplit('.', 1)[0] + '.json'
            with open(card_info_path, 'w', encoding="utf-8") as f:
                json.dump(self.card_info, f, indent=4)
        except Exception as e:
            print(f"Error saving prompt card info: {e}", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)
    

    def get_image_and_mask(self, mask_suffix=None) -> Tuple[str, str]:
        """
        サムネイル名から画像ファイルとマスクファイルのBase64 (Data URI (f'data:{mimetype};base64,{img_base64}')) を取得する
        無ければそれぞれ None を返す
        マスクファイルのサフィックスからマスクファイルのパスを生成する際はディレクトリトラバーサルをチェック
        同名マスクファイルがあった場合 .png, .jpg, .jpeg, .webp の順で優先
        Args:
            thumbs_name: サムネイル名
            mask_suffix: マスクファイルのサフィックス (e.g. 'M[0]') or None (不要時)
        Returns:
            (data_uri_image, data_uri_mask)
        """
        data_uri_image = None
        data_uri_mask = None
        mask_path_stem = None

        # マスクファイルのパス(拡張子無し)を生成 
        if mask_suffix is not None:
            mask_name = os.path.basename(self.image_path).rsplit('.', 1)[0] + mask_suffix # image_name.png -> image_nameM[0].png
            mask_path_stem = safe_join(os.path.dirname(self.image_path), mask_name) # ディレクトリトラバーサルチェック
            if mask_path_stem is None:
                print(f"PromptCardInfo.get_image_and_mask Directory traversal detected. mask_suffix: {mask_suffix}", file=sys.stderr)
                
        DEBUG_PRINT(f"PromptCardInfo.get_image_and_mask img_path: {self.image_path}, mask_path_stem: {mask_path_stem}")

        allowed_exts = ['.png', '.jpg', '.jpeg', '.webp']
        mimemap = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
        }

        # 画像ファイルの読み込み
        ext = os.path.splitext(self.image_path)[1]
        if ext in allowed_exts and os.path.exists(self.image_path):
            with open(self.image_path, 'rb') as f:
                data_uri_image = f'data:{mimemap[ext]};base64,{b64encode(f.read()).decode("utf-8")}'
        else:
            print(f"PromptCardInfo.get_image_and_mask Invalid image file: thumbs_name = {self.thumbs_name}, img_path = {self.image_path}", file=sys.stderr)
        
        # マスクファイルの読み込み
        if mask_path_stem is not None:
            for ext in allowed_exts:
                mask_path = mask_path_stem + ext
                if os.path.exists(mask_path):
                    with open(mask_path, 'rb') as f:
                        data_uri_mask = f'data:{mimemap[ext]};base64,{b64encode(f.read()).decode("utf-8")}'
                        break
        return data_uri_image, data_uri_mask
    
    
    def get_card_info_for_frontend(self) -> dict:
        ''' カードクリック時にプロンプトへの反映する情報
        カード情報に加え、category, has_some_data を埋め込んで返す
        '''
        #DEBUG_PRINT(f"PromptCardInfo.get_card_info_for_frontend card_info: {self.card_info}")
        data = self.card_info.copy()
        data['category'] = self.category
        data['has_some_data'] = self.has_some_data
        return data
    
    
    def get_card_info_for_search(self) -> dict:
        ''' CardSearch class 用のデータを生成
        {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}}
        '''
        ret = {}
        rel_path = CacheInfo.cache_info[self.thumbs_name].get("rel_path", "")
        rel_path = rel_path.replace('\\', '/') # パスの区切り文字を正規化

        rel_path_dir = os.path.dirname(rel_path)
        search_path = image_folder + '/' + rel_path_dir if rel_path_dir != "" else image_folder
        search_path += "$"

        org_name = html.escape(os.path.splitext(rel_path)[0])

        #DEBUG_PRINT(f"PromptCardInfoManager.get_all_card_info_for_search org_name: {org_name}")
        ret[org_name] = {
            "path": search_path,
            "prompt": self.card_info.get("prompt", "").lower(),
            "desc": self.card_info.get("description", "").lower()
        }
        return ret


