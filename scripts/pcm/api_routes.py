import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from modules import script_callbacks
from scripts.pcm.constants import thumbs_folder, endpoint_base, extension_root_path
from scripts.pcm.constants import DEBUG_PRINT
from scripts.pcm.prompt_card_info import PromptCardInfoManager
from scripts.pcm.category import CategoryAlias
from scripts.pcm.prompt_cards_page_ui import open_folder_win


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
            """ プロンプトカード情報を取得 (categoryも追加した JSON 形式) """
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

# Register to Gradio
script_callbacks.on_app_started(lambda demo, app : APIRoutes.register_routes(app))