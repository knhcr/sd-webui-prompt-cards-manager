/** 最後にクリックされたカード名 (thumbs_name) */
let pcmLastClickedCard = "";

/** Prompt Cards Manager カードのクリックハンドラー
 * カード情報をプロンプトに反映
 * @param {Event} event
 * @param {string} tabname
 * @param {string} thumbsName
 */
async function pcmCardClick(event, tabname, thumbsName) {
    event.preventDefault();
    event.stopPropagation();

    PCM_DEBUG_PRINT(`tab: ${tabname} pcmCardClick called : ${thumbsName}`);

    /** プロンプトの変更を確認
     * @param {string} currentText 現在のプロンプトエリアの生テキスト
     * @param {string} newText 新しいカードテキスト
     * @param {string} category カテゴリ名
     * @returns {boolean} 変更がある場合は true, 変更がない場合は false
     */
    function _isChanged(currentText, newText, category){
        let ret = false;
        const pStart = new RegExp(`^## -- \\[${category}\\] -+>$`, "m");
        const pEnd = new RegExp(`^## <-+ \\[${category}\\] --$`, "m");

        const mStart = currentText.match(pStart);
        const mEnd = currentText.match(pEnd);

        if(mStart && mEnd && mStart.index < mEnd.index){
            let startIndex = mStart.index + mStart[0].length + 1;
            let endIndex = mEnd.index-1;
            const targetText = currentText.slice(startIndex, endIndex);
            //PCM_DEBUG_PRINT(`pcmCardClick _isChanged targetText: ${targetText}`);
            //PCM_DEBUG_PRINT(`pcmCardClick _isChanged newText: ${newText}`);
            ret = targetText !== newText;
        }
        PCM_DEBUG_PRINT(`pcmCardClick _isChanged ret: ${ret}`);
        return ret;
    }

    // スクロール位置を記憶
    const scrollPosition = {
        x: window.scrollX,
        y: window.scrollY
    };

    // ポーズ情報エディタのデータを取得
    let data = null;
    try {
        const qs = new URLSearchParams({thumbs_name: thumbsName}).toString();
        let response = await fetch(`${PCM_API_ENDPOINT_BASE}/prompt-card-info?${qs}`, {method: 'GET'});
        if (!response.ok) throw new Error(response.statusText);

        data = await response.json();
        // sample data
        //{
        //  rel_path: '',
        //  prompt: '',
        //  negative_prompt: '',
        //  isReplace: True,
        //  enableCnet: True,
        //  apply_resolution: False,
        //  resolution: {width: 1024, height: 1024} 
        //  category: 'pose', トップレベルフォルダ名
        //  has_some_data: true/false, サーバにtxtもjsonも無い場合は false
        //}
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmCardClick data`, JSON.stringify(data));

    } catch (error) {
        console.error("pcmCardClick error", error);
        return;
    }

    if (!data.has_some_data) return;

    let selectorTmp = '';
    let elemTmp = null;
    
    // 置換モードで同じカードを連続クリックした場合、
    // Prompt, Negative Prompt 共にカードの内容から変更が無かった場合は
    // 置換ではなく削除し、最後にクリックされたカード名をリセット
    let deleteFlag = false;
    if (data.isReplace && pcmLastClickedCard === thumbsName){
        let isChangedP = false;
        selectorTmp = `#${tabname}_prompt textarea`;
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (elemTmp){
            isChangedP = _isChanged(elemTmp.value, data.prompt, data.category);
        }
        let isChangedN = false;
        selectorTmp = `#${tabname}_neg_prompt textarea`;
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (elemTmp){
            isChangedN = _isChanged(elemTmp.value, data.negative_prompt, data.category);
        }
        if(!isChangedP && !isChangedN){
            deleteFlag = true;
        }
    }
    
    if(deleteFlag){
        // 変更無し状態で同じカードを連続クリックした場合リセット
        data.prompt = "";
        data.negative_prompt = "";
        pcmLastClickedCard = "";
    }else{
        pcmLastClickedCard = thumbsName; // 最後にクリックされたカード名を更新
    }

    // プロンプト更新
    if (data.isReplace || data.prompt){ // isReplace が True の場合は空でも置換, False の場合は空だとスキップ
        // Prompt 要素
        selectorTmp = `#${tabname}_prompt textarea`;
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;

        // 更新
        elemTmp.value = pcmGeneratePrompt(elemTmp.value, data.prompt, data.category, data.isReplace);
        updateInput(elemTmp);
    }

    // ネガティブプロンプト更新
    if (data.isReplace || data.negative_prompt){ // isReplace が True の場合は空でも置換, False の場合は空だとスキップ
        // Negative Prompt 要素
        selectorTmp = `#${tabname}_neg_prompt textarea`;
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;

        // 更新
        elemTmp.value = pcmGeneratePrompt(elemTmp.value, data.negative_prompt, data.category, data.isReplace);
        updateInput(elemTmp);
    }

    // 解像度更新 (i2i で解像度変更が必要とは思えないため t2i のみ)
    if (tabname === "txt2img" && data.apply_resolution){
        // width
        selectorTmp = '#txt2img_column_size #txt2img_width input[type="number"]';
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;
        const width = parseInt(elemTmp.value);
        if (width !== data.resolution.width){
            PCM_DEBUG_PRINT(`tab: ${tabname} pcmCardClick change width ${width} -> ${data.resolution.width}`);
            elemTmp.value = data.resolution.width;
            updateInput(elemTmp);
        }
        // height
        selectorTmp = '#txt2img_column_size #txt2img_height input[type="number"]';
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;
        const height = parseInt(elemTmp.value);
        if (height !== data.resolution.height){
            PCM_DEBUG_PRINT(`tab: ${tabname} pcmCardClick change height ${height} -> ${data.resolution.height}`);
            elemTmp.value = data.resolution.height;
            updateInput(elemTmp);
        }

        // Mini Gallery の値も更新
        pcmUpdateMiniGalleryControlValues({
            update_width: true, update_height: true,
            update_cnet_enabled: true, update_cnet_weight: true, update_cnet_end_step: true
        });

    }

    // 元のスクロール位置に戻す
    window.scrollTo(scrollPosition.x, scrollPosition.y);
}

