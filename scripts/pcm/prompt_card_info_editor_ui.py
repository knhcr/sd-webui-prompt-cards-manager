import gradio as gr
from modules import script_callbacks

import sys
import os
import traceback
from string import Template
from werkzeug.utils import safe_join
from scripts.pcm.constants import thumbs_folder, endpoint_base, extension_root_path
from scripts.pcm.constants import DEBUG_PRINT
from scripts.pcm.cache_info import CacheInfo
from scripts.pcm.prompt_card_info import PromptCardInfoManager
from PIL import Image
from modules.images import read_info_from_image
from modules.infotext_utils import parse_generation_parameters
from modules import shared


class PromptCardInfoEditorUi:

    # パイプライン用 JS 関数 (fn の前にコールされる)
    _js_pipelines ={
        # プロンプトカード情報エディタの画面表示(Gradioの管轄外)を更新する
        "pcmPieRefresh" : Template('''function(...args){
            PCM_DEBUG_PRINT("gradio pipeline pcmPieRefresh");
            const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
            setTimeout(pcmPieRefresh, 400); // データが更新されるまで少し時間がかかるため
            return inputs;
        }'''),
        
        # プロンプトカード情報エディタの画面表示(Gradioの管轄外)をリセットする
        "pcmPieResetPage" : Template('''function(...args){
            PCM_DEBUG_PRINT("gradio pipeline pcmPieResetPage");
            const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
            pcmPieResetPage();
            return inputs;
        }'''),
    }

    image_resolution_text_tpl = '<span id="{id_w}" class="{cls_w}">{width}</span> x <span id="{id_h}" class="{cls_h}">{height}</span>'\
        .format(
            id_w = "pcm_pie_image_resolution_text_w",
            cls_w = "pcm-pie-image-resolution-text-value",
            id_h = "pcm_pie_image_resolution_text_h",
            cls_h = "pcm-pie-image-resolution-text-value",
            width = '{width}', height = '{height}'
        )

    card_info_manager = PromptCardInfoManager()

    @classmethod
    def create_ui(cls):
        with gr.Group(elem_id="pcm_pie"):
            # thumbs_name$datetime (モーダルオープンイベント検出＆ファイル名受け取り用の非表示の Textbox)
            filename_input = gr.Textbox(value="", visible=False, elem_id="pcm_filename_input")

            # 背景オーバーレイ
            overlay_html = '<div id="{elem_id}" class="pcm-pie-overlay""></div>'
            overlay = gr.HTML(overlay_html.format(elem_id="pcm_pie_overlay"), visible=False)

            # モーダルウィンドウのコンテナ
            with gr.Box(visible=False, elem_id="pcm_pie_container", elem_classes="pcm-pie-container") as pie_container:
                filename_label = gr.HTML("<h2> test_dir\\test_file.png </h2>")
                
                # コンテンツエリア
                with gr.Box(elem_classes="pcm-pie-content"):
                    # テキストボックスとイメージを横に並べるためのRow
                    with gr.Row():
                        # 左側のカラム（テキストボックス群）
                        with gr.Column(scale=1):
                            prompt = gr.Textbox(label="Prompt", elem_id="pcm_pie_prompt",
                                                lines=10, interactive=True, elem_classes=["txt2img", "prompt"])
                            negative_prompt = gr.Textbox(label="Negative Prompt", elem_id="pcm_pie_negative_prompt",
                                                         lines=3, interactive=True, elem_classes=["txt2img", "prompt", "negative_prompt"])
                            description = gr.Textbox(label="Description", elem_id="pcm_pie_description",
                                                     lines=7, interactive=True)
                            isReplace = gr.Checkbox(label="Replace Mode", elem_id="pcm_pie_is_replace_checkbox",
                                                    value=shared.opts.prompt_cards_manager_default_is_replace, interactive=True)
                            enableCnet = gr.Checkbox(label="CNet Enabled", elem_id="pcm_pie_enable_cnet_checkbox",
                                                     value=shared.opts.prompt_cards_manager_default_cnet_enabled, interactive=True)
                            # 解像度グループ                            
                            with gr.Box(elem_classes="pcm-pie-resolution-box"):
                                apply_resolution = gr.Checkbox(label="Apply Resolution to Generation Parameters",
                                                               elem_id="pcm_pie_apply_resolution_checkbox",
                                                               value=shared.opts.prompt_cards_manager_default_apply_resolution,
                                                               interactive=True, show_label=True)
                                
                                # 解像度スライダとアス比固定ボタン
                                with gr.Row(elem_classes="pcm-pie-resolution-row"):
                                    with gr.Column(scale=1):
                                        resolution_width = gr.Slider(
                                            label="Width", elem_id="pcm_pie_resolution_slider_width",
                                            minimum=64, maximum=3072, step=8, value=shared.opts.prompt_cards_manager_default_resolution_width,
                                            interactive=True, show_label=True)

                                        resolution_height = gr.Slider(
                                            label="Height", elem_id="pcm_pie_resolution_slider_height",
                                            minimum=64, maximum=3072, step=8, value=shared.opts.prompt_cards_manager_default_resolution_height,
                                            interactive=True, show_label=True)
                                        
                                    with gr.Column(scale=0):
                                        # JS側のコールバックを使うため、ベタ書きでボタンを作成
                                        btn_html = '<div id="{id}" class="{cls}" onclick="{js_func}">{initial_inner}</div>'.format(
                                            id="pcm_pie_fix_aspect_ratio_btn",
                                            cls="pcm-pie-fix-aspect-ratio-btn",
                                            js_func="pcmPieAspectRatioStatus.toggleAspectRatio()",
                                            initial_inner="<img src='{img_path}'></img>".format(
                                                img_path='/'.join([endpoint_base, "resources", "lock-unlocked-svgrepo-com.svg"])
                                            )
                                        )
                                        gr.HTML(btn_html, elem_id="pcm_pie_fix_aspect_ratio_btn_wrapper") # ボタンレイアウトはこのwrapperを動かす
                                    
                                with gr.Row(elem_id="pcm_pie_resolution_slider_footer"):
                                    with gr.Column(scale=1):
                                        # ボタンエリア
                                        with gr.Row(elem_id="pcm_pie_resolution_slider_footer_btn_row"):
                                            gr.Button("1/2", elem_id="pcm_pie_resolution_slider_footer_btn_d2", size="sm", variant="secondary")
                                            gr.Button("8 n", elem_id="pcm_pie_resolution_slider_footer_btn_8", size="sm", variant="secondary")
                                            gr.Button("64 n", elem_id="pcm_pie_resolution_slider_footer_btn_64", size="sm", variant="secondary")
                                    with gr.Column(scale=1):
                                        # 解像度フッターテキスト
                                        #  - アスペクト比
                                        gr.HTML(
                                            'aspect ratio : <span id="{id_w}" class="{cls}">1</span> : <span id="{id_h}" class="{cls}">1.0000</span>'.format(
                                                id_w="pcm_pie_resolution_slider_footer_text_aspect_ratio_w",
                                                id_h="pcm_pie_resolution_slider_footer_text_aspect_ratio_h",
                                                cls="pcm-pie-resolution-slider-footer-text"),
                                            elem_id="pcm_pie_resolution_slider_footer_text_aspect_ratio_wrapper",
                                            elem_classes="pcm_pie_resolution_slider_footer_label")
                                        
                                        #  - ピクセル数のルート
                                        gr.HTML(
                                            'square root of total pixels : <span id="{id}" class="{cls}">1024</span>'.format(
                                                id="pcm_pie_resolution_slider_footer_text_square_root",
                                                cls="pcm-pie-resolution-slider-footer-text"),
                                            elem_id="pcm_pie_resolution_slider_footer_text_square_root_wrapper",
                                            elem_classes="pcm_pie_resolution_slider_footer_label")
                                        

                        # 右側のカラム
                        with gr.Column(scale=0, elem_classes="pcm-pie-content-right"):
                            thumbnail = gr.Image(
                                type="filepath", value=None,
                                elem_classes="pcm-pie-image",
                                show_label=False, show_download_button=False, 
                                show_share_button=False,
                                interactive=False,
                                height=454, width=256,
                            )
                            gr.HTML('<div class="pcm-pie-image-separator"></div>') # 画像とテキストの区切り
                            
                            img_resolution_text = gr.HTML(
                                cls.image_resolution_text_tpl.format(width=1024, height=1024),
                                elem_classes="pcm-pie-image-resolution-text",
                                elem_id="pcm_pie_image_resolution_text_wrapper")

                            gr.HTML('<div style="height:25px;"></div>')
                            gr.HTML("Set Data from Image Metadata", elem_classes="pcm-pie-set-data-from-image")
                            with gr.Row(elem_classes="pcm-pie-data-set-buttons"):
                                prpt_btn = gr.Button("Prompt", elem_id="pcm_pie_data_set_prpt_btn", size="sm", variant="secondary")
                                neg_btn = gr.Button("Negative Prompt", elem_id="pcm_pie_data_set_neg_btn", size="sm", variant="secondary")
                                res_btn = gr.Button("Resolution", elem_id="pcm_pie_data_set_res_btn", size="sm", variant="secondary")
            
                    # ボタンエリア
                    with gr.Row(elem_classes="pcm-pie-footer-btn-row"):
                        cancel_btn = gr.Button("Cancel", variant="secondary", elem_id="pcm_pie_close_btn")
                        save_btn = gr.Button("Save", variant="primary", elem_id="pcm_pie_save_btn")


        # コールバック登録

        #  - モーダルオープン (filename_input の input イベント)
        filename_input__inputs = [
            filename_input
        ]
        filename_input__outputs = [
            pie_container, overlay, filename_label, thumbnail, description, prompt, negative_prompt,
            isReplace, enableCnet, apply_resolution, resolution_width, resolution_height, img_resolution_text,
        ]
        filename_input.input(
            fn=cls.show_modal,
            inputs=filename_input__inputs,
            outputs=filename_input__outputs,
            _js=cls._js_pipelines['pcmPieRefresh'].substitute(num_inputs=len(filename_input__inputs)), # JS側の画面更新処理
        )

        #  - 閉じるボタンクリック
        cancel_btn__inputs = []
        cancel_btn__outputs = filename_input__outputs
        cancel_btn.click(
            fn=cls.close_modal,
            inputs=cancel_btn__inputs,
            outputs=cancel_btn__outputs,
            _js=cls._js_pipelines['pcmPieResetPage'].substitute(num_inputs=len(cancel_btn__inputs)), # JS側の画面リセット処理
        )
        
        #  - 保存ボタンクリック (保存 & 閉じる)
        save_btn__inputs = [
            filename_input, prompt, negative_prompt, description,
            isReplace, enableCnet, apply_resolution, resolution_width, resolution_height,
        ]
        save_btn__outputs = filename_input__outputs
        save_btn.click(
            fn=cls.save_and_close,
            inputs=save_btn__inputs,
            outputs=save_btn__outputs,
            _js=cls._js_pipelines['pcmPieResetPage'].substitute(num_inputs=len(save_btn__inputs)), # JS側の画面リセット処理
        )
        
        #  - Prompt ボタンクリック
        prpt_btn__inputs = [prompt, filename_input]
        prpt_btn__outputs = [prompt]
        prpt_btn.click(
            fn=lambda prompt, filename_input: cls.update_prompt_from_image(prompt, filename_input, False),
            inputs=prpt_btn__inputs,
            outputs=prpt_btn__outputs,
        )

        #  - Negative Prompt ボタンクリック
        neg_btn__inputs = [negative_prompt, filename_input]
        neg_btn__outputs = [negative_prompt]
        neg_btn.click(
            fn=lambda prompt, filename_input: cls.update_prompt_from_image(prompt, filename_input, True),
            inputs=neg_btn__inputs,
            outputs=neg_btn__outputs,
        )

        return None


    @classmethod
    def show_modal(cls, filename_input):
        """モーダルとオーバーレイを表示"""
        DEBUG_PRINT(f"show_modal called with value: {filename_input}")

        thumbs_name = filename_input.split("$")[0]
        rel_path = CacheInfo.cache_info.get(thumbs_name, {}).get('rel_path', '')
        label = f"<h2>{rel_path}</h2>".format(rel_path=rel_path)

        DEBUG_PRINT(f"thumbs_name: {thumbs_name}, rel_path: {rel_path}")

        image_resolution = CacheInfo.cache_info.get(thumbs_name, {}).get('image_resolution', {})
        image_resolution_text = cls.image_resolution_text_tpl.format(
            width=image_resolution.get('width', 1024),
            height=image_resolution.get('height', 1024)
        )

        # prompt card info を取得
        card_info_container = cls.card_info_manager.get_card_info(thumbs_name)

        description = card_info_container.card_info.get('description', '')
        prompt = card_info_container.card_info.get('prompt', '')
        negative_prompt = card_info_container.card_info.get('negative_prompt', '')
        isReplace = card_info_container.card_info.get('isReplace', shared.opts.prompt_cards_manager_default_is_replace)
        enableCnet = card_info_container.card_info.get('enableCnet', shared.opts.prompt_cards_manager_default_cnet_enabled)
        apply_resolution = card_info_container.card_info.get('apply_resolution', shared.opts.prompt_cards_manager_default_apply_resolution)
        resolution_slider = card_info_container.card_info.get('resolution', {})
        
        DEBUG_PRINT(f"PromptCardInfoEditor.show_modal prompt_card_info: {card_info_container.card_info}")

        return (
            gr.update(visible=True), # モーダルウィンドウの visible
            gr.update(visible=True), # オーバーレイの visible
            gr.update(value=label), # ファイル名
            gr.update(value=os.path.join(extension_root_path, thumbs_folder, thumbs_name)), # サムネイル画像
            gr.update(value=description), # 説明
            gr.update(value=prompt), # プロンプト
            gr.update(value=negative_prompt), # ネガティブプロンプト
            gr.update(value=isReplace), # 置換モードフラグ
            gr.update(value=enableCnet), # CNet 有効フラグ
            gr.update(value=apply_resolution), # 解像度適用フラグ
            gr.update(value=resolution_slider.get('width', shared.opts.prompt_cards_manager_default_resolution_width)), # 解像度スライダ (width)
            gr.update(value=resolution_slider.get('height', shared.opts.prompt_cards_manager_default_resolution_height)), # 解像度スライダ (height)
            gr.update(value=image_resolution_text), # 元画像の解像度テキスト
        )

    @classmethod
    def close_modal(cls):
        """ モーダル終了処理 : 値をデフォルトに戻してからモーダルを閉じる """
        return (
            gr.update(visible=False),
            gr.update(visible=False),
            gr.update(value=""), # ファイル名
            gr.update(value=None), # サムネイル画像
            gr.update(value=""), # 説明
            gr.update(value=""), # プロンプト
            gr.update(value=""), # ネガティブプロンプト
            gr.update(value=shared.opts.prompt_cards_manager_default_is_replace), # 置換モードフラグ
            gr.update(value=shared.opts.prompt_cards_manager_default_cnet_enabled), # CNet 有効フラグ
            gr.update(value=shared.opts.prompt_cards_manager_default_apply_resolution), # 解像度適用フラグ
            gr.update(value=shared.opts.prompt_cards_manager_default_resolution_width), # 解像度スライダ (width)
            gr.update(value=shared.opts.prompt_cards_manager_default_resolution_height), # 解像度スライダ (height)
            gr.update(value=""), # 元画像の解像度のテキスト表示
        )
    
    @classmethod
    def save_and_close(cls, filename_input, prompt, negative_prompt, description, isReplace, enableCnet, apply_resolution, resolution_width, resolution_height):
        """ 保存 & 閉じる """
        try:
            thumbs_name = filename_input.split("$")[0]
            card_info = {
                'description': description,
                'prompt': prompt,
                'negative_prompt': negative_prompt,
                'isReplace': isReplace,
                'enableCnet': enableCnet,
                'apply_resolution': apply_resolution,
                'resolution': {
                    'width': resolution_width,
                    'height': resolution_height
                }
            }
            card_info_container = cls.card_info_manager.get_card_info(thumbs_name)
            card_info_container.update_card_info(card_info)
            card_info_container.save_card_info_to_file()
            
        except Exception as e:
            print(f"Error saving prompt card info: {e}", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)
    
        return cls.close_modal()

    @classmethod
    def update_prompt_from_image(cls, original_prompt, filename_input, is_negative=False):
        ''' 画像の png_info からプロンプトを取得して、空でなければ置き換える '''
        thumbs_name = filename_input.split("$")[0]
        prompt = cls.get_prompt_from_image(thumbs_name, is_negative)
        DEBUG_PRINT(f"PromptCardInfoEditor.update_prompt_from_image : {prompt}")
        if len(prompt) > 0:
            return prompt
        return original_prompt


    @classmethod
    def get_prompt_from_image(cls, thumbs_name, is_negative=False):
        ''' 画像の png_info からプロンプトを取得 '''
        img_path = cls.card_info_manager.get_card_info(thumbs_name).image_path
        if not os.path.exists(img_path):
            print(f"PromptCardInfoEditor.get_prompt_from_image Image file not found: thumbs_name = {thumbs_name}, img_path = {img_path}", file=sys.stderr)
            return ""
        
        try:
            with Image.open(img_path) as img:
                geninfo, _ = read_info_from_image(img)
                if geninfo is None:
                   DEBUG_PRINT(f"PromptCardInfoEditor.get_prompt_from_image No prompt found in image: {img_path}")
                   return ""
                
                parsed_geninfo = parse_generation_parameters(geninfo)
                DEBUG_PRINT(f"PromptCardInfoEditor.get_prompt_from_image parsed_geninfo: {parsed_geninfo}")

                if is_negative:
                    return parsed_geninfo.get('Negative prompt', '')
                else:
                    return parsed_geninfo.get('Prompt', '')

        except Exception as e:
            print(f"Error getting prompt from image: {e}", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)
            return ""


    @classmethod
    def on_after_component(cls, component, **kwargs):
        """ UIをGradioに追加 """
        if kwargs.get('elem_id') == 'footer':
            return cls.create_ui() # フッタの前にUIを追加

# コンポーネントを登録
script_callbacks.on_after_component(PromptCardInfoEditorUi.on_after_component)
