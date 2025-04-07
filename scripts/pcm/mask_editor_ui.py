
from string import Template
import json
import numpy as np
import gradio as gr
from PIL import Image
from scripts.pcm.constants import endpoint_base
from scripts.pcm.constants import DEBUG_PRINT
from modules import script_callbacks


class CnetMaskEditor:
    _canvas_width = 1512
    _cnavas_height_max = 1256

    _icons={
        "undo"       : f"{endpoint_base}/resources/reset-svgrepo-com.svg",
        "undo_hover" : f"{endpoint_base}/resources/reset-blue-svgrepo-com.svg",
        "clean"      : f"{endpoint_base}/resources/eraser-bold-svgrepo-com.svg",
        "clean_hover": f"{endpoint_base}/resources/eraser-bold-blue-svgrepo-com.svg",
        "flip"       : f"{endpoint_base}/resources/flip-color-svgrepo-com.svg",
        "flip_hover" : f"{endpoint_base}/resources/flip-color-blue-svgrepo-com.svg",
    }
    
    _js_pipelines ={
        # 画像変更時にコントロールの表示を変更
        "pcmCnetMaskEditor" : Template('''async function(...args){
            const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
            await PcmMaskEditor.setImage();
            return inputs;
        }'''),

        # マスクを適用してからエディタを閉じる
        "pcmCnetMaskApply" : Template('''async function(...args){
            const inputs = args.slice(0, ${num_inputs}); // inputs の value のみ切り出し
            await PcmMaskEditor.applyMask();
            return inputs;
        }'''),
    }


    def create_ui(self):
        self.create_modal()


    def create_modal(self):
        ''' wrap editor as modal '''
        with gr.Group(elem_id="pcm_mask_editor"):
            overlay_html = '<div id="{elem_id}" class="pcm-overlay""></div>'
            self.overlay = gr.HTML(overlay_html.format(elem_id="pcm_mask_editor_overlay"), visible=False)

            with gr.Box(visible=False, elem_id="pcm_mask_editor_container", elem_classes="pcm-mask-editor-container") as self.editor_container:
                self.create_editor()


    def create_editor(self):
        gr.HTML("<h1>ControlNet Mask Editor</h1>")

        with gr.Column():
            with gr.Row(elem_id="pcm_mask_editor_control_belt"):
                with gr.Column(scale=11, elem_id="pcm_mask_editor_control_belt_slider"):
                    self.brush_slider = gr.Slider(
                        elem_id="pcm_mask_editor_blush_slider", label="Brush Size", interactive=True,
                        minimum=10, maximum=1000, value=300)
                with gr.Column(scale=1):
                    with gr.Row(elem_id="pcm_mask_editor_control_belt_buttons"):
                        gr.HTML(f'''<div id="pcm_mask_editor_undo" class="pcm-mask-editor-button-container"
                                title="Undo" onclick="PcmMaskEditor.undoBrush()">
                                <img class="pcm-mask-editor-button default" src="{CnetMaskEditor._icons["undo"]}" alt="undo">
                                <img class="pcm-mask-editor-button hover" src="{CnetMaskEditor._icons["undo_hover"]}" alt="undo_hover">
                                </div>''')
                        gr.HTML(f'''<div id="pcm_mask_editor_erase" class="pcm-mask-editor-button-container"
                                title="Clear" onclick="PcmMaskEditor.cleanBrush()">
                                <img class="pcm-mask-editor-button default" src="{CnetMaskEditor._icons["clean"]}" alt="clean">
                                <img class="pcm-mask-editor-button hover" src="{CnetMaskEditor._icons["clean_hover"]}" alt="clean_hover">
                                </div>''')
                        gr.HTML(f'''<div id="pcm_mask_editor_invert_mask" class="pcm-mask-editor-button-container"
                                title="Invert White/Black\n(CNet uses the white area)" onclick="PcmMaskEditor.invertMask()">
                                <img class="pcm-mask-editor-button off" src="{CnetMaskEditor._icons["flip"]}" alt="flip">
                                <img class="pcm-mask-editor-button on" src="{CnetMaskEditor._icons["flip_hover"]}" alt="flip_hover">
                                </div>''')

            with gr.Row():
                with gr.Column():
                    self.mask_canvas = gr.Image(
                        elem_id="pcm_mask_editor_canvas", tool="sketch",
                        show_label=False,height=1024, width=CnetMaskEditor._canvas_width,
                        show_download_button=False, show_share_button=False,)
        
            with gr.Row():
                with gr.Column():
                    with gr.Row(elem_id="pcm_mask_editor_footer_buttons"):
                        self.cancel = gr.Button(
                            value="Cancel", elem_id="pcm_mask_editor_cancel",
                        )
                        self.apply = gr.Button(
                            value="Apply Mask", elem_id="pcm_mask_editor_apply", variant="primary",
                        )
                with gr.Column():
                    with gr.Row():
                        self.mask_result = gr.Image(
                            label="Output Mask", elem_id="pcm_mask_editor_result",
                            interactive=False,
                            height=192, width=192)

            # コントロール用隠しコンポーネント
            self.hidden_text = gr.Textbox(elem_id="pcm_mask_editor_canvas_current_image_info", value = "", visible=False,)
            self.gen_mask_btn = gr.Button(elem_id="pcm_mask_editor_gen_mask", value="Generate Mask", visible=False,)
            self.invert_mask_btn = gr.Button(elem_id="pcm_mask_editor_invert_mask_hidden_button", value="Invert Mask", visible=False,)
            self.isInverted = gr.State(True)
            self.open_mask_editor_txt_hidden = gr.Textbox(elem_id="pcm_mask_editor_open_hidden_txt", value = "", visible=False,)
            self.clear_mask_result_btn_hidden = gr.Button(elem_id="pcm_mask_editor_clear_mask_result_hidden_button", value="Clear Mask Result", visible=False,)

            # 画像 Input 用隠しコンポーネント
            self.input_image = gr.Image(label="Input Image", elem_id="pcm_mask_editor_input_image", height=64, width=128, visible=False)

        # マスクエディタをオープン
        self.open_mask_editor_txt_hidden.input(
            fn=self.open_mask_editor,
            inputs = [self.open_mask_editor_txt_hidden],
            outputs = [self.editor_container, self.overlay]
        )

        # Cancel ボタン
        cancel__inputs = []
        cancel__outputs = [
            self.editor_container, # マスクエディタ
            self.overlay, # オーバーレイ
            self.input_image, # 画像 Input
            self.mask_canvas, # マスクキャンバス
            self.mask_result, # 出力マスク画像
        ]
        self.cancel.click(
            fn= self.close_mask_editor,
            inputs=cancel__inputs,
            outputs=cancel__outputs
        )

        # Apply ボタン : マスク投入は JS に任せて閉じるだけ (マスクキャンバスのクリアを行わない点が cancel との違い)
        apply__inputs = [self.mask_result]
        apply__outputs = [
            self.editor_container, # マスクエディタ
            self.overlay, # オーバーレイ
            self.input_image, # 画像 Input
            self.mask_canvas, # マスクキャンバス
            self.mask_result, # 出力マスク画像
        ]
        self.apply.click(
            fn= self.apply_mask_editor,
            inputs=apply__inputs,
            outputs=apply__outputs,
            _js = CnetMaskEditor._js_pipelines["pcmCnetMaskApply"].substitute(num_inputs=len(apply__inputs)),
        )

        # Clear Mask Result ボタン
        clear_mask_result_btn_hidden__inputs = []
        clear_mask_result_btn_hidden__outputs = [
            self.mask_result, # 出力マスク画像
        ]
        self.clear_mask_result_btn_hidden.click(
            fn=self.clear_mask_result,
            inputs=clear_mask_result_btn_hidden__inputs,
            outputs=clear_mask_result_btn_hidden__outputs)

        # 出力用マスク画像を生成
        gen_mask__inputs = [self.mask_canvas, self.isInverted]
        gen_mask__outputs = [self.mask_result]
        self.gen_mask_btn.click(fn=self.gen_mask, inputs=gen_mask__inputs, outputs=gen_mask__outputs)
    
        # 画像をセット
        input_image__inputs = [self.input_image]
        input_image__outputs = [self.mask_canvas, self.brush_slider, self.hidden_text]
        self.input_image.change(
            fn=self.set_image, # キャンバスサイズを変更
            inputs=input_image__inputs,
            outputs=input_image__outputs,
        ).then( 
            fn=None, # 画像セット終了後にJS実行
            _js = CnetMaskEditor._js_pipelines["pcmCnetMaskEditor"].substitute(num_inputs=len([])),
        )

        # マスクを白黒反転
        invert_mask__inputs = [self.isInverted, self.mask_result]
        invert_mask__outputs = [self.isInverted, self.mask_result]
        self.invert_mask_btn.click(
            fn=self.invert_mask,
            inputs=invert_mask__inputs,
            outputs=invert_mask__outputs)
        
    
    def open_mask_editor(self, value):
        ''' マスクエディタをオープン, 画像は js の drop イベントで別途セット済み '''
        value = value.split("$")[0]
        return gr.update(visible=True), gr.update(visible=True)
    
    def close_mask_editor(self):
        ''' マスクエディタをクローズ '''
        return (
            gr.update(visible=False), # マスクエディタ
            gr.update(visible=False), # オーバーレイ
            None, # 画像 Input
            None, # マスクキャンバス
            None, # 出力マスク画像
        )
    
    def apply_mask_editor(self, mask_result:np.ndarray):
        ''' マスクを適用してエディタクローズ '''
        return (
            gr.update(visible=False), # マスクエディタ
            gr.update(visible=False), # オーバーレイ
            None, # 画像 Input
            None, # マスクキャンバス
            gr.update(), # 出力マスク画像は残しておく
        )
    
    def clear_mask_result(self):
        ''' 出力マスク画像をクリア '''
        return gr.update(value=None)


    def gen_mask(self, images, isInverted):
        # value : {
        #    "image": np.ndarray, # 背景画像
        #    "mask": np.ndarray   # 描いたもの, shape=(height, width, 3), 0-255
        # }
        
        if 'mask' not in images:
            DEBUG_PRINT('CnetMaskEditor.gen_mask mask data not found')
            return None
        mask = images['mask']
        if mask is None:
            return None
        if isInverted:
            mask = 255 - mask
        mask_img = Image.fromarray(mask)
        return mask_img.convert("RGB")
    
   
    def set_image(self, value:np.ndarray):
        ''' 画像の変更 '''
        # canvas : サイズ固定で画像が高さにフィットする
        # 画像が横にはみ出さないよう、canvas の縦幅を変更する
        if value is None:
            return gr.update(), gr.update(), gr.update()
        DEBUG_PRINT(f"CnetMaskEditor.set_image value.shape: {value.shape}")
        [h_img, w_img] = value.shape[:2]
        height = int(h_img * CnetMaskEditor._canvas_width / w_img)
        if height > CnetMaskEditor._cnavas_height_max:
            height = CnetMaskEditor._cnavas_height_max

        # 元の画像のサイズを元にブラシスライダーの設定を変更
        BRUSH_SETTINGS = { "MIN": 0.5, "MAX": 60}
        shorter = min(h_img, w_img)
        _min = BRUSH_SETTINGS["MIN"] * shorter / 100
        _max = BRUSH_SETTINGS["MAX"] * shorter / 100

        # 元の画像のサイズを js パイプラインに引き渡す為に隠しテキストエリアに格納
        currentImageInfo = { "height": h_img, "width": w_img}

        return (
            gr.update(value=value, height=height), # canvas size
            gr.update(minimum=_min, maximum=_max), # brush slider 
            gr.update(value=json.dumps(currentImageInfo)) # hidden text
        )

    def invert_mask(self, isInverted, mask_result):
        if mask_result is None:
            return not isInverted, None
        mask_result = 255 - mask_result
        return not isInverted, mask_result


    @classmethod
    def on_after_component(cls, component, **kwargs):
        if kwargs.get('elem_id') == 'footer':
            return CnetMaskEditor().create_ui()


# コンポーネントを作成
script_callbacks.on_after_component(CnetMaskEditor.on_after_component)