/** Prompt Cards Manager の send CNET, send CNET and Mask ボタンのクリックハンドラー
 * CNET画像をプロンプトに反映
 * @param {Event} event
 * @param {string} tabname
 * @param {string} thumbs_name
 * @param {string} mask_suffix send CNET の場合は null, send CNET and Mask の場合は mask_suffix ('M[0]'など)
 */
async function pcmSendCnetBtnClick(event, tabname, thumbs_name, mask_suffix) {

    // event.preventDefault();
    event.stopPropagation(); //裏側のカードもクリックされるため止める


    PCM_DEBUG_PRINT(`tab: ${tabname} pcmSendWithCnetBtnClick called` + thumbs_name);

    // 画像ファイルとマスクファイルを取得
    let images = await pcmGetImageAndMask(thumbs_name, mask_suffix);
    
    PCM_DEBUG_PRINT(`tab: ${tabname} pcmSendWithCnetBtnClick num images`, images.filter(image => image !== null).length);

    // 画像をControlNetに設定
    await pcmDropImageToCnet(images[0], 0, tabname, false);

    // マスクをControlNetに設定
    /* [TODO]
    if(mask_suffix !== null && images[1] !== null){
        pcmDropImageToCnet(images[1], 0, tabname, true);
    }
    */

    // Mini Gallery の ControlNet 関連の値更新
    pcmUpdateMiniGalleryControlValues({
        update_cnet_enabled: true, update_cnet_weight: true, update_cnet_end_step: true
    });
}


/** プロンプト更新テキストを生成
 * @param {string} currentText 現在のテキスト
 * @param {string} text 追加するテキスト
 * @param {string} category カテゴリ情報
 * @param {boolean} isReplace 置換するか追加するか
 * @returns {string} 更新テキスト
 */
