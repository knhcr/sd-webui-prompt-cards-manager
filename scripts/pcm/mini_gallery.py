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
    }

    @classmethod
    def __init__(cls):
        pass

    @classmethod
    def create_mini_gallery(cls):
        with gr.Group():
            with gr.Column(elem_id="pcm_mini_gallery_column"):
                cls.mini_gallery = gr.Gallery(
                    value=[], elem_id="pcm_mini_gallery", elem_classes="gradio-gallery",
                    height = 175, width = 170,
                    select_types=["index"],
                    interactive=False, show_label=False, show_share_button=False
                )
                cls.width_slider = gr.Slider(label="t2i Width", elem_id="pcm_mini_gallery_width", value=512, minimum=64, maximum=2048, step=8, interactive=True)
                cls.height_slider = gr.Slider(label="t2i Height", elem_id="pcm_mini_gallery_height", value=512, minimum=64, maximum=2048, step=8, interactive=True)
                cls.cnet_enabled = gr.Checkbox(label="t2i CNet-unit0 Enabled", elem_id="pcm_mini_gallery_cnet_enabled", value=False, interactive=True)

                # JS 側からの発火用
                cls.hidden_txt_image = gr.Textbox("", visible=False, elem_id="pcm_mini_gallery_hidden_txt_image") # 画像表示用
                cls.hidden_txt_control = gr.Textbox("", visible=False, elem_id="pcm_mini_gallery_hidden_txt_control") # スライダとCNET用

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

        # Generation タブの設定値変更イベントの通知を受け取り、ミニギャラリーの値を更新
        control_values_update_inputs = [cls.hidden_txt_control, cls.width_slider, cls.height_slider, cls.cnet_enabled]
        control_values_update_outputs = [cls.width_slider, cls.height_slider, cls.cnet_enabled]
        cls.hidden_txt_control.input(
            fn=cls.update_control_values,
            inputs = control_values_update_inputs,
            outputs = control_values_update_outputs,
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
    
    @classmethod
    def update_control_values(cls,txt, width, height, cnet_enabled):
        ''' Generation タブの設定値変更イベントの通知を受け取り、ミニギャラリーの値を更新
        txt : type=value$timestamp, typeは 'width' 'height' 'cnet_enabled' のいずれか
        '''
        ret = [gr.update(), gr.update(), gr.update()] # None を返すと最小値になるため明示的に変更なしを伝える
        if len(txt) > 0:
            txt = txt.split("$")[0]
            if len(txt) > 0:
                type, value = txt.split("=")[0], txt.split("=")[1]
                if type == "width":
                    ret[0] = gr.update(value=int(value))

                elif type == "height":
                    ret[1] = gr.update(value=int(value))

                elif type == "cnet_enabled":
                    if value.lower() == "True":
                        ret[2] = gr.update(value=True)
                    else:
                        ret[2] = gr.update(value=False)
        return ret



# create mini gallery
script_callbacks.on_after_component(MiniGallery.on_after_component)
