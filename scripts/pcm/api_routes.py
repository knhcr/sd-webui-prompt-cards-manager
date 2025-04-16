import os
from fastapi import FastAPI, Request, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from modules import script_callbacks
from modules import shared
from scripts.pcm.constants import thumbs_folder, endpoint_base, extension_root_path
from scripts.pcm.constants import IS_FORGE, IS_REFORGE
from scripts.pcm.constants import DEBUG_PRINT
from scripts.pcm.prompt_card_info import PromptCardInfoManager
from scripts.pcm.category import CategoryAlias
from scripts.pcm.extension_settings import PCM_SETTINGS_KEYS
from scripts.pcm.prompt_cards_page_ui import open_folder_win, create_one_item_html


class APIRoutes:
   
    card_info_manager = PromptCardInfoManager()

    @classmethod
    def register_routes(cls, app: FastAPI):
        # Static Files
        resources_path = os.path.join(extension_root_path, "html_templates", "images")
        app.mount(
            f"{endpoint_base}/resources",
            StaticFiles(directory=resources_path),
            name="prompt-cards-resources")

        thumbnails_path = os.path.join(extension_root_path, thumbs_folder)
        # サムネイルフォルダについては無ければ作る
        if not os.path.exists(thumbnails_path):
            os.makedirs(thumbnails_path, exist_ok=True)
        app.mount(
            f"{endpoint_base}/thumbnails",
            StaticFiles(directory=thumbnails_path),
            name="prompt-cards-thumbnails")

        # API endpoint
        APIRoutes.register_prompt_info_routes(app)


    @classmethod
    def register_prompt_info_routes(cls, app: FastAPI):

        @app.get(f"{endpoint_base}/prompt-card-info")
        async def prompt_card_info(request: Request):
            """ プロンプトカード情報を取得 (categoryも追加した JSON 形式)
            カードクリック時にプロンプトへの反映する情報に使用
            """
            qs = dict(request.query_params)
            #DEBUG_PRINT(f"API Routes.prompt_card_info qs: {qs}")

            card_info = cls.card_info_manager.get_card_info(qs["thumbs_name"])
            ret = card_info.get_card_info_for_frontend()
            DEBUG_PRINT(f"API Routes.prompt_card_info ret: {ret}")
            return JSONResponse(ret)
        

        @app.get(f"{endpoint_base}/prompt-card-info-all-for-search")
        async def prompt_card_info_all_for_search(request: Request):
            """ プロンプトカードをブラウザ上で検索するための全情報を取得
                cutsom_tree_button.js PcmCardSearch.updateCards() で使用
            """
            ret = cls.card_info_manager.get_all_card_info_for_search()
            DEBUG_PRINT(f"API Routes.prompt_card_info_all_for_search called")
            return JSONResponse(ret)


        @app.get(f"{endpoint_base}/image")
        async def get_image(request: Request):
            """ 画像ファイルを取得 (CNET, CNET Mask 用)
            mask が不要の場合は mask_suffix キー自体がリクエストに存在しない
            """
            qs = dict(request.query_params)
            DEBUG_PRINT(f"API Routes.get_image qs: {qs}")

            card_info = cls.card_info_manager.get_card_info(qs["thumbs_name"])
            ret = card_info.get_image_and_mask(mask_suffix = qs.get("mask_suffix", None))
            return JSONResponse(ret)
        

        @app.get(f"{endpoint_base}/refresh-category-alias")
        async def refresh_category_alias(request: Request):
            ''' サーバ内のカテゴリー Alias のリフレッシュを要求 '''
            CategoryAlias().refresh_aliases()
            return
        

        @app.get(f"{endpoint_base}/open-folder")
        async def open_folder(request: Request):
            ''' Explorer でフォルダを開く (Windows Only) '''
            qs = dict(request.query_params)
            path = qs.get("path", "")
            DEBUG_PRINT(f"API Routes.open_folder path: {path}")
            open_folder_win(path)
            return
        

        @app.get(f"{endpoint_base}/settings")
        async def get_settings(request: Request):
            ''' Settings の設定値を取得, IS_FORGE, IS_REFORGE のフラグも追加 '''
            DEBUG_PRINT(f"API Routes.get_settings")
            ret = {}
            for d in [PCM_SETTINGS_KEYS[k] for k in PCM_SETTINGS_KEYS]:
                for k in d:
                    ret[d[k]] = getattr(shared.opts, d[k])
            ret["IS_FORGE"] = IS_FORGE
            ret["IS_REFORGE"] = IS_REFORGE
            return JSONResponse(ret)


        @app.post(f"{endpoint_base}/cards")
        async def update_cards(request: Request):
            ''' カード情報を更新する '''
            body = await request.json() # [ {thumbsName: <thumbsName>}, ... ]
            DEBUG_PRINT(f"API Routes.update_cards body: {body}")
            
            ret = {}
            for item in body:
                thumbs_name = item["thumbsName"]
                DEBUG_PRINT(f"API Routes.update_cards thumbs_name: {thumbs_name}")

                # DOM の生成
                html_t2i = create_one_item_html(thumbs_name, "txt2img")
                html_i2i = create_one_item_html(thumbs_name, "img2img")

                # cardSearch class 用のデータ生成
                card_data = PromptCardInfoManager.get_card_info(thumbs_name).get_card_info_for_search()

                ret[thumbs_name] = {}
                ret[thumbs_name]["txt2img"] = html_t2i
                ret[thumbs_name]["img2img"] = html_i2i
                ret[thumbs_name]["cardData"] = card_data
            
            return JSONResponse(ret)
        
        @app.post(f"{endpoint_base}/refresh-dir")
        async def refresh_dir(request: Request):
            ''' 指定されたディレクトリを更新し、更新後のディレクトリ直下のファイルを取得 '''
            body = await request.json() # {path: <path>, tabName: <tabName>, recursive: <bool>}
            DEBUG_PRINT(f"API Routes.refresh_dir body: {body}")

            # ディレクトリ更新
            


            # 更新後のディレクトリ直下のファイルを取得
            # 取得したファイル名を返す

            return

# Register to Gradio
script_callbacks.on_app_started(lambda demo, app : APIRoutes.register_routes(app))