function pcmGeneratePrompt(currentText, text, category="", isReplace=true){
    if(!category) category = '';
    let decoration_length = opts[PCM_SETTINGS_KEYS.misc.decoration_line_length];
    if(!decoration_length) decoration_length = 55;
    const prefix = `## -- [${category}] ${'-'.repeat(decoration_length)}>` 
    const suffix = `## <${'-'.repeat(decoration_length)} [${category}] --`;

    if(!text && !isReplace) return currentText;

    let insertText = text;
    if(isReplace){
        // 置換後のテキスト
        if(text){
            insertText = prefix + '\n' + text + '\n' + suffix;
        }else{
            insertText = ""; // 置換箇所の削除に相当
        }

        // 置換箇所を探す
        const pStart = new RegExp(`^## -- \\[${category}\\] -+>$`, "m");
        const pEnd = new RegExp(`^## <-+ \\[${category}\\] --$`, "m");
        
        const mStart = currentText.match(pStart);
        const mEnd = currentText.match(pEnd);

        // 置換箇所が見つかった場合は置換
        if(mStart && mEnd && mStart.index < mEnd.index){
            let startIndex = mStart.index;
            let endIndex = mEnd.index + mEnd[0].length;

            // 削除の場合
            //   - 末尾に改行がある場合はそれも削除 (手で消してなければ通常存在)
            //   - 上部に空行がある場合はそれも削除 (手で消してなければ通常存在)
            if (insertText.length === 0){
                if (currentText[endIndex] === '\n'){
                    endIndex++;
                }
                if (currentText.length > 1 && startIndex > 0 &&
                    currentText[startIndex-1] === '\n'){
                    startIndex--;
                }
            }

            currentText = currentText.slice(0, startIndex) + insertText + currentText.slice(endIndex);
            // PCM_DEBUG_PRINT(`pcmGeneratePrompt currentText : ${currentText}`);

            // startIndex より上が全て改行のみの場合、不要な改行なので削除
            if(currentText.slice(0, startIndex).match(/^\n+$/)){
                currentText = currentText.slice(startIndex);
            }

            return currentText;
        } else{
            // fall through
        }
    }

    if(insertText.length === 0){
        return currentText;
    }
    
    // 単純に追加する 
    //  - 現在のテキストが空でない場合、上に空行を挟む
    if(currentText.length==0){
        // 完全に空 - > do nothing
    } else if (!currentText.endsWith('\n')) {
        // 改行無しで終了 -> 改行 + 空行
        currentText += '\n\n';
    } else if (!currentText.endsWith('\n\n') ) {
        // 改行ありで終了 -> 空行
        currentText += '\n';
    } else{
        // 末尾に空行あり -> do nothing
    }
    return currentText + insertText + "\n"; // 装飾行 + 改行 を追加
}


/** 画像ファイルとマスクファイルを取得
 * @param {string} thumbsName
 * @param {string} maskSuffix {image_path_stem}{mask_suffix}.{image_path_ext} を取得, マスク不要時は null
 * @returns {[string, string]} 画像ファイルとマスクファイルのData URI (Base64), 存在しない場合は配列要素は null
 */
async function pcmGetImageAndMask(thumbsName, maskSuffix){
    let data = {thumbs_name: thumbsName}
    
    // GETで送るため JSON に toString() をかけると null は文字列 "null" になるため Python側で None にならない
    // null の場合はキー自体を含めずpython側でデフォルト値 None として補う
    if(maskSuffix!==null&&maskSuffix!==undefined) data.mask_suffix = maskSuffix;

    let qs = new URLSearchParams(data).toString();
    try {
        let response = await fetch(`${PCM_API_ENDPOINT_BASE}/image?${qs}`, {method: 'GET'});
        if (!response.ok) throw new Error(response.statusText);
    
        let ret = await response.json(); // [data_uri, data_uri]
        return ret;

    } catch (error) {
        console.error("pcmGetImageAndMask error", error);
        return [null, null];
    }
}


/** ControlNetへの画像ドラッグ＆ドロップをエミュレート 
 * [TODO] i2i の場合 Upload independent control image をチェックする必要あり
 *       (そもそもi2iでCNetまで使うような画像修正掛ける時にこの機能は使わないと思うので要らんかも)
 * @param {string} dataUri data:${mimetype};base64,${img_base64}
 * @param {number} index ControlNet のインデックス
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {boolean} is_mask マスク画像か否か
 */
