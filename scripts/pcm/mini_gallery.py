import os
import gradio as gr
from urllib.parse import unquote
from modules import script_callbacks
from scripts.pcm.constants import DEBUG_PRINT


class MiniGallery:
    mini_gallery = None

    @classmethod
    def __init__(cls):
        pass

    @classmethod
    def create_mini_gallery(cls):
        with gr.Group():
            with gr.Column():
                cls.mini_gallery = gr.Gallery(
                    value=[], elem_id="pcm_mini_gallery", elem_classes="gradio-gallery",
                    height = 180, width = 200,
                    select_types=["index"],
                    interactive=False, show_label=False, show_share_button=False
                    )
                # JS 側で画像生成完了時に画像を表示するためにchangeイベントを発火させる
                cls.hidden_txt = gr.Textbox("", visible=False, elem_id="pcm_mini_gallery_hidden_txt")

        cls.hidden_txt.input(
            fn=cls.on_hidden_txt_change,
            inputs=[cls.hidden_txt],
            outputs=[cls.mini_gallery]
        )

    @classmethod
    def on_after_component(cls, component, **kwargs):
        if kwargs.get("elem_id") == "txt2img_prompt_container":
            cls.create_mini_gallery()


    @classmethod
    def on_hidden_txt_change(cls, image_path: str):
        # image_path は "<html escaspse された画像物理フルパス>?123456789.1234567" (?以降はタイムスタンプ)
        # 複数ある場合は '$' セパレートで纏めて渡される
        DEBUG_PRINT(f"MiniGallery.on_hidden_txt_change: {image_path}")
        image_paths = map(lambda x : x.split("?")[0], unquote(image_path).split("$"))
        image_paths = filter(lambda x : os.path.exists(x), image_paths)
        DEBUG_PRINT(f"MiniGallery.on_hidden_txt_change image_paths: {image_paths}")
        return gr.update(value=image_paths, preview=True) # preview=True で選択モードで表示される


# create mini gallery
script_callbacks.on_after_component(MiniGallery.on_after_component)
