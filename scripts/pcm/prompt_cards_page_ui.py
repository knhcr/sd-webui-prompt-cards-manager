import os
import subprocess
from modules import shared, ui_extra_networks, script_callbacks
from modules.ui_extra_networks import ExtraNetworksPage, get_tree, ExtraNetworksItem
import html
import traceback
from typing import Optional
from scripts.pcm.constants import image_folder, templates_folder, endpoint_base, extension_root_path
from scripts.pcm.cache_info import CacheInfo
from scripts.pcm.prompt_card_info import PromptCardInfoManager, PromptCardInfo
from scripts.pcm.constants import DEBUG_PRINT
from scripts.pcm.utility import filter_walk, natsort_obj
from modules import extra_networks


class PromptCardsPage(ExtraNetworksPage):
    """ PromptCards タブのページ, 標準のExtraNetworksPageを無理矢理再利用 """

    @staticmethod
    def _create_custom_button_template(tpl_file, svg_icon_normal_url, svg_icon_hover_url):
        '''
        ボタンのテンプレートを読み込み、SVGアイコン ({svg_icon}) のみ挿入して返す。
        クラス変数の初期化に使うため static method
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

    # フォルダパス
    img_folder_path = os.path.join(extension_root_path, image_folder)    
    html_templates_path = os.path.join(extension_root_path, templates_folder)

    # ボタンテンプレート
    btn_send_cnet_tpl = _create_custom_button_template(
        os.path.join(html_templates_path, "send-cnet-button.html"),
        '/'.join([endpoint_base, "resources", "upload-square-svgrepo-com.svg"]),
        '/'.join([endpoint_base, "resources", "upload-square-blue-svgrepo-com.svg"])
    )
    btn_send_cnet_mask_tpl = _create_custom_button_template(
        os.path.join(html_templates_path, "send-cnet-mask-button.html"),
        '/'.join([endpoint_base, "resources", "upload-twice-square-svgrepo-com.svg"]),
        '/'.join([endpoint_base, "resources", "upload-twice-square-red-svgrepo-com.svg"])
    )
    btn_info_edit_tpl = _create_custom_button_template(
        os.path.join(html_templates_path, "info-edit-button.html"),
        '/'.join([endpoint_base, "resources", "info-1-svgrepo-com.svg"]),
        '/'.join([endpoint_base, "resources", "info-1-red-svgrepo-com.svg"])
    )

    # カスタムカードテンプレート
    custom_card_tpl = ""
    with open(os.path.join(html_templates_path, "custom-card.html.tpl"), "r", encoding="utf-8") as f:
        custom_card_tpl = f.read() 

    # カスタムツリービューテンプレート
    btn_tree_tpl = ""
    with open(os.path.join(html_templates_path, "custom-tree-button.html"), "r", encoding="utf-8") as f:
        btn_tree_tpl = f.read() 


    def __init__(self):
        super().__init__('PromptCards')
        self.enable_filter = True
        self.btn_send_cnet_tpl = PromptCardsPage.btn_send_cnet_tpl # 念のため
        self.btn_send_cnet_mask_tpl = PromptCardsPage.btn_send_cnet_mask_tpl # 念のため
        self.btn_info_edit_tpl = PromptCardsPage.btn_info_edit_tpl # 念のため
        self.custom_card_tpl = PromptCardsPage.custom_card_tpl # 念のため
        self.btn_tree_tpl = PromptCardsPage.btn_tree_tpl # 必須 (ExtraNetworksPage.__init__() で初期化されるため無いと隠蔽される)

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

        # 不要なキャッシュ情報を全削除
        CacheInfo.cleanup_unused_caches()
        CacheInfo.save_cache_info()

        index = 0
        for image_path in CacheInfo.get_all_image_paths():
            # self.folder_path からの相対パス（"prompt_cards" 含まず)
            # e.g "xxx.png", "sub1\yyy.png" (後で正規化)
            rel_path = CacheInfo.get_rel_path(image_path)
            
            # e.g. "xxx.png" -> "prompt_cards", "sub1/yyy.png" -> "prompt_cards/sub1"
            rel_path_dir = os.path.dirname(rel_path)
            search_path = os.path.join(image_folder, rel_path_dir) if rel_path_dir != "" else image_folder
            search_path = search_path.replace('\\', '/') # パスの区切り文字を正規化
        
            # direcotry end mark '$'の挿入
            #   "prompt_cards"      -> "prompt_cards$"
            #   "prompt_cards/sub1" -> "prompt_cards/sub1$"
            search_path += "$"
            
            # 個別画像のキャッシュの更新
            thumbs_name = CacheInfo.update_cache(image_path)
            preview_url = CacheInfo.find_preview(thumbs_name) # サムネイルのエンドポイントURL
    
            item = {
                "name": rel_path.replace('\\', '/'), # "sub1/xxx.png"
                "filename": image_path, # "/physical_full_path/prompt_cards/sub1/xxx.png"
                "shorthash": "",
                "preview": preview_url, 
                "local_preview": image_path,
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
        return PromptCardsPage.create_item_html_base(tabname, item, template, self.extra_networks_tabname)


    def create_card_view_html(self, tabname: str, *, none_message) -> str:
        """Generates HTML for the network Card View section for a tab.

        This HTML goes into the `extra-networks-pane.html` <div> with
        `id='{tabname}_{extra_networks_tabname}_cards`.

        Args:
            tabname: The name of the active tab.
            none_message: HTML text to show when there are no cards.

        Returns:
            HTML formatted string.
        """
        res = ""

        for item in natsort_obj(self.items.values(), key=lambda x: x["filename"]):
            res += self.create_item_html(tabname, item, self.card_tpl)

        if res == "":
            dirs = "".join([f"<li>{x}</li>" for x in self.allowed_directories_for_previews()])
            res = none_message or shared.html("extra-networks-no-cards.html").format(dirs=dirs)

        return res


    @classmethod
    def create_item_html_base(cls, tabname, item, template=None, extra_networks_tabname=None):
        ''' create_item_html() の実体を外部からも呼べるように共通部分をクラスメソッド化して切り出し '''
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
        
        # カード情報
        card_info : PromptCardInfo = PromptCardInfoManager.get_card_info(thumbs_name)

        # カスタムカード用のボタン群
        cnet_enabled = card_info.card_info.get("enableCnet", shared.opts.prompt_cards_manager_default_cnet_enabled)
        #  - CNET 送信ボタン
        classes = "pcm-card-button pcm-card-button-cnet"
        if not cnet_enabled:
            classes += " cnet-disabled"
        send_cnet_button = cls.btn_send_cnet_tpl.format(
            classes=classes,
            tabname=tabname,
            thumbs_name=thumbs_name,
        )
        #  - CNET マスク送信ボタン
        classes = "pcm-card-button pcm-card-button-cnet-mask"
        if not cnet_enabled:
            classes += " cnet-disabled"
        send_cnet_mask_button = cls.btn_send_cnet_mask_tpl.format(
            classes=classes,
            tabname=tabname,
            thumbs_name=thumbs_name,
            mask_suffix="M[0]", # [TODO] とりあえず版
        )
        #  - カード情報編集ボタン
        classes = "pcm-card-button pcm-info-edit-button"
        info_edit_button = cls.btn_info_edit_tpl.format(
            classes=classes,
            tabname=tabname,
            thumbs_name=thumbs_name
        )

        # 検索用キーワードの埋め込み
        search_terms_html = ""
        search_term_template = "<span class='hidden search_terms'>{search_term}</span>"
        for search_term in item.get("search_terms", []):
            search_terms_html += search_term_template.format(search_term=search_term)

        # 表示名から拡張子を削除
        org_name = html.escape(os.path.splitext(item.get("name", ""))[0])
        base_name = os.path.basename(org_name)
        
        # テンプレートに渡す辞書
        item_with_extras = {
            "background_image": background_image,
            "card_clicked": onclick,
            "description": html.escape(item.get("description", "")),
            "local_preview": html.escape(item.get("local_preview", "")),
            "name": base_name, # 初期値は hideDirName = True
            "prompt": item.get("prompt", ""),
            "save_card_preview": html.escape(f"return saveCardPreview(event, '{tabname}', '{item.get('local_preview', '')}');"),
            "search_only": "",
            "search_terms": search_terms_html,
            "sort_keys": "",
            "style": style,
            "tabname": tabname,
            "extra_networks_tabname": extra_networks_tabname,
            "send_cnet_mask_button": send_cnet_mask_button,
            "send_cnet_button": send_cnet_button,
            "info_edit_button": info_edit_button,
            "orgName": org_name, # hideDirName 用 (相対パス付きファイル名)
            "baseName": base_name, # hideDirName 用 (ファイル名のみ)
            "noCardInfo": "" if card_info.has_card_info else " no-card-info", # カード情報がない場合は div.card に "no-card-info" クラスを付与
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
            return cls.custom_card_tpl.format(**item_with_extras)


    def create_tree_view_html(self, tabname: str) -> str:
        """Generates HTML for displaying folders in a tree view.
        File アイテムは作成しない

        Args:
            tabname: The name of the active tab.

        Returns:
            HTML string generated for this tree view.
        """
        res = ""

        # Setup the tree dictionary.
        roots = self.allowed_directories_for_previews()
        tree_items = {v["filename"]: ExtraNetworksItem(v) for v in self.items.values()}
        tree = get_tree([os.path.abspath(x) for x in roots], items=tree_items)

        if not tree:
            return res

        def _build_tree(data: Optional[dict[str, ExtraNetworksItem]] = None) -> Optional[str]:
            """Recursively builds HTML for a tree.

            Args:
                data: Dictionary representing a directory tree. Can be NoneType.
                    Data keys should be absolute paths from the root and values
                    should be subdirectory trees or an ExtraNetworksItem.

            Returns:
                If data is not None: HTML string
                Else: None
            """
            if not data:
                return None

            # Lists for storing <li> items html for directories and files separately.
            _dir_li = []
            _file_li = []

            dummy_file_added = False
            for k, v in natsort_obj(data.items(), key=lambda x:x[0]):
                # k は dir_path
                #   - data-path 属性にそのまま入る
                #   - os.path.basename(k) が action_list_item_label (=ボタンのラベル) に入る
                if isinstance(v, (ExtraNetworksItem,)):
                    if not dummy_file_added:
                        _file_li.append("<li class='tree-list-item tree-list-item--subitem' data-tree-entry-type='file'></li>")
                        dummy_file_added = True
                    else:
                        pass
                else:
                    _dir_li.append(self.create_tree_dir_item_html(tabname, k, _build_tree(v)))

            # Directories should always be displayed before files so we order them here.
            return "".join(_dir_li) + "".join(_file_li)
            

        # Add each root directory to the tree.
        for k, v in natsort_obj(tree.items(), key=lambda x:x[0]):
            item_html = self.create_tree_dir_item_html(tabname, k, _build_tree(v))
            # Only add non-empty entries to the tree.
            if item_html is not None:
                res += item_html

        return f"<ul class='tree-list tree-list--tree'>{res}</ul>"


    def create_dirs_view_html(self, tabname: str) -> str:
        """ Settings でツリービューではなくフォルダビューを選択している場合のボタン群を生成 """

        subdirs = {}
        for parentdir in [os.path.abspath(x) for x in self.allowed_directories_for_previews()]:
            if not os.path.exists(parentdir):
                break

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

        dir_names = [x.replace('\\', '/') for x in subdirs.keys()]

        subdirs_html = "".join([f"""
        <button class='lg secondary gradio-button custom-button{" search-all" if subdir == "" else ""}' onclick='extraNetworksSearchButton("{tabname}", "{self.extra_networks_tabname}", event)'>
        {html.escape(subdir if subdir != "" else "all")}
        </button>
        """ for subdir in dir_names])

        return subdirs_html


def create_one_item_html(thumbs_name, tabname):
    ''' 指定した thumbs_name のカードのHTMLを生成 (部分アップデート用) '''
    # item Object を生成する
    cache_info = CacheInfo.cache_info[thumbs_name]
    card_info :PromptCardInfo = PromptCardInfoManager.get_card_info(thumbs_name)

    image_path = cache_info.get('image_path', '')
    rel_path = cache_info.get('rel_path', '')

    # e.g. "xxx.png" -> "prompt_cards", "sub1/yyy.png" -> "prompt_cards/sub1"
    rel_path_dir = os.path.dirname(rel_path)
    search_path = os.path.join(image_folder, rel_path_dir) if rel_path_dir != "" else image_folder
    search_path = search_path.replace('\\', '/') # パスの区切り文字を正規化

    # direcotry end mark '$'の挿入
    #   "prompt_cards"      -> "prompt_cards$"
    #   "prompt_cards/sub1" -> "prompt_cards/sub1$"
    search_path += "$"

    # 個別画像のキャッシュの更新
    CacheInfo.update_cache(image_path)
    preview_url = CacheInfo.find_preview(thumbs_name) # サムネイルのエンドポイントURL

    item = {
        "name": rel_path.replace('\\', '/'), # "sub1/xxx.png"
        "filename": image_path, # "/physical_full_path/prompt_cards/sub1/xxx.png"
        "shorthash": "",
        "preview": preview_url,
        "local_preview": image_path,
        "prompt": "",
        "description": "",
        "metadata": {},
        "search_terms": [search_path], # "prompt_cards/sub1$"
        "sort_keys": {"default": 0}, # sort はしないので適当に 0 を入れておく
    }

    # 標準の refresh ボタンを押した際の処理に合わせるため、
    # item の更新処理である A1111 標準関数 self.read_user_metadata() と全く同じ処理を挟む
    #  - user_medatada は カード.json の中身をそのまま入れているだけで PCM では未使用なため、
    #    処理の実体としては description をセットするだけで良いが念のため
    filename = item.get("filename", None)
    metadata = extra_networks.get_user_metadata(filename, lister=None)
    desc = metadata.get("description", None)
    if desc is not None:
        item["description"] = desc
    item["user_metadata"] = metadata    

    # カード情報のHTMLを返す
    html = PromptCardsPage.create_item_html_base(tabname, item, PromptCardsPage.custom_card_tpl, "promptcards")
    return html


def create_one_dir_html(path: str, tabname: str):
    ''' 指定されたパスのディレクトリのHTMLを生成 '''
    # 指定した dir のファイル情報を更新し、当該フォルダ内の画像の card_info を取得
    card_info_list = PromptCardInfoManager.get_all_card_info(path)

    DEBUG_PRINT(f"create_one_dir_html path: {path}, tabname: {tabname} : images : {len(card_info_list)}")

    # 取得した card_info のリストをもとにHTMLを生成

    card_info_list = natsort_obj(card_info_list, key=lambda x: x.image_path)

    return "\n".join([create_one_item_html(card_info.thumbs_name, tabname) for card_info in card_info_list])



def open_folder_win(path: str):
    ''' Explorer でフォルダを開く (Windows Only)
    path: フォルダのパス (image_folder からの相対パス, sep は '/')
    '''
    if not shared.opts.prompt_cards_manager_open_folder_enabled:
        return
    base_path = os.path.normpath(os.path.join(extension_root_path, image_folder))
    if not os.path.exists(base_path):
        return
    target = os.path.normpath(os.path.join(base_path, path))
    if not os.path.exists(target):
        target = base_path

    try:
        DEBUG_PRINT(f"open_folder_win target: {target}")
        subprocess.Popen(["explorer.exe", target])
    except Exception as e:
        print(f"PromptCardsManager: Folder Open Error: {e}")
        print(traceback.format_exc())


# ページを登録
script_callbacks.on_before_ui(lambda : ui_extra_networks.register_page(PromptCardsPage()))
