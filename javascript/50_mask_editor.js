class PcmMaskEditor{
    static SELECTORS = {
        MASK_EDITOR_OPEN_HIDDEN_TXT : "#pcm_mask_editor_open_hidden_txt textarea",
        CNET_UNIT_IMAGE_CONTAINER : "#txt2img_controlnet_ControlNet-0_input_image img.absolute-img",
        CNET_UNIT_MASK_CONTAINER : "#txt2img_controlnet_ControlNet-0_mask_image img.absolute-img",
        MASK_EDITOR_IMAGE_INPUT : "#pcm_mask_editor_input_image",
        MASK_EDITOR_RESULT_CONTAINER : "#pcm_mask_editor_result > img",
        MASK_EDITOR_CLEAR_MASK_RESULT_BUTTON : "#pcm_mask_editor_clear_mask_result_hidden_button",
        
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
                PCM_DEBUG_PRINT("pcmImageSetInitialize: brush size slider not opened");
                return;
            }
        }else{
            PCM_DEBUG_PRINT("pcmImageSetInitialize: brush size slider not found");
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
    
    /** マスクエディタを開く
     * CNET の画像を mask editor にセットし、隠しテキストに値を入れてディスパッチ */
    static async openMaskEditor(){
        // CNET の画像は img.absolute-img の src 属性に dataURI として入っている
        const cnetUnitImageContainer = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_IMAGE_CONTAINER);
        if (!cnetUnitImageContainer) return;
        const imageDataUri = cnetUnitImageContainer.src; // dataURI (data:image/png;base64,...)
        if (!imageDataUri) return;
        const dataTransfer = await PcmMaskEditor.#createDataTransferAsync(imageDataUri);

        // 画像ドロップイベントをエミュレート
        const dropArea = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_IMAGE_INPUT} .image-container > div`);
        if(!dropArea) return;
        const dragEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        dropArea.dispatchEvent(dragEvent);

        // 隠しテキストに値を入れてモーダルオープン
        const hiddenTxt = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_OPEN_HIDDEN_TXT);
        if (!hiddenTxt) return;
        const value = "1" + "$" + Date.now();
        hiddenTxt.value = value;
        hiddenTxt.dispatchEvent(new Event("input"), {bubbles: true});
        PCM_DEBUG_PRINT(`PcmMaskEditor.openMaskEditor value: ${value}`);
    }

    /** マスクを投入してからエディタのmask resultをクリア */
    static async applyMask(){
        PCM_DEBUG_PRINT("PcmMaskEditor.applyMask");
        const maskResult = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_RESULT_CONTAINER);
        if (!maskResult) return; // マスクが生成されていない場合は存在しない
        const maskDataUri = maskResult.src;
        if (!maskDataUri) return;

        // DataTransfer を作成 (wait は後で)
        const pDataTransfer = PcmMaskEditor.#createDataTransferAsync(maskDataUri);

        // Use Mask にチェックが入っていなければチェック
        selectorTmp = `#txt2img_controlnet_ControlNet-0_controlnet_mask_upload_checkbox input[type='checkbox']`
        if(!(elemTmp = pcmGetElement(selectorTmp))){
            console.error(`Prompt Cards Manager Error. txt2img ControlNet Unit 0 Use Mask Checkbox not found`);
            return;
        }
        statusTmp = pcmGetGradioComponentByElemId(`txt2img_controlnet_ControlNet-0_controlnet_mask_upload_checkbox`)
        if(statusTmp){
            PCM_DEBUG_PRINT(`PcmMaskEditor.applyMask Use Mask Checkbox : ${statusTmp.props.value}`);
            if(!statusTmp.props.value){
                elemTmp.click();
            }
        }

        // CNet Module の Mask container が現れるまで待機
        const [dt, elem] = await Promise.all([pDataTransfer, pcmQuerySelectorAsync(PcmMaskEditor.SELECTORS.CNET_UNIT_MASK_CONTAINER)]);
        if(!elem){
            PCM_DEBUG_PRINT("PcmMaskEditor.applyMask CNet Module Mask container not found");
            return;
        }

        // 画像ドロップイベントをエミュレート
        const dragEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
        });
        elem.dispatchEvent(dragEvent);

        // マスクエディタの mask result をクリア
        const clearMaskResultBtn = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_CLEAR_MASK_RESULT_BUTTON);
        if (clearMaskResultBtn) clearMaskResultBtn.click();
    }

    /** Data URI から DataTransfer オブジェクトを作成する */
    static async #createDataTransferAsync(dataUri){
        const mimeType = dataUri.split(';')[0].split(':')[1];
        const base64Data = dataUri.split(',')[1];
        const binaryData = atob(base64Data);
        const arrayBuffer = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            arrayBuffer[i] = binaryData.charCodeAt(i);
        }
        // blob から File を作成して DataTransfer にセット
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const file = new File([blob], "image.png", { type: mimeType });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        dataTransfer.effectAllowed = "all";
        return dataTransfer;
    }
}

(new PcmMaskEditor()).initialize();
