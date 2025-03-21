import os
import gradio as gr
from urllib.parse import unquote
from modules import script_callbacks
from modules import shared
from scripts.pcm.constants import DEBUG_PRINT
from string import Template


class MiniGallery:
    mini_gallery = None

    _js_pipelines = {
        # Width Slider : Mini Gallery -> Default Gallery
        "width_slider": Template("""
            function(...args){
                const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
                pcmUpdateDefaultGallerySliderWidth(inputs[0]);
                return inputs;
            }
        """),

        # Height Slider : Mini Gallery -> Default Gallery
        "height_slider": Template("""
            function(...args){
                const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
                pcmUpdateDefaultGallerySliderHeight(inputs[0]);
                return inputs;
            }
        """),

        # CNet Enabled : Mini Gallery -> CNet Unit 0 
        "cnet_enabled": Template("""
            async function(...args){
                const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
                await pcmUpdateDefaultGalleryCNetEnabled(inputs[0]);
                return inputs;
            }
        """),

        # CNet Weight : Mini Gallery -> CNet Unit 0
        "cnet_weight": Template("""
            async function(...args){
                const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
                await pcmUpdateDefaultGalleryCNetWeight(inputs[0]);
                return inputs;
            }
        """),

        # CNet End Step : Mini Gallery -> CNet Unit 0
        "cnet_end_step": Template("""
            async function(...args){
                const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
                await pcmUpdateDefaultGalleryCNetEndStep(inputs[0]);
                return inputs;
            }
        """),
    }

    @classmethod
    def __init__(cls):
        pass

    @classmethod
    def create_mini_gallery(cls):
        with gr.Column(elem_id="pcm_mini_gallery_column", scale=1):
            cls.mini_gallery = gr.Gallery(
                value=[], elem_id="pcm_mini_gallery", elem_classes="gradio-gallery",
                height = 175, width = 170,
                select_types=["index"],
                interactive=False, show_label=False, show_share_button=False
            )

            with gr.Group(elem_id="pcm_mini_gallery_resolution_group"):
                with gr.Row():
                    cls.width_slider = gr.Slider(label="t2i Width", elem_id="pcm_mini_gallery_width",
                                                 interactive=True,
                                                 value=512, minimum=64, maximum=2048, step=8)
                    cls.height_slider = gr.Slider(label="t2i Height", elem_id="pcm_mini_gallery_height",
                                                  interactive=True,
                                                  value=512, minimum=64, maximum=2048, step=8)
                    
            with gr.Group(elem_id="pcm_mini_gallery_cnet_group"):
                cls.cnet_enabled = gr.Checkbox(label="CNet Unit 0 Enabled (t2i)", elem_id="pcm_mini_gallery_cnet_enabled",
                                               value=False, interactive=True)
                with gr.Row(variant="compact", equal_height=True, elem_classes="flex-row"):
                    cls.cnet_weight = gr.Slider(scale=1, label="Weight", elem_id="pcm_mini_gallery_cnet_weight",
                                                interactive=True,
                                                value=1.0, minimum=0.0, maximum=2.0, step=0.05)
                    cls.cnet_end_step = gr.Slider(scale=1, label="Step End", elem_id="pcm_mini_gallery_cnet_end_step",
                                                  interactive=True,
                                                  value=1.0,
                                                  minimum=0.0, maximum=1.0, step=0.01)

            # JS 側からの発火用
            cls.hidden_txt_image = gr.Textbox("", visible=False, elem_id="pcm_mini_gallery_hidden_txt_image") # 画像表示用

        # Gallery の画像更新
        cls.hidden_txt_image.input(
            fn=cls.on_hidden_txt_change,
            inputs=[cls.hidden_txt_image],
            outputs=[cls.mini_gallery]
        )

        # Generation タブのスライダー更新 width
        width_slider_inputs = [cls.width_slider,]
        cls.width_slider.change(
            fn=lambda x: x,
            inputs = width_slider_inputs,
            outputs = [],
            _js = cls._js_pipelines['width_slider'].substitute(num_inputs=len(width_slider_inputs)),
        )
        cls.width_slider.release( # change だけだと最終的な値を取り逃すため release も必要
            fn=lambda x: x,
            inputs = width_slider_inputs,
            outputs = [],
            _js = cls._js_pipelines['width_slider'].substitute(num_inputs=len(width_slider_inputs)),
        )        

        # Generation タブのスライダー更新 height
        height_slider_inputs = [cls.height_slider,]
        cls.height_slider.change(
            fn=lambda x: x,
            inputs = height_slider_inputs,
            outputs = [],
            _js = cls._js_pipelines['height_slider'].substitute(num_inputs=len(width_slider_inputs)),
        )
        cls.height_slider.release( # change だけだと最終的な値を取り逃すため release も必要
            fn=lambda x: x,
            inputs = height_slider_inputs,
            outputs = [],
            _js = cls._js_pipelines['height_slider'].substitute(num_inputs=len(width_slider_inputs)),
        )

        # Generation タブの CNet Unit 0 の cnet_enabled 更新
        cnet_enabled_inputs = [cls.cnet_enabled]
        cls.cnet_enabled.change(
            fn=lambda x: x,
            inputs = cnet_enabled_inputs,
            outputs = [],
            _js = cls._js_pipelines['cnet_enabled'].substitute(num_inputs=len(cnet_enabled_inputs)),
        )

        # Generation タブの CNet Unit 0 の cnet_weight 更新 (release のみ)
        cnet_weight_inputs = [cls.cnet_weight]
        cls.cnet_weight.release(
            fn=lambda x: x,
            inputs = cnet_weight_inputs,
            outputs = [],
            _js = cls._js_pipelines['cnet_weight'].substitute(num_inputs=len(cnet_weight_inputs)),
        )

        # Generation タブの CNet Unit 0 の cnet_end_step 更新 (release のみ)
        cnet_end_step_inputs = [cls.cnet_end_step]
        cls.cnet_end_step.release(
            fn=lambda x: x,
            inputs = cnet_end_step_inputs,
            outputs = [],
            _js = cls._js_pipelines['cnet_end_step'].substitute(num_inputs=len(cnet_end_step_inputs)),
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
