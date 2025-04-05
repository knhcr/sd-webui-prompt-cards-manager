class PcmMaskEditor{
    static SELECTORS = {
        BRUSH_SLIDER : "#pcm_mask_editor_blush_slider",
        MASK_CANVAS : "#pcm_mask_editor_canvas",
        IMAGE_INFO : "#pcm_mask_editor_canvas_current_image_info",
        GEN_MASK_BUTTON : "#pcm_mask_editor_gen_mask",
        INVERT_MASK_BUTTON : "#pcm_mask_editor_invert_mask",
        INVERT_MASK_BUTTON_HIDDEN : "#pcm_mask_editor_invert_mask_hidden_button"
    }

    static  BRUSH_SETTINGS = {
        MIN: 0.5, // %
        MAX: 60, // %
        SIZE: 30, // %
    };

    constructor(){}
    
    setBrushSize(value){
        const slider = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} input[aria-label='Brush radius']`);
        if (slider) {
            slider.value = value;
            slider.dispatchEvent(new Event("change"));
        }
    };

    initialize(){
        // brush size slider のイベントハンドラ登録
        pcmWaitForContent(PcmMaskEditor.SELECTORS.BRUSH_SLIDER, ()=>{
            const blushSlider = gradioApp().querySelector(PcmMaskEditor.SELECTORS.BRUSH_SLIDER);
            blushSlider.addEventListener("change", (e)=>{
                this.setBrushSize(e.target.value);
            });
            blushSlider.addEventListener("input", (e)=>{
                this.setBrushSize(e.target.value);
            });            
        });

        // canvas への drop event, 空の Canvas の click event 無効化
        pcmWaitForContent(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} .image-container > .center`, function() {
            const dropArea = document.querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} .image-container > .center`);
            // 画像がセットされていない場合はクリック無効 (capture phase でイベントを止める)
            dropArea.addEventListener('click', function(e) {
                if (!gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} .image-container > .center canvas`)) { 
                    PCM_DEBUG_PRINT("click event disabled");
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return false;
                }
            }, true);

            // Drop は常に無効
            dropArea.addEventListener('drop', function(e) { 
                PCM_DEBUG_PRINT("drop event disabled");
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }, true);

            // 画像がセットされている場合は MouseUp でペイント結果をアップデート
            dropArea.addEventListener('mouseup', function(e) {
                if (gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} .image-container > .center canvas`)) { 
                    PCM_DEBUG_PRINT("mouseup event");
                    // Save ボタンをクリック
                    const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.GEN_MASK_BUTTON}`);
                    if (btn) btn.click();
                }
            });
        });

    }

    static async undoBrush(){
        const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} button[aria-label='Undo']`);
        if (!btn) return;
        btn.click();
        await pcmSleepAsync(75);
        const genMaskBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.GEN_MASK_BUTTON}`);
        if (genMaskBtn) genMaskBtn.click();
    }

    static async cleanBrush(){
        const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} button[aria-label='Clear']`);
        if (!btn) return;
        btn.click();
        await pcmSleepAsync(75);
        const genMaskBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.GEN_MASK_BUTTON}`);
        if (genMaskBtn) genMaskBtn.click();
    }

    static invertMask(){
        const invertBtnHidden = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.INVERT_MASK_BUTTON_HIDDEN}`);
        if (!invertBtnHidden) return;
        // gr.State の値を反転
        invertBtnHidden.click(); 
        // ボタンの表示を反転
        const invertBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.INVERT_MASK_BUTTON}`);
        invertBtn.classList.toggle("active", !invertBtn.classList.contains("active"));
    }

    /** 画像をセット */
    static async setImage(){
        let btn = null;
        pcmSleepAsync(100);
    
        // brush size スライダーが開いていなければ開く
        btn = await pcmQuerySelectorAsync(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} button[aria-label='Use brush']`);
        let slider = null;
        if (btn){
            const TIMEOUT = 1500;
            let time = 0;
            let slider_opened = false;
            while (true){
                slider = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} input[aria-label='Brush radius']`);
                if (slider){
                    slider_opened = true;
                    break;
                }
                btn.click();
                await pcmSleepAsync(100);
                time += 100;
                if (time >= TIMEOUT) break;
            }
            if (!slider_opened){
                console.error("pcmImageSetInitialize: brush size slider not opened");
                return;
            }
        }else{
            console.error("pcmImageSetInitialize: brush size slider not found");
            return;
        }
    
        // キャンバスサイズ変更直後は画像が表示されない場合があるため、Undo ボタンをクリックして再表示を促す
        btn = await pcmQuerySelectorAsync(`${PcmMaskEditor.SELECTORS.MASK_CANVAS} button[aria-label='Undo']`);
        if (btn){
            await pcmSleepAsync(350); // 待機必須
            btn.click();
            PCM_DEBUG_PRINT("Undo button clicked");
        }
    
        // 元の画像のサイズを取得
        const currentImageInfo = JSON.parse(
            gradioApp().querySelector(PcmMaskEditor.SELECTORS.IMAGE_INFO + " textarea").value);
        PCM_DEBUG_PRINT("currentImageInfo", currentImageInfo);
    
        // ブラシサイズの設定 : 画像の短辺に対して min 0.5%, max 60%, size 35%
        const shorter = Math.min(currentImageInfo.width, currentImageInfo.height);
        const min = PcmMaskEditor.BRUSH_SETTINGS.MIN * shorter / 100;
        const max = PcmMaskEditor.BRUSH_SETTINGS.MAX * shorter / 100;
        const size = PcmMaskEditor.BRUSH_SETTINGS.SIZE * shorter / 100;
        PCM_DEBUG_PRINT("min", min, "max", max, "size", size);
        slider.setAttribute("min", min);
        slider.setAttribute("max", max);
        slider.value = size;
        slider.dispatchEvent(new Event("change"), {bubbles: true});
    }
    
}

(new PcmMaskEditor()).initialize();
