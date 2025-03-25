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
        //{
        //  rel_path: '',
        //  prompt: '',
        //  negative_prompt: '',
        //  isReplace: True,
        //  enableCnet: True,
        //  apply_resolution: False,
        //  resolution: {width: 1024, height: 1024} 
        //  category: 'pose', トップレベルフォルダ名
        //}
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmCardClick data`, JSON.stringify(data));

    } catch (error) {
        console.error("pcmCardClick error", error);
        return;
    }

    let selectorTmp = '';
    let elemTmp = null;
    
    
    // 置換モードで同じカードを連続クリックした場合、置換ではなく削除し、最後にクリックされたカード名をリセット
    if (data.isReplace && pcmLastClickedCard === thumbsName){
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
        //  - 前の処理の updateInput() は input イベントの発火
        //    Mini Gallery 用にスライダーにセットした change イベントのコールバックは発火しないため
        /*
        const width_mg = gradioApp().querySelector('#pcm_mini_gallery_width input[type="number"]');
        const height_mg = gradioApp().querySelector('#pcm_mini_gallery_height input[type="number"]');
        if (width_mg && height_mg){
            if(width_mg.value !== data.resolution.width){
                width_mg.value = data.resolution.width;
                updateInput(width_mg);
            }
            if(height_mg.value !== data.resolution.height){
                height_mg.value = data.resolution.height;
                updateInput(height_mg);
            }
        }*/
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
    let decoration_length = opts.prompt_cards_manager_decoration_line_length;
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
            const startIndex = mStart.index;
            const endIndex = mEnd.index + mEnd[0].length;
            currentText = currentText.slice(0, startIndex) + insertText + currentText.slice(endIndex);
            return currentText;
        }
    }

    // 単純に追加する (現在のテキストが空でない場合、空行を挟む)
    if(currentText.length==0){
        // do nothing
    } else if (!currentText.endsWith('\n')) {
        currentText += '\n\n';
    } else if (!currentText.endsWith('\n\n') ) {
        currentText += '\n';
    }
    currentText += insertText;
    return currentText;
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
    const cnetModel = opts.prompt_cards_manager_default_controlnet_models;
    const cnetPreprocessor = opts.prompt_cards_manager_default_controlnet_preprocessor;
    const controlWeight = opts.prompt_cards_manager_default_controlnet_weight;
    const startingControlStep = opts.prompt_card_manager_default_controlnet_starting_control_step;
    const endingControlStep = opts.prompt_cards_manager_default_controlnet_ending_control_step;
    const controlMode = opts.prompt_cards_manager_default_controlnet_control_mode;
    const resizeMode = opts.prompt_cards_manager_default_controlnet_resize_mode;

    // -- 関数定義 --
    /** Data URI から DataTransfer オブジェクトを作成する */
    const createDataTransferAsync = async (dataUri) => {
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
    // ----------------
    
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
    let pDataTransferImg = createDataTransferAsync(dataUri);

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
            updateInput(elemTmp); // 必須
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
    selectorTmp = `#${tabname}_controlnet_ControlNet-${index}_input_image .image-container > div`
    if(!(elemTmp = pcmGetElement(selectorTmp, baseElem))){
        console.error(`Prompt Cards Manager Error. ${tabname} ControlNet Unit ${index} Input Image Area not found`);
        return;
    }
    const dragEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransferImg
    });
    elemTmp.dispatchEvent(dragEvent);

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
            updateInput(elemTmp);
        }
    }

    //  - Resize Mode
    if (resizeMode){
        PCM_DEBUG_PRINT(`tab: ${tabname} pcmDropImageToCnet Resize Mode`, resizeMode);
        selectorTmp = `${tabname}_controlnet_ControlNet-${index}_controlnet_resize_mode_radio`;
        elemTmp = pcmGetElementBySelectorAndText("label", resizeMode, pcmGetElement(`#${selectorTmp}`, baseElem));
        if (elemTmp){
            elemTmp.click();
            updateInput(elemTmp);
        }
    }
  
    // 再度Prompt Cards Manager タブに戻る
    selectorTmp = `#tab_${tabname} .tabs.gradio-tabs.extra-networks > .tab-nav.scroll-hide > button`
    if(!(elemTmp = pcmGetElementBySelectorAndText(selectorTmp, 'PromptCards'))) return;
    elemTmp.click();
    await pcmSleepAsync(50);

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


/** 選択したフォルダの履歴 
 *   - 配列は t2i, i2i の順 */
let pcmSelectedFolderHistory = [[null], [null]]; // 選択した要素の履歴(新しい順), 各要素は searchPath (末尾に $ は付かない)
let pcmSelectedFolderHistoryIndex = [0, 0]; // Undo/Redo 用現在のインデックス
let pcmSelectedFolderHistoryIndexMax = 40; // 履歴の最大長
let pcmSelectedFolderHistoryIsEventUndoRedo = 0; // Undo :-1, Redo:1, 通常のclick イベント: 0


