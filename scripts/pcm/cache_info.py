import os
import sys
import json
import time
from modules import shared
from scripts.pcm.constants import image_folder, thumbs_folder, cache_info_file, extension_root_path, endpoint_base
from PIL import Image
import base64
import hashlib
import traceback
from scripts.pcm.utility import filter_walk
import threading
from functools import lru_cache

class CacheInfo:
    ''' 
    画像のサムネイルキャッシュ情報を管理するクラス
    あくまでも画像情報の管理のみ、プロンプト等の情報は管理しない
    cache_info[thumbs_name] = {
        'mtime': image_mtime,
        'image_path': image_path, // abs path with os.path.sep
        'rel_path': rel_path, // rel path with os.path.sep
        'last_access': time.time(),
        'image_resolution': {width: int, height: int},
    }
    '''
    lock = threading.RLock()
    thumbs_folder_path = os.path.join(extension_root_path, thumbs_folder)
    cache_info = None # 全キャッシュの情報
    cache_info_file = None # chache_info を保存するファイルの絶対パス
    
    @classmethod
    def init(cls):
        os.makedirs(cls.thumbs_folder_path, exist_ok=True)
        cls.cache_info_file = os.path.join(cls.thumbs_folder_path, cache_info_file)
        cls.load_cache_info()


    @classmethod
    def load_cache_info(cls):
        ''' キャッシュ情報をファイルから読み込む '''
        with cls.lock:
            if os.path.exists(cls.cache_info_file):
                try:
                    with open(cls.cache_info_file, 'r', encoding="utf-8") as f:
                        cls.cache_info = json.load(f)
                except Exception as e:
                    print(f"Error loading cache info: {str(e)}", file=sys.stderr)
                    print(traceback.format_exc(), file=sys.stderr)
                    cls.cache_info = {}
            else:
                cls.cache_info = {}

    @classmethod
    def save_cache_info(cls):
        ''' キャッシュ情報を保存する '''
        with cls.lock:
            try:
                with open(cls.cache_info_file, 'w', encoding="utf-8") as f:
                    json.dump(cls.cache_info, f, indent=4, ensure_ascii=False)
            except Exception as e:
                print(f"Error saving cache info: {str(e)}", file=sys.stderr)
                print(traceback.format_exc(), file=sys.stderr)

            
    @classmethod
    def create_thumbnail(cls, image_path, thumbnail_path):
        ''' 画像のサムネイルを作成してファイルに保存したうえで、オリジナル画像の解像度を返す
        return : オリジナル画像の {width, height} or None (失敗した場合)
        '''
        with cls.lock:
            try:
                img_pil = Image.open(image_path)
                w, h = img_pil.size
                target_w, target_h = 300, 450

                # アスペクト比を保持しながら、指定サイズ内に収まるように縮小
                scale = min(target_w/w, target_h/h)
                new_w = int(w * scale)
                new_h = int(h * scale)

                resized_pil = img_pil.resize((new_w, new_h), Image.LANCZOS)

                # アルファチャンネルがある場合（RGBA）黒背景でRGBに変換
                if resized_pil.mode == 'RGBA':
                    background = Image.new('RGB', resized_pil.size, (0, 0, 0))
                    background.paste(resized_pil, mask=resized_pil.split()[3])
                    resized_pil = background
                elif resized_pil.mode != 'RGB':
                    # その他のモード（グレースケールなど）もRGBに変換
                    resized_pil = resized_pil.convert('RGB')

                resized_pil.save(thumbnail_path, "JPEG", quality=85)

                return {"width":w, "height":h}
            except Exception as e:
                print(f"Failed to create thumbnail for {image_path}: {str(e)}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
                return None


    @classmethod
    @lru_cache(maxsize=4096)
    def get_thumbnail_name(cls, image_path):
        ''' オリジナル画像のフルパスからサムネイルファイルのファイル名を生成して返す。拡張子は jpg 固定。
            ファイル名は image_path の self.img_folder_path からの相対パス (foo/bar/baz.png) を下記のように処理する:
             - 1. foo/bar/baz.png を url-safe base64 エンコード
                  その値が最大文字列長 116 を超えない場合、末尾に '.jpg' を付与して返す
             - 2. 1.の結果が 116 を超える場合は、1.の結果の先頭から 116 文字を取り出す。
                  さらに、1.の結果を sha256 ハッシュした値の先頭 12 文字を生成。
                  {base64_path[:116]}-{sha256_hash[:12]}.jpg を返す
        '''
        rel_path = cls.get_rel_path(image_path)
        ret = None
        base64_path = base64.urlsafe_b64encode(rel_path.encode('utf-8')).decode('utf-8')
        if len(base64_path) <= 116:
            ret = base64_path + '.jpg'
        else:
            ret = base64_path[:116]
            sha256_hash = hashlib.sha256(base64_path.encode('utf-8')).hexdigest()[:12]
            ret += '-' + sha256_hash + '.jpg'
        return ret
    

    @classmethod
    @lru_cache(maxsize=4096)
    def get_rel_path(cls, image_path):
        ''' 画像のフルパスから image_folder からの相対パスを返す '''
        return os.path.relpath(image_path, os.path.join(extension_root_path, image_folder))


    @classmethod
    def update_cache(cls, image_path):
        '''
        画像のサムネイル作成、キャッシュ情報の更新を行う。
        キャッシュが存在して更新が不要な場合スキップ
        サムネイルのファイル名を返す。(失敗した場合は None)
        '''
        with cls.lock:
            try:
                if not image_path:
                    return None
                thumbs_name = cls.get_thumbnail_name(image_path)
                image_mtime = os.path.getmtime(image_path)

                # キャッシュが存在して更新が不要な場合はそのまま返す
                if (
                    thumbs_name in cls.cache_info and # キャッシュ情報にキーが存在
                    os.path.exists(os.path.join(cls.thumbs_folder_path, thumbs_name)) and # サムネイル画像が存在
                    cls.cache_info[thumbs_name]['mtime'] == image_mtime # 画像の更新日時が一致
                ):
                    return thumbs_name

                # サムネイル作成
                image_resolution = cls.create_thumbnail(image_path, os.path.join(cls.thumbs_folder_path, thumbs_name))
                if image_resolution is not None:
                    cls.cache_info[thumbs_name] = {
                        'mtime': image_mtime,
                        'image_path': image_path,
                        'rel_path': cls.get_rel_path(image_path), # image_folder からの相対パス
                        'last_access': time.time(),
                        'image_resolution': image_resolution,
                    }
                    cls.save_cache_info()  # キャッシュ情報を保存
                    return thumbs_name

                return None
            except Exception as e:
                print(f"Error updating cache for {image_path}", file=sys.stderr)
                print(traceback.format_exc(), file=sys.stderr)
                return None


    @classmethod
    def update_all_caches(cls):
        ''' 全キャッシュを更新する '''
        with cls.lock:
            for image_path in cls.get_all_image_paths():
                cls.update_cache(image_path)
            cls.cleanup_unused_caches()


    @classmethod
    def get_all_image_paths(cls):
        ''' 全ての画像ファイルのパスを返す '''
        with cls.lock:
            valid_image_paths = []
            img_folder_path = os.path.join(extension_root_path, image_folder)
            for root, _, files in filter_walk(img_folder_path, ignore_dot_starts=shared.opts.prompt_cards_manager_ignore_dot_starts):
                for filename in files:
                    if os.path.splitext(filename)[1].lower() in ('.png', '.jpg', '.jpeg', '.webp'):
                        valid_image_paths.append(os.path.join(root, filename))
            return valid_image_paths

    @classmethod
    def cleanup_unused_caches(cls):
        ''' 存在しない画像のキャッシュを削除する '''
        with cls.lock:
            valid_image_paths = cls.get_all_image_paths()

            current_thumbs = set([cls.get_thumbnail_name(x) for x in valid_image_paths])
            cached_thumbs = set(cls.cache_info.keys())

            for thumbs_name in cached_thumbs - current_thumbs:
                thumbs_path = os.path.join(cls.thumbs_folder_path, thumbs_name)
                if os.path.exists(thumbs_path):
                    os.remove(thumbs_path)
                if thumbs_name in cls.cache_info:
                    del cls.cache_info[thumbs_name]

    @classmethod
    def find_preview(cls, thumbs_name):
        '''
        画像のサムネイルのエンドポイントURL (/prompt-cards-manager/thumbnails/xxx.jpg) を返す
        更新が走った際にブラウザにキャッシュされて無視されないように、サムネイル画像のmtimeをタイムスタンプとしてURLに追加する
        '''
        with cls.lock:
            if thumbs_name is None:
                return ""
            try:
                thumbnail_full_path = os.path.join(cls.thumbs_folder_path, thumbs_name)
                if os.path.exists(thumbnail_full_path):
                    # エンドポイントURL : /prompt-cards-manager/thumbnails/xxx.jpg?timestamp=1234567890
                    if thumbs_name in cls.cache_info:
                        timestamp = cls.cache_info[thumbs_name].get('mtime', int(time.time()))
                    else:
                        timestamp = int(time.time())
                    url_path = "/".join([endpoint_base, "thumbnails", thumbs_name]) + f"?timestamp={timestamp}"
                    return url_path
                else:
                    print(f"thumbnail file not found. {thumbnail_full_path}", file=sys.stderr)
            except Exception as e:
                print(f"Thumbnail handling failed for {thumbs_name}: {str(e)}", file=sys.stderr)
            return ""
    

CacheInfo.init() # クラス変数の初期化