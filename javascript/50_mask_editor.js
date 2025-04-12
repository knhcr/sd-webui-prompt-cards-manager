class PcmMaskEditor{
    static SELECTORS = {
        CNET_UNIT_IMAGE_CONTAINER :                   "#txt2img_controlnet_ControlNet-0_input_image img.absolute-img",
        CNET_UNIT_IMAGE_DROP_TARGET :                 "#txt2img_controlnet_ControlNet-0_input_image .center",
        CNET_UNIT_USE_MASK_CHECKBOX :                 "#txt2img_controlnet_ControlNet-0_controlnet_mask_upload_checkbox input[type='checkbox']",
        CNET_UNIT_MASK_DROP_TARGET :                  "#txt2img_controlnet_ControlNet-0_mask_image .center",
        CNET_UNIT_MASK_UNDO_BUTTON :                  "#txt2img_controlnet_ControlNet-0_mask_image button[aria-label='Undo']",
        CNET_UNIT_MASK_CONTAINER :                    "#txt2img_controlnet_ControlNet-0_mask_image img.absolute-img",

        TAB_BUTTONS :                                 "#tab_txt2img .tab-nav button", // 選択中のタブ : selected class が付く
       
        MASK_EDITOR_OPEN_TXT_HIDDEN :                 "#pcm_mask_editor_open_hidden_txt textarea", // Modal Open トリガー
        MASK_EDITOR_IMAGE_INPUT_HIDDEN :              "#pcm_mask_editor_input_image .image-container > div", // Open 時 背景画像 Drop 用隠しターゲット
        MASK_EDITOR_IMAGE_INFO_HIDDEN :               "#pcm_mask_editor_canvas_current_image_info textarea", // Open 時 背景画像サイズ取得用隠しテキスト
        MASK_EDITOR_GEN_MASK_BUTTON_HIDDEN :          "#pcm_mask_editor_gen_mask", // マスク描画イベント時 生成マスクアップデート用
        MASK_EDITOR_RESULT_CONTAINER :                "#pcm_mask_editor_result > img", // 生成マスク表示コンテナ
        MASK_EDITOR_CLEAR_MASK_RESULT_BUTTON_HIDDEN : "#pcm_mask_editor_clear_mask_result_hidden_button", // Apply 時 マスク Drop 後に生成マスクをクリアするためのコールバック起動用

        MASK_EDITOR_CANVAS_CONTAINER :                "#pcm_mask_editor_canvas",
        MASK_EDITOR_CANVAS_DROP_AREA :                "#pcm_mask_editor_canvas .image-container > .center",
        MASK_EDITOR_CANVAS_INNER :                    "#pcm_mask_editor_canvas .image-container > .center canvas",
        MASK_EDITOR_CANVAS_BRUSH_USE_BUTTON :         "#pcm_mask_editor_canvas button[aria-label='Use brush']",
        MASK_EDITOR_CANVAS_BRUSH_SLIDER :             "#pcm_mask_editor_canvas input[aria-label='Brush radius']",
        MASK_EDITOR_CANVAS_UNDO_BUTTON :              "#pcm_mask_editor_canvas button[aria-label='Undo']",
        MASK_EDITOR_CANVAS_CLEAR_BUTTON :             "#pcm_mask_editor_canvas button[aria-label='Clear']",

        MASK_EDITOR_BRUSH_SLIDER :                    "#pcm_mask_editor_blush_slider",
        MASK_EDITOR_BRUSH_SLIDER_INPUT_NUMBER :       "#pcm_mask_editor_blush_slider input[type='number']",
        MASK_EDITOR_INVERT_MASK_BUTTON :              "#pcm_mask_editor_invert_mask",
        MASK_EDITOR_INVERT_MASK_BUTTON_HIDDEN :       "#pcm_mask_editor_invert_mask_hidden_button"
    }

    static BRUSH_SETTINGS = {
        MIN: 0.5, // %
        MAX: 60, // %
        SIZE: 27, // %
    };

    /** Canvas 内の brush size slider の値を変更 */
    static async setBrushSize(value){
        //PCM_DEBUG_PRINT("PcmMaskEditor.setBrushSize", value);
        let slider = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_BRUSH_SLIDER}`);
        if (!slider){
            slider = await PcmMaskEditor.getCanvasBrushSlider();
            if (!slider){
                PCM_DEBUG_PRINT("PcmMaskEditor.setBrushSize: slider not found");
                return;
            }
        }
        slider.value = value;
        slider.dispatchEvent(new Event("change"));
    };

    /** Canvas 内の Undo ボタンをクリック (マスク生成結果にも反映) */
    static async undoMask(){
        const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_UNDO_BUTTON}`);
        if (!btn) return;
        btn.click();
        await pcmSleepAsync(75);
        const genMaskBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_GEN_MASK_BUTTON_HIDDEN}`);
        if (genMaskBtn) genMaskBtn.click();
    }

    /** Canvas 内の Clear ボタンをクリック (マスク生成結果にも反映) */
    static async clearMask(){
        const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_CLEAR_BUTTON}`);
        if (!btn) return;
        btn.click();
        await pcmSleepAsync(75);
        const genMaskBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_GEN_MASK_BUTTON_HIDDEN}`);
        if (genMaskBtn) genMaskBtn.click();
    }

    /** マスクの白黒反転 (isInvert が null の場合はトグル動作, 指定した場合はその値にセット)*/
    static invertMask(isInvert=null){
        const invertBtn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_INVERT_MASK_BUTTON}`);
        if (!invertBtn){
            PCM_DEBUG_PRINT("PcmMaskEditor.invertMask: Error. invert button not found");
            return;
        }
        const invertBtnHidden = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_INVERT_MASK_BUTTON_HIDDEN}`);
        if (!invertBtnHidden){
            PCM_DEBUG_PRINT("PcmMaskEditor.invertMask: Error. invert button hidden not found");
            return;
        }

        // HTML 上のボタン表示を反転
        if (isInvert !== null && invertBtn.classList.contains("active") === isInvert){ // 非トグル動作かつ既に指定した状態
            return;
        }
        invertBtn.classList.toggle("active", !invertBtn.classList.contains("active"));

        // gr.State の値を反転
        invertBtnHidden.click(); 
    }

    /** CNET 画像を Canvas にセットしてエディタを初期化 */
    static async setImage(){
        PCM_DEBUG_PRINT("PcmMaskEditor.setImage called.");
        
        // キャンバスサイズ変更直後は画像が表示されない場合があるため、Undo ボタンをクリックして再表示を促す
        const undoBtn = await pcmQuerySelectorAsync(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_UNDO_BUTTON}`);
        if (undoBtn){
            await pcmSleepAsync(300); // 待機必須
            undoBtn.click();
            PCM_DEBUG_PRINT("Undo button clicked");
        }else{
            // cancel, apply などのキャンバスクリア時にも gradio の change ハンドラが発火する -> 明示的にフラグで管理した方が良さそう
            PCM_DEBUG_PRINT("PcmMaskEditor.setImage: canvas not found");
            return;
        }

        // キャンバスの Brush Slider を取得
        const canvasBrushSlider = await PcmMaskEditor.getCanvasBrushSlider();
        if (!canvasBrushSlider) return;

        // 元の画像のサイズを取得
        const currentImageInfo = JSON.parse(gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_IMAGE_INFO_HIDDEN).value);
        PCM_DEBUG_PRINT("currentImageInfo", currentImageInfo);

        // エディターデフォルト設定値を取得 (opts から取得)
        const minBrushSize = opts.prompt_cards_manager_mask_editor_min_brush_size;
        const maxBrushSize = opts.prompt_cards_manager_mask_editor_max_brush_size;
        const defaultBrushSize = opts.prompt_cards_manager_default_mask_editor_brush_size;
        const defaultInvertMask = opts.prompt_cards_manager_default_mask_editor_invert_mask;
    
        // ブラシサイズの設定
        const shorter = Math.min(currentImageInfo.width, currentImageInfo.height);
        const min = minBrushSize * shorter / 100;
        const max = maxBrushSize * shorter / 100;
        const size = defaultBrushSize * max / 100;
        PCM_DEBUG_PRINT("min", min, "max", max, "size", size, "isInvert", defaultInvertMask);

        //  - Canvas 内スライダ
        canvasBrushSlider.setAttribute("min", min);
        canvasBrushSlider.setAttribute("max", max);
        PcmMaskEditor.setBrushSize(size);
        PCM_DEBUG_PRINT("PcmMaskEditor.setImage: canvas brush slider set");
        
        //  - エディタスライダ
        const editorBrushSliderInput = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_BRUSH_SLIDER_INPUT_NUMBER}`);
        if (!editorBrushSliderInput){
            PCM_DEBUG_PRINT("PcmMaskEditor.setImage: editor brush slider not found");
            return;
        }
        editorBrushSliderInput.value = size;
        editorBrushSliderInput.dispatchEvent(new Event("input"), {bubbles: true, cancelable: true}); // スライダとボックス入力の同期イベント (スライダコンテナのイベントは発火しない)
        PCM_DEBUG_PRINT("PcmMaskEditor.setImage: editor brush slider set");

        // マスクの反転設定
        if (defaultInvertMask !== null) PcmMaskEditor.invertMask(defaultInvertMask);
        PCM_DEBUG_PRINT("PcmMaskEditor.setImage: invert mask set");
    }

    /** Canvas 内の Brush Slider が開いて無ければオープンして Slider を返す */
    static async getCanvasBrushSlider(){
        let canvasBrushSlider = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_BRUSH_SLIDER}`);
        if (canvasBrushSlider) return canvasBrushSlider;

        // brush size スライダーが開いていなければ開く
        const useSliderBtn = await pcmQuerySelectorAsync(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_BRUSH_USE_BUTTON}`);
        if (!useSliderBtn){
            PCM_DEBUG_PRINT("PcmMaskEditor.setImage: brush size slider open button not found");
            return null;
        }
        useSliderBtn.click();
        await pcmSleepAsync(75);

        canvasBrushSlider = await pcmQuerySelectorAsync(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_BRUSH_SLIDER}`);
        if (!canvasBrushSlider){
            PCM_DEBUG_PRINT("PcmMaskEditor.setImage: canvas brush size slider not found");
            return null;
        }
        return canvasBrushSlider;
    }
    
    /** マスクエディタを開く
     *  - 必要なデータをセットして gradio コールバックを発火
     *  - エディタオープン後のエディタ初期化処理は gradio から setImate() をコールさせてその中でやる)
     * CNET の画像を mask editor にセットし、隠しテキストに値を入れてディスパッチ */
    static async openMaskEditor(){
        // CNET の画像は img.absolute-img の src 属性に dataURI として入っている
        const cnetUnitImageContainer = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_IMAGE_CONTAINER);
        if (!cnetUnitImageContainer) return;
        const imageDataUri = cnetUnitImageContainer.src; // dataURI (data:image/png;base64,...)
        if (!imageDataUri) return;
        const dataTransfer = await pcmCreateDataTransferAsync(imageDataUri);

        // 画像ドロップイベントをエミュレート
        const dropArea = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_IMAGE_INPUT_HIDDEN}`);
        if(!dropArea) return;
        const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        dropArea.dispatchEvent(dropEvent);

        // 隠しテキストに値を入れてモーダルオープン
        const hiddenTxt = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_OPEN_TXT_HIDDEN);
        if (!hiddenTxt) return;
        let value = "1"; // value は現状未使用なので何でもよい
        hiddenTxt.value = value + "$" + Date.now(); // Input イベントを無視させないためのノンス付きで格納
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

        // Generation タブを開いていない場合クリック
        let isTabSwitched = false;
        let tabCurrent = document.querySelector(PcmMaskEditor.SELECTORS.TAB_BUTTONS + ".selected");
        const tabCurrentText = tabCurrent ? tabCurrent.textContent : null; // 後でタブ要素を再取得するために使う
        const tabGeneration = pcmGetElementBySelectorAndText(PcmMaskEditor.SELECTORS.TAB_BUTTONS, "generation", gradioApp(), true);
        if(!tabGeneration){
            PCM_DEBUG_PRINT("PcmMaskEditor.applyMask error. Generation Tab not found");
            return;
        }
        if(!tabCurrent || tabCurrent !== tabGeneration){
            PCM_DEBUG_PRINT(`PcmMaskEditor.applyMask Generation tab clicked : from ${tabCurrentText}`);
            isTabSwitched = true;
            tabGeneration.click();
        }

        // DataTransfer を作成 (wait は後で)
        const pDataTransfer = pcmCreateDataTransferAsync(maskDataUri);

        // Use Mask にチェックが入っていなければチェック
        let useMaskCheckbox = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_USE_MASK_CHECKBOX);
        if(useMaskCheckbox && !useMaskCheckbox.checked){
            useMaskCheckbox.click();
        }

        // CNet Module の Mask container が現れるまで待機
        const [dt, elem] = await Promise.all([
            pDataTransfer,
            pcmQuerySelectorAsync(PcmMaskEditor.SELECTORS.CNET_UNIT_MASK_DROP_TARGET),
            pcmSleepAsync(1250) // 最低限の待機 (マスク drop 前に CNet の画像本体が描画されるのを待つ必要があるため、長めに待機)
        ]);
        if(!elem){
            PCM_DEBUG_PRINT("PcmMaskEditor.applyMask CNet Module Mask container not found");
            return;
        }

        // 画像ドロップイベントをエミュレート
        const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
        });
        elem.dispatchEvent(dropEvent);
        PCM_DEBUG_PRINT("PcmMaskEditor.applyMask dragEvent dispatched");

        // マスクエディタの mask result をクリア
        const clearMaskResultBtn = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_CLEAR_MASK_RESULT_BUTTON_HIDDEN);
        if (clearMaskResultBtn){
            clearMaskResultBtn.click();
            PCM_DEBUG_PRINT("PcmMaskEditor.applyMask clearMaskResultBtn clicked");
        }

        // タブを切り替えていた場合は元のタブに戻る
        if (isTabSwitched && tabCurrentText !== null){
            await pcmSleepAsync(500); // ドロップ後少し待機
            // 改めて タブ を取得する必要あり
            tabCurrent = pcmGetElementBySelectorAndText(PcmMaskEditor.SELECTORS.TAB_BUTTONS, tabCurrentText, gradioApp(), true);
            if(tabCurrent){
                tabCurrent.click();
                PCM_DEBUG_PRINT(`PcmMaskEditor.applyMask tab switched back : to ${tabCurrent.textContent}`);
            }
        }
    }

    /** CNet の画像とマスクを鏡像反転 */
    static async mirrorCNetImageAndMap(){
        /** 画像データ URI を鏡像反転して返す */
        const _mirrorDataUriAsync = (dataUri)=>{
            return new Promise((resolve, reject)=>{
                const img = new Image();
                img.onload = ()=>{
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");
                
                    // set canvas size to image size
                    canvas.width = img.width; 
                    canvas.height = img.height;
                    
                    // mirror image
                    context.translate(img.width, 0);
                    context.scale(-1, 1);

                    // draw image
                    context.drawImage(img, 0, 0);

                    // return dataURI
                    resolve(canvas.toDataURL("image/png"));
                };
                img.src = dataUri;
            });
        };

        PCM_DEBUG_PRINT("PcmMaskEditor.mirrorCNetImageAndMap called.");
        const cnetUnitImageContainer = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_IMAGE_CONTAINER);
        if (!cnetUnitImageContainer) return;

        // 画像
        const imageDataUri = cnetUnitImageContainer.src; // dataURI (data:image/png;base64,...)
        if (!imageDataUri) return;
        
        // マスク
        let maskDataUri = null;
        const maskContainer = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_MASK_CONTAINER);
        const useMaskCheckbox = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_USE_MASK_CHECKBOX);
        if (maskContainer && useMaskCheckbox && useMaskCheckbox.checked){
            maskDataUri = maskContainer.src;
        }

        // Generation タブを開いていない場合クリック
        let isTabSwitched = false;
        let tabCurrent = document.querySelector(PcmMaskEditor.SELECTORS.TAB_BUTTONS + ".selected");
        const tabCurrentText = tabCurrent ? tabCurrent.textContent : null; // 後でタブ要素を再取得するために使う
        const tabGeneration = pcmGetElementBySelectorAndText(PcmMaskEditor.SELECTORS.TAB_BUTTONS, "generation", gradioApp(), true);
        if(!tabGeneration){
            PCM_DEBUG_PRINT("PcmMaskEditor.mirrorCNetImageAndMap error. Generation Tab not found");
            return;
        }
        if(!tabCurrent || tabCurrent !== tabGeneration){
            PCM_DEBUG_PRINT(`PcmMaskEditor.mirrorCNetImageAndMap Generation tab clicked : from ${tabCurrentText}`);
            isTabSwitched = true;
            tabGeneration.click();
        }

        // dataUri を鏡像反転して dataTransfer を作成
        const [imageDataUriMirror, maskDataUriMirror] = await Promise.all([
            _mirrorDataUriAsync(imageDataUri),
            maskDataUri ? _mirrorDataUriAsync(maskDataUri) : null
        ]);

        const [imageDataTransfer, maskDataTransfer] = await Promise.all([
            pcmCreateDataTransferAsync(imageDataUriMirror),
            maskDataUriMirror ? pcmCreateDataTransferAsync(maskDataUriMirror) : null
        ]);

        // 画像ドロップイベントをエミュレート
        const dropTargetImg = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_IMAGE_DROP_TARGET);
        if (dropTargetImg){
            dropTargetImg.dispatchEvent(new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: imageDataTransfer
            }));
        }

        if(maskDataTransfer !== null){
            const dropTargetMask = gradioApp().querySelector(PcmMaskEditor.SELECTORS.CNET_UNIT_MASK_DROP_TARGET);
            if (dropTargetMask){
                dropTargetMask.dispatchEvent(new DragEvent("drop", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: maskDataTransfer
                }));
            }
        }

        // タブを切り替えていた場合は元のタブに戻る
        if (isTabSwitched && tabCurrentText !== null){
            await pcmSleepAsync(500); // ドロップ後少し待機
            // 改めて タブ を取得する必要あり
            tabCurrent = pcmGetElementBySelectorAndText(PcmMaskEditor.SELECTORS.TAB_BUTTONS, tabCurrentText, gradioApp(), true);
            if(tabCurrent){
                tabCurrent.click();
                PCM_DEBUG_PRINT(`PcmMaskEditor.mirrorCNetImageAndMap tab switched back : to ${tabCurrent.textContent}`);
            }
        }
    }

    static initialize(){
        // brush size slider のイベントハンドラ登録
        pcmWaitForContent(PcmMaskEditor.SELECTORS.MASK_EDITOR_BRUSH_SLIDER, ()=>{
            const blushSlider = gradioApp().querySelector(PcmMaskEditor.SELECTORS.MASK_EDITOR_BRUSH_SLIDER);
            blushSlider.addEventListener("change", (e)=>{
                PCM_DEBUG_PRINT(`PcmMaskEditor.blushSlider change : ${e.target.value}`);
                PcmMaskEditor.setBrushSize(e.target.value);
            });
            blushSlider.addEventListener("input", (e)=>{
                PCM_DEBUG_PRINT(`PcmMaskEditor.blushSlider input : ${e.target.value}`);
                PcmMaskEditor.setBrushSize(e.target.value);
            });            
        });

        // canvas への drop event, 空の Canvas の click event 無効化
        pcmWaitForContent(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_DROP_AREA}`, function() {
            const dropArea = document.querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_DROP_AREA}`);
            // 画像がセットされていない場合はクリック無効 (capture phase でイベントを止める)
            dropArea.addEventListener('click', function(e) {
                if (!gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_INNER}`)) { 
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
                if (gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_CANVAS_INNER}`)) { 
                    PCM_DEBUG_PRINT("mouseup event");
                    // Save ボタンをクリック
                    const btn = gradioApp().querySelector(`${PcmMaskEditor.SELECTORS.MASK_EDITOR_GEN_MASK_BUTTON_HIDDEN}`);
                    if (btn) btn.click();
                }
            });
        });

    }
}

PcmMaskEditor.initialize();