/** dir tree のフォルダクリック時の履歴更新処理 
 *  - 連続して同じフォルダをクリックした場合はスキップ
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {string} searchPath 最新の選択フォルダ のsearchPath (末尾の $ は本処理内で除去される)
*/
function pcmUpdateSelectedFolderHistory(tabname, searchPath){
    let tabIndex;
    if (tabname === "txt2img"){
        tabIndex = 0;
    }else if (tabname === "img2img"){
        tabIndex = 1;
    }else{
        return;
    }

    PCM_DEBUG_PRINT(`pcmUpdateSelectedFolderHistory tabIndex: ${tabIndex}, searchPath: ${searchPath}`);
    const historyArray = pcmSelectedFolderHistory[tabIndex];

    // Undo/Redo から来た場合, history index だけを更新して終了
    if(pcmSelectedFolderHistoryIsEventUndoRedo !== 0){
        let tmp = pcmSelectedFolderHistoryIndex[tabIndex] + pcmSelectedFolderHistoryIsEventUndoRedo;
        if(tmp < 0 || tmp >= historyArray.length){
            // ここには来ないが念のため
            PCM_DEBUG_PRINT(`pcmUpdateSelectedFolderHistory tabIndex: ${tabIndex}, illegal index`);
        }else{
            pcmSelectedFolderHistoryIndex[tabIndex] = tmp;
        }
        pcmSelectedFolderHistoryIsEventUndoRedo = 0;
        return;
    }

    // 通常のクリックイベントの場合,現在の history index が 0 になるように更新
    if(pcmSelectedFolderHistoryIndex[tabIndex] > 0){
        // 今の index よりも新しい履歴は削除
        historyArray.splice(0, pcmSelectedFolderHistoryIndex[tabIndex]);
        pcmSelectedFolderHistoryIndex[tabIndex] = 0; // 現在のインデックスを0に
    }
    // 今いるフォルダと違うフォルダのクリックだった場合は履歴に追加
    if(historyArray[0] !== searchPath){
        if (historyArray.length >= pcmSelectedFolderHistoryIndexMax){
            historyArray.pop();
        }
        if (searchPath.endsWith('$')) searchPath = searchPath.slice(0, -1);
        historyArray.unshift(searchPath);
    }
}

/** 数字指定で dir tree のフォルダの click event を発火
 *   - 上の並びから {number} 個目のカテゴリをクリック (0スタート)
 *   - 現在の選択場所が既に当該カテゴリ内の何れかだった場合はカテゴリ内の次のフォルダを選択(循環)
 * @param {number} number 数字
 * @param {number} tabname タブ名 (txt2img, img2img)
*/
function pcmCardPageSwitchCategory(number, tabname){
    let target = null;
    let categorieElems = gradioApp().querySelectorAll(`#${tabname}_promptcards_tree > ul > li > ul > li[data-tree-entry-type="dir"]`);
    if (categorieElems.length <= number) return;
    const targetCategoryElem = categorieElems[number];
    let targetChildren = Array.from(targetCategoryElem.querySelectorAll(`li[data-tree-entry-type="dir"]`)); // 子孫のフォルダノード全て
    
    let tabIndex;
    if (tabname === "txt2img") tabIndex = 0;
    else if (tabname === "img2img") tabIndex = 1;
    else return;

    const currentPath = pcmSelectedFolderHistory[tabIndex][pcmSelectedFolderHistoryIndex[tabIndex]];
    PCM_DEBUG_PRINT(`pcmCardPageSwitchCategory tabname: ${tabname}, currentPath: ${currentPath}`);
    if (currentPath === null){
        target = targetCategoryElem;
    }else{
        // currentPath 
        let currentElem = pcmSearchPathToDirTreeElement(currentPath, tabname);
        if(!currentElem){
            target = targetCategoryElem;
        }
        else{
            if (currentElem === targetCategoryElem){
                if (targetChildren.length > 0){
                    target = targetChildren[0];
                }else{
                    return; // カテゴリノードしかなく既に選択済みの場合何もせず終了
                }
            }else{
                const tmpIndex = targetChildren.indexOf(currentElem); // 現在のノードが子孫の何番目か
                if(tmpIndex>=0){
                    if(tmpIndex < targetChildren.length - 1){
                        target = targetChildren[tmpIndex + 1];
                    }else{
                        target = targetCategoryElem; // 子孫の末尾の場合はカテゴリノードに戻る
                    }
                }else{
                    target = targetCategoryElem; // 現在のカテゴリにも子孫にも含まれないノードの場合はカテゴリノード
                }
            }
        }
    }
    target.querySelector(`:scope > .tree-list-content`).click();
}

