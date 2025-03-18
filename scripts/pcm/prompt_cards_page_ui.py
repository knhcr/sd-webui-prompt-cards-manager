import os
from modules import shared, ui_extra_networks, script_callbacks
from modules.ui_extra_networks import ExtraNetworksPage
import html
import traceback
from scripts.pcm.constants import image_folder, templates_folder, endpoint_base, extension_root_path
from scripts.pcm.cache_info import CacheInfo
from scripts.pcm.prompt_card_info import PromptCardInfoManager
from scripts.pcm.constants import DEBUG_PRINT
from scripts.pcm.utility import filter_walk


class PromptCardsPage(ExtraNetworksPage):
    """ PromptCards タブのページ, 標準のExtraNetworksPageを無理矢理再利用 """

    def __init__(self):
        super().__init__('PromptCards')
        self.enable_filter = True
        self.img_folder_path = os.path.join(extension_root_path, image_folder)

        # テンプレートの読み込み
        self.html_templates_path = os.path.join(extension_root_path, templates_folder)

        # - ボタンテンプレート
        self.btn_send_cnet_tpl = self._create_custom_button_template(
            os.path.join(self.html_templates_path, "send-cnet-button.html"),
            '/'.join([endpoint_base, "resources", "upload-square-svgrepo-com.svg"]),
            '/'.join([endpoint_base, "resources", "upload-square-red-svgrepo-com.svg"])
        )
        self.btn_send_cnet_mask_tpl = self._create_custom_button_template(
            os.path.join(self.html_templates_path, "send-cnet-mask-button.html"),
            '/'.join([endpoint_base, "resources", "upload-twice-square-svgrepo-com.svg"]),
            '/'.join([endpoint_base, "resources", "upload-twice-square-red-svgrepo-com.svg"])
        )
        self.btn_info_edit_tpl = self._create_custom_button_template(
            os.path.join(self.html_templates_path, "info-edit-button.html"),
            '/'.join([endpoint_base, "resources", "info-1-svgrepo-com.svg"]),
            '/'.join([endpoint_base, "resources", "info-1-red-svgrepo-com.svg"])
        )

        # - カスタムカードテンプレート
        self.custom_card_tpl = ""
        with open(os.path.join(self.html_templates_path, "custom-card.html.tpl"), "r", encoding="utf-8") as f:
            self.custom_card_tpl = f.read() 

        # - カスタムツリービューテンプレート
        self.btn_tree_tpl = ""
        with open(os.path.join(self.html_templates_path, "custom-tree-button.html"), "r", encoding="utf-8") as f:
            self.btn_tree_tpl = f.read() 


    def _create_custom_button_template(self, tpl_file, svg_icon_normal_url, svg_icon_hover_url):
        '''
        ボタンのテンプレートを読み込み、SVGアイコン ({svg_icon}) のみ挿入して返す。

        Args:
            tpl_file: ボタンのテンプレートファイルのパス
            svg_icon_normal_url: 通常時のアイコン用SVG画像のEndpoint URL
            svg_icon_hover_url: マウスホバー時のアイコン用SVG画像のEndpoint URL
        Returns:
            str: ボタンのHTMLテンプレート
        '''
        res = ""
        with open(tpl_file, "r", encoding="utf-8") as f:
            res = f.read()
        
        # 両方のアイコンを含むHTMLを作成
        normal_icon_html = f'<span class="normal-icon"><img src="{svg_icon_normal_url}"></img></span>'
        hover_icon_html = f'<span class="hover-icon"><img src="{svg_icon_hover_url}"></img></span>'
        
        class SafeDict(dict):
            def __missing__(self, key):
                return f"{{{key}}}"

        return res.format_map(
            SafeDict({"svg_icon":normal_icon_html + hover_icon_html})
        )


    def refresh(self):
        ''' ブラウザのリフレッシュボタンを押した際の処理
        この後に list_items(), create_html() が呼び出されるので特に何もしない '''
        pass



    def list_items(self):
        ''' ページ初回ロード時、および、リフレッシュ時のrefresh()の後に呼ばれる '''
        img_folder_path = os.path.join(extension_root_path, image_folder)
        if not os.path.exists(img_folder_path):
            os.makedirs(img_folder_path, exist_ok=True)
            return

        valid_image_paths = []
        for root, _, files in filter_walk(self.img_folder_path, ignore_dot_starts=shared.opts.prompt_cards_manager_ignore_dot_starts):
            for filename in files:
                if os.path.splitext(filename)[1].lower() in ('.png', '.jpg', '.jpeg', '.webp'):
                    valid_image_paths.append(os.path.join(root, filename))
        
        # 不要なキャッシュ情報を全削除
        CacheInfo.cleanup_unused_caches(valid_image_paths)
        CacheInfo.save_cache_info()

        index = 0
        for img_full_path in valid_image_paths:
            # self.folder_path からの相対パス（"prompt_cards" 含まず)
            # e.g "xxx.png", "sub1\yyy.png" (後で正規化)
            rel_path = os.path.relpath(img_full_path, img_folder_path)
            
            # e.g. "xxx.png" -> "prompt_cards", "sub1/yyy.png" -> "prompt_cards/sub1"
            search_path = os.path.join(os.path.split(img_folder_path)[1],os.path.dirname(rel_path))
            search_path = search_path.replace('\\', '/') # パスの区切り文字を正規化
        
            # direcotry end mark '$'の挿入
            #   "prompt_cards"      -> "prompt_cards$"
            #   "prompt_cards/sub1" -> "prompt_cards/sub1$"
            search_path += "$"
            
            # 個別画像のキャッシュの更新
            thumbs_name = CacheInfo.update_cache(img_full_path, rel_path)
            preview_url = CacheInfo.find_preview(thumbs_name) # サムネイルのエンドポイントURL
    
            item = {
                "name": rel_path.replace('\\', '/'), # "sub1/xxx.png"
                "filename": img_full_path, # "/physical_full_path/prompt_cards/sub1/xxx.png"
                "shorthash": "",
                "preview": preview_url, 
                "local_preview": img_full_path,
                "prompt": "",
                "description": "",
                "metadata": {},
                "search_terms": [search_path], # "prompt_cards/sub1$"
                "sort_keys": {"default": index},
            }
        
            index += 1
            yield item


    def allowed_directories_for_previews(self):
        return [os.path.join(extension_root_path, image_folder)]

    def create_item_html(self, tabname, item, template=None):
        ''' list_items() で生成された item をもとにカードのHTML string を生成する
        template が渡されない場合は TreeView 生成用の辞書を返す'''
        # スタイル設定
        style_height = f"height: {shared.opts.extra_networks_card_height}px;" if shared.opts.extra_networks_card_height else ''
        style_width = f"width: {shared.opts.extra_networks_card_width}px;" if shared.opts.extra_networks_card_width else ''
        style_font_size = f"font-size: {shared.opts.extra_networks_card_text_scale*100}%;"
        style = style_height + style_width + style_font_size

        # サムネイルのファイル名を取得 
        thumbs_name = CacheInfo.get_thumbnail_name(item.get("filename", ""))

        # カードクリック時のJavaScriptコード
        onclick = f"pcmCardClick(event, '{tabname}', '{thumbs_name}')"
        
        # プレビュー画像のHTML
        preview = item.get("preview", None)
        background_image = f'<img src="{html.escape(preview)}" class="preview" loading="lazy">' if preview else ''
        
        # カスタムカード用のボタン群
        cnet_enabled = PromptCardInfoManager.get_card_info(thumbs_name).card_info.get(
            "enableCnet", shared.opts.prompt_cards_manager_default_cnet_enabled)

        # CNET 送信ボタン
        classes = "pcm-send-with-cnet-button card-button pcm-svg-icon"
        if not cnet_enabled:
            classes += " cnet-disabled"
        send_cnet_button = self.btn_send_cnet_tpl.format(
            classes=classes,
            tabname=tabname,
            thumbs_name=thumbs_name,
        )

        # CNET マスク送信ボタン
        classes = "pcm-send-with-cnet-mask-button card-button pcm-svg-icon"
        if not cnet_enabled:
            classes += " cnet-disabled"
        send_cnet_mask_button = self.btn_send_cnet_mask_tpl.format(
            classes=classes,
            tabname=tabname,
            thumbs_name=thumbs_name,
            mask_suffix="M[0]", # [TODO] とりあえず版
        )

        info_edit_button = self.btn_info_edit_tpl.format(
            tabname=tabname,
            thumbs_name=thumbs_name
        )

        # 検索用キーワードの埋め込み
        search_terms_html = ""
        search_term_template = "<span class='hidden search_terms'>{search_term}</span>"
        for search_term in item.get("search_terms", []):
            search_terms_html += search_term_template.format(search_term=search_term)

        # 表示名から拡張子を削除
        name = os.path.splitext(html.escape(item.get("name", "")))[0]
        
        # テンプレートに渡す辞書
        item_with_extras = {
            "background_image": background_image,
            "card_clicked": onclick,
            "description": html.escape(item.get("description", "")),
            "local_preview": html.escape(item.get("local_preview", "")),
            "name": name,
            "prompt": item.get("prompt", ""),
            "save_card_preview": html.escape(f"return saveCardPreview(event, '{tabname}', '{item.get('local_preview', '')}');"),
            "search_only": "",
            "search_terms": search_terms_html,
            "sort_keys": "",
            "style": style,
            "tabname": tabname,
            "extra_networks_tabname": self.extra_networks_tabname,
            "send_cnet_mask_button": send_cnet_mask_button,
            "send_cnet_button": send_cnet_button,
            "info_edit_button": info_edit_button,
        }
        
        # template が渡されなかった場合は辞書を返す (TreeView生成処理)
        if template is None:
            # copy_path_button, edit_button, metadata_button は本来不要だが
            # ExtraNetworksPage.create_item_html() でキーがないとエラーになるので空文字を追加してから渡す
            item_with_extras["copy_path_button"] = ""
            item_with_extras["edit_button"] = ""
            item_with_extras["metadata_button"] = ""
            return item_with_extras
        
        # template が渡された場合はHTMLを返す
        else:
            # 渡されたテンプレートは無視してカスタムテンプレートを使用
            return self.custom_card_tpl.format(**item_with_extras)
        

    def create_dirs_view_html(self, tabname: str) -> str:
        """ Settings でツリービューではなくフォルダビューを選択している場合のボタン群を生成 """

        subdirs = {}
        for parentdir in [os.path.abspath(x) for x in self.allowed_directories_for_previews()]:
            for root, dirs, _ in sorted(filter_walk(parentdir, ignore_dot_starts=shared.opts.prompt_cards_manager_ignore_dot_starts), key=lambda x: shared.natural_sort_key(x[0])):
                for dirname in sorted(dirs, key=shared.natural_sort_key):
                    x = os.path.join(root, dirname)

                    if not os.path.isdir(x):
                        continue

                    subdir = os.path.abspath(x)[len(parentdir):]

                    if shared.opts.extra_networks_dir_button_function:
                        if not subdir.startswith(os.path.sep):
                            subdir = os.path.sep + subdir
                    else:
                        while subdir.startswith(os.path.sep):
                            subdir = subdir[1:]

                    is_empty = len(os.listdir(x)) == 0
                    if not is_empty and not subdir.endswith(os.path.sep):
                        subdir = subdir + os.path.sep

                    if (os.path.sep + "." in subdir or subdir.startswith(".")) and not shared.opts.extra_networks_show_hidden_directories:
                        continue

                    # ここだけ追加
                    if subdir.endswith(os.path.sep):
                        subdir = subdir[:-1]

                    subdirs[subdir] = 1

        if subdirs:
            subdirs = {"": 1, **subdirs}


        subdirs_html = "".join([f"""
        <button class='lg secondary gradio-button custom-button{" search-all" if subdir == "" else ""}' onclick='extraNetworksSearchButton("{tabname}", "{self.extra_networks_tabname}", event)'>
        {html.escape(subdir if subdir != "" else "all")}
        </button>
        """ for subdir in subdirs])

        return subdirs_html


# ページを登録
script_callbacks.on_before_ui(lambda : ui_extra_networks.register_page(PromptCardsPage()))