async function pcmDropImageToCnet(dataUri, index = 0, tabname = "txt2img", is_mask = false){
    // forge builtin CNET か
    let selectorTmp = `#${tabname}_controlnet_accordions #input-accordion-${index}`; // トップのアコーディオン
    let elemTmp = pcmGetElement(selectorTmp, null, true);
    if(elemTmp){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet forge builtin CNET`);
        await pcmDropImageToCnetForge(dataUri, index, tabname, is_mask);
        return;
    }
    // github extension の CNET か
    selectorTmp = `#${tabname}_controlnet #controlnet.gradio-accordion` // トップのアコーディオン
    elemTmp = pcmGetElement(selectorTmp, null, true);
    if(elemTmp){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet github extension CNET`);
        await pcmDropImageToCnetExtension(dataUri, index, tabname, is_mask);
        return;
    }

    PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet CNET function not found`);
    return;
}


/** ControlNetへの画像ドラッグ＆ドロップをエミュレート (forge builtin CNET の場合)
 * @param {string} dataUri data:${mimetype};base64,${img_base64}
 * @param {number} index ControlNet のインデックス
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {boolean} is_mask マスク画像か否か
 */
async function pcmDropImageToCnetForge(dataUri, index = 0, tabname = "txt2img", is_mask = false){
    const cnetModel = opts[PCM_SETTINGS_KEYS.cnet.default_models];
    const cnetPreprocessor = opts[PCM_SETTINGS_KEYS.cnet.default_preprocessor];
    const controlWeight = opts[PCM_SETTINGS_KEYS.cnet.default_weight];
    const startingControlStep = opts[PCM_SETTINGS_KEYS.cnet.default_starting_control_step];
    const endingControlStep = opts[PCM_SETTINGS_KEYS.cnet.default_ending_control_step];
    const controlMode = opts[PCM_SETTINGS_KEYS.cnet.default_control_mode];
    const resizeMode = opts[PCM_SETTINGS_KEYS.cnet.default_resize_mode];

    
    let selectorTmp = ''; // テンポラリセレクタ
    let elemTmp = null // テンポラリ要素オブジェクト
    let statusTmp = null; // テンポラリステータスオブジェクト

    // Controlnetアコーディオンを開く
    selectorTmp = `#${tabname}_script_container #controlnet .label-wrap`
    if(!(elemTmp = pcmGetElement(selectorTmp))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Accordion not found`);
        return;
    }
    if (!elemTmp.classList.contains('open')){ // 開いていない場合
        elemTmp.click();
        await pcmSleepAsync(50);
    }

    // 以下 #input-accordion-0 の中の処理
    selectorTmp = `#${tabname}_controlnet_accordions #input-accordion-${index}`; // => forge builtin CNET の場合のみ
    if(!(elemTmp = pcmGetElement(selectorTmp))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Unit ${index} Container not found`);
        return;
    }
    let baseElem = elemTmp;

    // ControlNet Unit 0 アコーディオンを開く
    selectorTmp = `.label-wrap`
    if(!(elemTmp = pcmGetElement(selectorTmp, baseElem))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Unit ${index} not found`);
        return;
    }
    if (!elemTmp.classList.contains('open')){ // 開いていない場合
        elemTmp.click();
        await pcmSleepAsync(50);
    }

    // CNetが有効になっていなければ Enable ボタンをクリック
    selectorTmp = `#${tabname}_controlnet_ControlNet-${index}_controlnet_enable_checkbox input[type='checkbox']`
    if(!(elemTmp = pcmGetElement(selectorTmp, baseElem))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Unit ${index} Enable Checkbox not found`);
        return;
    }
    statusTmp = pcmGetGradioComponentByElemId(`${tabname}_controlnet_ControlNet-${index}_controlnet_enable_checkbox`)
    if(statusTmp){
        if(!statusTmp.props.value){
            PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet ControlNet-${index} Enable checkbox clicked`);
            elemTmp.click();
            await pcmSleepAsync(10);
        }
    }

    // CNet UI初回ロード時は描画を促すためGenerationタブを表示して少し待機, これで一応上手く行く
    //   -> CNet モデル一覧の更新処理や、CNet モデルの変更を行った場合も再度表示が必要っぽい
    //      念のため初回だけでなく毎回表示させる
    // 画像ドロップの前までにUI表示後の待機時間が必要 (それまでに画像処理は非同期でやっておく)
    // Mask についても同様のため、ここで一旦 Use Mask を On にした状態で開く
    let pDataTransferImg = pcmCreateDataTransferAsync(dataUri);

    // Generationタブのクリック
    selectorTmp = `#tab_${tabname} .tabs.gradio-tabs.extra-networks > .tab-nav.scroll-hide > button`
    if(!(elemTmp = pcmGetElementBySelectorAndText(selectorTmp, 'Generation'))) return;
    elemTmp.click();
    await pcmSleepAsync(50);
    PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Generation tab clicked`);

    // CNet Model 選択処理
    let modelList = [];
    //  - CNet モデルリストが空なら更新
    statusTmp = pcmGetGradioComponentByElemId("txt2img_controlnet_ControlNet-0_controlnet_model_dropdown") // リストは共通なので txt2img, 0 でOK
    if (!statusTmp || statusTmp.props.choices.length === 1){
        // CNetモデルリストの更新ボタンクリック
        selectorTmp = `#${tabname}_controlnet_ControlNet-${index}_controlnet_refresh_models`
        if((elemTmp = pcmGetElement(selectorTmp))){
            elemTmp.click();
            //updateInput(elemTmp); // 必須
            PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet ControlNet Model List Refresh Button clicked`);
            // 追加で待機
            for (let i = 0; i < 5; i++){
                if(statusTmp && statusTmp.props.choices.length > 1) break;
                PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet ControlNet Model List Refreshing... ${i}`);
                await pcmSleepAsync(100);
            }
        }else{
            console.error("Prompt Cards Manager Error. ControlNet model list refresh button not found.");
        }
    }
    if (!statusTmp || statusTmp.props.choices.length === 1){
        console.error("Prompt Cards Manager Error. ControlNet model list is empty.");
    }else{
        //  - モデル選択
        if(statusTmp.props.value !== cnetModel){
            modelList = statusTmp.props.choices;
            PCM_DEBUG_PRINT(`pcmDropImageToCnet modelList`, modelList);
            if(modelList.includes(cnetModel)){
                statusTmp.props.value = cnetModel;
            }else{
                console.error(`Prompt Cards Manager Error. ControlNet model list does not include : ${cnetModel}`);
            }
            elemTmp = pcmGetElement(`#${tabname}_controlnet_ControlNet-${index}_controlnet_model_dropdown`)
            if (elemTmp) updateInput(elemTmp);
        }
    }

    // Preprocessor 選択処理
    statusTmp = pcmGetGradioComponentByElemId("txt2img_controlnet_ControlNet-0_controlnet_preprocessor_dropdown") // リストは共通なので txt2img, 0 でOK
    if(statusTmp){
        if(statusTmp.props.value !== cnetPreprocessor){
            statusTmp.props.value = cnetPreprocessor;
            elemTmp = pcmGetElement(`#${tabname}_controlnet_ControlNet-${index}_controlnet_preprocessor_dropdown`)
            if (elemTmp) updateInput(elemTmp);
        }
    }

    // 画像ドロップイベントをエミュレート
    let [dataTransferImg, _] = await Promise.all([pDataTransferImg, pcmSleepAsync(350)]);
    selectorTmp = `#${tabname}_controlnet_ControlNet-${index}_input_image .image-container > .center`
    if(!(elemTmp = pcmGetElement(selectorTmp, baseElem))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Unit ${index} Input Image Area not found`);
        return;
    }
    const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransferImg
    });
    elemTmp.dispatchEvent(dropEvent);

    // 各種パラメータのセット : gradio_config 経由でセットする
    //  - Control Weight
    if (controlWeight!==undefined && controlWeight!==null){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Control Weight`, controlWeight);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_control_weight_slider`;
        statusTmp = pcmGetGradioComponentByElemId(selectorTmp);
        if (statusTmp){
            statusTmp.props.value = controlWeight;
            if((elemTmp = pcmGetElement(`#${selectorTmp}`, baseElem))) updateInput(elemTmp); // 不要っぽい
        }
    }

    //  - Starting Control Step
    if (startingControlStep!==undefined && startingControlStep!==null){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Control Weight`, controlWeight);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_start_control_step_slider`;
        statusTmp = pcmGetGradioComponentByElemId(selectorTmp);
        if (statusTmp){
            statusTmp.props.value = startingControlStep;
            if((elemTmp = pcmGetElement(`#${selectorTmp}`, baseElem))) updateInput(elemTmp); // 不要っぽい
        }
    }    

    //  - Ending Control Step
    if (endingControlStep!==undefined && endingControlStep!==null){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Ending Control Step`, endingControlStep);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_ending_control_step_slider`;
        statusTmp = pcmGetGradioComponentByElemId(selectorTmp);
        if (statusTmp){
            statusTmp.props.value = endingControlStep;
            if((elemTmp = pcmGetElement(`#${selectorTmp}`, baseElem))) updateInput(elemTmp); // 不要っぽい
        }
    }    

    //  - Control Mode
    if (controlMode){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Control Mode`, controlMode);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_control_mode_radio`;
        elemTmp = pcmGetElementBySelectorAndText("label", controlMode, pcmGetElement(`#${selectorTmp}`, baseElem));
        if (elemTmp){
            elemTmp.click();
        }
    }

    //  - Resize Mode
    if (resizeMode){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Resize Mode`, resizeMode);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_resize_mode_radio`;
        elemTmp = pcmGetElementBySelectorAndText("label", resizeMode, pcmGetElement(`#${selectorTmp}`, baseElem));
        if (elemTmp){
            elemTmp.click();
        }
    }

    // 画像変更時は Mask は Off にする
    selectorTmp = `#${tabname}_controlnet_ControlNet-${index}_controlnet_mask_upload_checkbox input[type='checkbox']`
    elemTmp = pcmGetElement(selectorTmp);
    if(elemTmp && elemTmp.checked){
            elemTmp.click();
    }
    
    // 少し待機
    await pcmSleepAsync(200);

    // 再度Prompt Cards Manager タブに戻る
    selectorTmp = `#tab_${tabname} .tabs.gradio-tabs.extra-networks > .tab-nav.scroll-hide > button`
    if(!(elemTmp = pcmGetElementBySelectorAndText(selectorTmp, 'PromptCards'))) return;
    elemTmp.click();
    
    PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet end.`);
}


/** ControlNetへの画像ドラッグ＆ドロップをエミュレート (github extension の CNET の場合)
 * @param {string} dataUri data:${mimetype};base64,${img_base64}
 * @param {number} index ControlNet のインデックス
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {boolean} is_mask マスク画像か否か
 */
async function pcmDropImageToCnetExtension(dataUri, index = 0, tabname = "txt2img", is_mask = false){
    // [TODO]
    return;
}

/** カードの Action エリアをクリックした際、Dir Name 表示中の場合はツリーをボタンをクリックと同等の機能 */
function pcmCardActionDivOnClick(event){
    // tabname 取得
    let tabname = null;
    if(!tabname){
        const t2i_pane = gradioApp().querySelector(`#txt2img_${PCM_EXTRA_NETWORKS_TABNAME}_pane`);
        if(t2i_pane && t2i_pane.contains(event.target)){
            tabname = 'txt2img';
        }
    }
    if(!tabname){
        const i2i_pane = gradioApp().querySelector(`#img2img_${PCM_EXTRA_NETWORKS_TABNAME}_pane`);
        if(i2i_pane && i2i_pane.contains(event.target)){
            tabname = 'img2img';
        }
    }
    if(!tabname) return;

    // show dirname の状態判定
    const showDirnameBtn = gradioApp().querySelector(`#${tabname}_pcm_dirname_toggle`)
    if(!showDirnameBtn) return;
    const isShowDirname = showDirnameBtn.classList.contains('enabled');
    PCM_DEBUG_PRINT(`pcmCardActionDivOnClick ${tabname} ${isShowDirname}`);
    if(!isShowDirname) return;

    // orgName
    const orgName = event.currentTarget.querySelector('.name').getAttribute('orgname');
    PCM_DEBUG_PRINT(`pcmCardActionDivOnClick : orgName = ${orgName}`);

    // orgName to path
    let path = PcmCardSearch.cards[tabname][orgName].path;
    if(!path) return;
    path = path.slice(0, -1); // $ を除く

    const dirElem = pcmSearchPathToDirTreeElement(path, tabname);
    if(!dirElem) return;
    
    PCM_DEBUG_PRINT(`pcmCardActionDivOnClick : dir Elem clicked`);
    event.stopPropagation();
    event.preventDefault();
    dirElem.querySelector(':scope > .tree-list-content').click();
}