/** Ctrl + 0, Alt + 0 で Undo/Redo の click を発火
 *   - クリック履歴の更新は custom_tree_button.js のディレクトリ click event で発生するため不要
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {number} isUndoRedo 1: Undo, -1: Redo
*/
function pcmCardPageDoUndoRedo(tabname, isUndoRedo){
    let tabIndex;
    if (tabname === "txt2img") tabIndex = 0;
    else if (tabname === "img2img") tabIndex = 1;
    else return;

    let nextIndex = pcmSelectedFolderHistoryIndex[tabIndex] + isUndoRedo;
    if(nextIndex < 0 || nextIndex >= pcmSelectedFolderHistory[tabIndex].length ){
        pcmSelectedFolderHistoryIsEventUndoRedo = 0; // 念のため
        return;
    }
    pcmSelectedFolderHistoryIsEventUndoRedo = isUndoRedo;
    const searchText = pcmSelectedFolderHistory[tabIndex][nextIndex];
    const elem = pcmSearchPathToDirTreeElement(searchText, tabname);
    if(!elem){
        // DOM 上に既に存在しない場合 ( refresh がちゃんと呼べていれば個々には来ない筈)
        PCM_DEBUG_PRINT(`pcmCardPageDoUndoRedo tabname: ${tabname}, searchText: ${searchText} not found in DOM`);
        pcmSelectedFolderHistoryIndex[tabIndex] = nextIndex;
        return;
    }
    elem.querySelector(`:scope> .tree-list-content`).click();
}


/** Ctrl + 数字キー, Alt + 0 コールバック登録
 *   - 数字キーは 1-9 まで -> -1 して 0-8 にマッピング
*/
window.addEventListener('keydown', (event)=>{
    if(event.ctrlKey && /^\d$/.test(event.key)){
        event.preventDefault();

        // 現在のタブ
        let tabname;
        let elem = gradioApp().querySelector('#tab_txt2img');
        if(elem && elem.style.display === 'block'){
            tabname = "txt2img";
        }else{
            elem = gradioApp().querySelector('#tab_img2img');
            if(elem && elem.style.display === 'block'){
                tabname = "img2img";
            }
        }
        if(!tabname) return;
        if(event.key === '0'){
            pcmCardPageDoUndoRedo(tabname, 1); // Undo
        }else{
            pcmCardPageSwitchCategory(parseInt(event.key,10)-1, tabname); // カテゴリクリック
        }

    } else if(event.altKey && event.key === '0'){
        event.preventDefault();

        // 現在のタブ
        let tabname;
        let elem = gradioApp().querySelector('#tab_txt2img');
        if(elem && elem.style.display === 'block'){
            tabname = "txt2img";
        }else{
            elem = gradioApp().querySelector('#tab_img2img');
            if(elem && elem.style.display === 'block'){
                tabname = "img2img";
            }
        }
        if(!tabname) return;
        pcmCardPageDoUndoRedo(tabname, -1); // Redo
    }    
});


/** dir tree util: search path -> フォルダ要素 (<li>), 無ければ null
 *   - Clickable 要素は <li> 直下の ':scope > .tree-list-content'
*/
function pcmSearchPathToDirTreeElement(path, tabname){
    // 各 <li> がノード, 属性 data-tree-entry-type="dir" がディレクトリタイプ
    //   - 直下の '> .tree-list-content' が clickable 要素 
    //   - 二つ下の '> span.tree-list-item-label' の textContent がノードの表示名 (trim() 必須)
    PCM_DEBUG_PRINT(`pcmSearchPathToDirTreeElement path: ${path}`);
    if (path === null) return null;
    const dirs = path.split('/');

    let layer0 = gradioApp().querySelector(`#${tabname}_promptcards_tree > ul > li`);
    if(!layer0) return null;

    let tmpLayer = layer0;
    let isFound = false;
    for (const dir of dirs.slice(1)){ // root dir はスキップして子孫からチェック
        isFound = false;
        const nextLayers = tmpLayer.querySelectorAll(`:scope > ul > li[data-tree-entry-type="dir"]`);
        for (const nextLayer of nextLayers){
            if(nextLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim() === dir){
                tmpLayer = nextLayer;
                isFound = true;
                tmpLayer = nextLayer;
                break;
            }
        }
        if(!isFound) return null;
    }
    return tmpLayer;
}

/** dir tree util: フォルダ要素 (<li>) -> search path
 *   - Clickable 要素は <li> 直下の ':scope > .tree-list-content'
 *     + event から呼ぶときは event.target.parentElement を引数にすること
*/
function pcmDirTreeElementToSearchPath(elem){
    try{
        let tmpLayer = elem; // <li>
        PCM_DEBUG_PRINT(`pcmDirTreeElementToSearchPath tmpLayer.tagName: ${tmpLayer.tagName}`);
        let ret = tmpLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim();
    
        while(tmpLayer){
            tmpLayer = tmpLayer.parentElement.parentElement; // <li>
            if(tmpLayer.tagName !== 'LI') break;
            ret = tmpLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim() + '/' + ret;
        }
        return ret;
    }catch(error){
        PCM_DEBUG_PRINT(`pcmDirTreeElementToSearchPath error`, error);
        PCM_DEBUG_PRINT(error.stack);
        return "";
    }
}