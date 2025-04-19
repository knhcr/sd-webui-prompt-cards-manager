/**
* ポーズ情報エディタモーダルを開く
* @param {Event} event
* @param {string} tabname - タブ名（不使用）
* @param {string} extraNetworksTabname - 追加ネットワークタブ名（不使用）
* @param {string} thumbsName - ファイル名
*/
const pcmPieOpenModal = (event, tabname, extraNetworksTabname, thumbsName)=>{
    if(event){
        event.preventDefault();
        event.stopPropagation();
    }

    // Gradio は同一 value の連続する input イベントを無視するのでノンスを入れる (ファイル名$タイムスタンプ)
    const nonce = Date.now();
    thumbsName = `${thumbsName}$${nonce}`; 

    const filenameInput = gradioApp().querySelector('#pcm_filename_input textarea');
    filenameInput.value = thumbsName;
    filenameInput.dispatchEvent(new Event('input', {bubbles:true}));

    PCM_DEBUG_PRINT(`Info Edit clicked for: ${thumbsName}`);
};

/**
* ポーズ情報エディタの固定比率ボタンの状態管理オブジェクト
* [TODO] 実装微妙 -> 初期化をonUiLoadedに寄せる、isLocked を保持せずDOMの属性で持たせる
*/
const pcmPieAspectRatioStatus = {
    fixAspectRatioButton : null, 
    isLocked : false, // ボタンの初期状態
    currentAspectRatio : 1, // ロックされた時点でのアスペクト比 (width / height)
    
    unlockedSvgPath : `${PCM_API_ENDPOINT_BASE}/resources/lock-unlocked-svgrepo-com.svg`,
    lockedSvgPath : `${PCM_API_ENDPOINT_BASE}/resources/lock-svgrepo-com.svg`,

    unlockedSvg(){return `<img src="${this.unlockedSvgPath}" alt="Unlocked">`},
    lockedSvg(){return `<img src="${this.lockedSvgPath}" alt="Locked">`},

    toggleAspectRatio(){
        // js ロード時点ではDOMが存在しないため、最初にコールされた時点でボタンを初期化
        if(!this.fixAspectRatioButton){
            this.fixAspectRatioButton = gradioApp().querySelector('#pcm_pie_fix_aspect_ratio_btn');
        }

        this.isLocked = !this.isLocked;
        
        if (this.isLocked) {
            // ロック状態
            //  - アスペクト比を更新
            this.currentAspectRatio = 
                parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value)
                / parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value);
            
            this.fixAspectRatioButton.innerHTML = this.lockedSvg();
            this.fixAspectRatioButton.classList.add('pcm-pie-fix-aspect-ratio-btn-locked');
        } else {
            // アンロック状態
            this.fixAspectRatioButton.innerHTML = this.unlockedSvg();
            this.fixAspectRatioButton.classList.remove('pcm-pie-fix-aspect-ratio-btn-locked');
        }
    }
};

/**
* 解像度スライダの値変更処理
*  - アスペクト比ロック時の同期処理
*  - ピクセル数のルートの更新
* @param {Event} event
*/
const pcmePieResolutionSliderOnchange = (event)=>{
    // 発火元スライダーのコンテナ
    //  - スライダ―からのイベントだと.parentNodeで取得できるが、テキストエリアの変更イベントだと直接の親ではないためclosestで取得
    const senderContainer = event.target.closest('#pcm_pie_resolution_slider_width, #pcm_pie_resolution_slider_height');

    // アスペクト比がロックされている場合の同期処理
    if(pcmPieAspectRatioStatus.isLocked || !event){
        // 変更対称のスライダーコンテナ
        let targetContainer = null;
        if(senderContainer.id === 'pcm_pie_resolution_slider_width'){
            targetContainer = gradioApp().querySelector('#pcm_pie_resolution_slider_height');
        } else if(senderContainer.id === 'pcm_pie_resolution_slider_height'){
            targetContainer = gradioApp().querySelector('#pcm_pie_resolution_slider_width');
        }
    
        // Gradioの内部処理が不明のため、後のinputイベントは念のためbubblingで発火させる (単にbubblingを止めても動作はするが)
        // 但し、bubblingさせるとターゲットのinputイベントも連鎖で発火して無限ループになるため、
        // 同期処理中か否かをスライダコンテナの属性として持たせて無限ループを止める処理を入れる
        if(targetContainer.getAttribute('data-syncing') === "true"){
            return;
        }
        targetContainer.setAttribute('data-syncing', "true");
    
    
        // 現在のスライダーの値を取得して変更後の値を計算
        let targetValue = null;
        if(senderContainer.id === 'pcm_pie_resolution_slider_width'){
            // current_width / (width / height)
            targetValue = parseFloat(event.target.value) / pcmPieAspectRatioStatus.currentAspectRatio;
        } else if(senderContainer.id === 'pcm_pie_resolution_slider_height'){
            // current_height * (width / height)
            targetValue = parseFloat(event.target.value) * pcmPieAspectRatioStatus.currentAspectRatio;
        }
        targetValue = Math.round(targetValue);
    
        // スライダー（range input）を取得して値を設定
        const targetRangeInput = targetContainer.querySelector('input[type="range"]');
        targetRangeInput.value = targetValue;
        targetRangeInput.dispatchEvent(new Event('input', {bubbles: true}));
        

        // 数値入力（number input）を取得して値を設定
        const targetNumberInput = targetContainer.querySelector('input[type="number"]');
        targetNumberInput.value = targetValue;
        targetNumberInput.dispatchEvent(new Event('input', {bubbles: true}));


        // 同期中フラグを解除
        targetContainer.setAttribute('data-syncing', "false");
    }

    _pcmPieUpdateSquareRoot(); // ルートピクセル数の更新
    _pcmPieUpdateAspectRatio(); // 解像度フッターのアスペクト比の表示のみを更新 (内部で保持するアスペクト比の更新は不要)
}


/**
 * 解像度フッターのルートピクセル数の表示を更新する
*/
const _pcmPieUpdateSquareRoot = ()=>{
    const squareRootOfTotalPixels = 
        parseFloat(
            Math.sqrt(
                parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value)
                * parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value)
            )
        ).toFixed(1);
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_square_root').innerHTML = squareRootOfTotalPixels;
}

/**
 * 解像度フッターのアスペクト比の表示のみを更新 (内部で保持するアスペクト比の更新は不要)
*/
const _pcmPieUpdateAspectRatio = ()=>{
    const isHeightBasis = gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_wrapper').classList.contains('height-basis');
    if(!isHeightBasis){
        const h_over_w = 
            parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value)
            / parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value);
            gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_w').innerHTML = 1;
            gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_h').innerHTML = h_over_w.toFixed(4);

    } else {
        const w_over_h = 
            parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value)
            / parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value);
        gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_w').innerHTML = w_over_h.toFixed(4);
        gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_h').innerHTML = 1;
    }
}

const toggleAspectRationBasis = ()=>{
    const elem = gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_wrapper');
    elem.classList.toggle('height-basis', !elem.classList.contains('height-basis'));
    _pcmPieUpdateAspectRatio();
}

/** 解像度を指定の倍数に微調整する
 * @param {number} multiple - 倍数
*/
const pcmPieAdjustResolutionToMultiple = (multiple)=>{
    const width = parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value);
    const height = parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value);
    const width2 = Math.round(width / multiple) * multiple;
    const height2 = Math.round(height / multiple) * multiple;
    if(width2 !== width || height2 !== height){
        _pcmPieSetResolution(width2, height2);
    }
}

/** 解像度を指定の倍率に変更する
 * @param {number} multiple - 倍率
*/
const pcmPieMultipleResolution = (multiple)=>{
    const width = parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value);
    const height = parseFloat(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value);
    const width2 = Math.round(width * multiple);
    const height2 = Math.round(height * multiple);
    if(width2 !== width || height2 !== height){
        _pcmPieSetResolution(width2, height2);
    }
}

/** 画像の解像度テキストをスライダーにセットする
 * @param {number} sqrtPixel - 指定された場合、その値に近い64の倍数の解像度にスケールする
*/
const pcmPieSetResolutionFromImageText = (sqrtPixel = null)=>{
    // [w, h]
    const resSlider = [
        parseInt(gradioApp().querySelector('#pcm_pie_resolution_slider_width input[type="number"]').value),
        parseInt(gradioApp().querySelector('#pcm_pie_resolution_slider_height input[type="number"]').value)
    ];
    const resImage = [
        parseInt(gradioApp().querySelector('#pcm_pie_image_resolution_text_w').textContent),
        parseInt(gradioApp().querySelector('#pcm_pie_image_resolution_text_h').textContent)
    ];
    const [MIN, MAX] = [64, 8192];
    let resTarget = [...resImage];

    // 指定されたスケールに調整
    if(sqrtPixel !== null){
        const orgPixel = Math.sqrt(resImage[0] * resImage[1]);
        for(let i=0; i<resTarget.length; i++){
            resTarget[i] = Math.round(resImage[i] * sqrtPixel / orgPixel);
            resTarget[i] = Math.round(resTarget[i] / 64) * 64; // 64 の倍数にする
        }
    }
    PCM_DEBUG_PRINT(`pcmPieSetResolutionFromImageText called : ` + 
        `sqrtPixel : ${sqrtPixel}, resSlider : ${resSlider}, resImage : ${resImage}, resTarget : ${resTarget}`);

    for(let i=0; i<resTarget.length; i++){
        if(resTarget[i] < MIN) resTarget[i] = MIN;
        if(resTarget[i] > MAX) resTarget[i] = MAX;
    }

    if(resTarget[0] !== resSlider[0] || resTarget[1] !== resSlider[1]){
        _pcmPieSetResolution(resTarget[0], resTarget[1]);
    }
}

/**
 * 解像度を設定する
 * @param {number} width - 幅
 * @param {number} height - 高さ
*/
const _pcmPieSetResolution = (width, height)=>{
    const targetContainers  = [
        gradioApp().querySelector('#pcm_pie_resolution_slider_width'),
        gradioApp().querySelector('#pcm_pie_resolution_slider_height')
    ];
    const values = [Math.round(width), Math.round(height)]; // 念のため整数に変換

    // isLocked の場合は一時的に外す
    let toggleIsLocked = false;
    if(pcmPieAspectRatioStatus.isLocked){
        toggleIsLocked = true;
        pcmPieAspectRatioStatus.toggleAspectRatio();
    }

    targetContainers.forEach((container, index)=>{
        // スライダー（range input）を取得して値を設定
        const targetRangeInput = container.querySelector('input[type="range"]');
        targetRangeInput.value = values[index];
        targetRangeInput.dispatchEvent(new Event('input', {bubbles: true}));
        
        // 数値入力（number input）を取得して値を設定
        const targetNumberInput = container.querySelector('input[type="number"]');
        targetNumberInput.value = values[index];
        targetNumberInput.dispatchEvent(new Event('input', {bubbles: true}));
    });

    // isLocked を元に戻す
    if(toggleIsLocked){
        pcmPieAspectRatioStatus.toggleAspectRatio();
    }
}

/**
 * ポーズ情報エディタの画面表示(Gradioの管轄外)を更新する
*/
const pcmPieRefresh = ()=>{
    PCM_DEBUG_PRINT('pcm_pie_refresh called');
    _pcmPieUpdateAspectRatio(); // aspect ratio (表示のみ)を更新
    _pcmPieUpdateSquareRoot(); // square root の表示更新
    // 解像度適用チェックボックスに併せて解像度スライダーの半透明化を更新
    gradioApp().querySelector('.pcm-pie-resolution-row').classList.toggle('unchecked',
        !gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox input[type="checkbox"]').checked);
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer').classList.toggle('unchecked',
        !gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox input[type="checkbox"]').checked);
};

/**
 * ポーズ情報エディタの画面表示(Gradioの管轄外)をリセットする
*/
const pcmPieResetPage = ()=>{
    PCM_DEBUG_PRINT('pcm_pie_reset_page called');
    // アスペクト比ロックを解除
    if(pcmPieAspectRatioStatus.isLocked){
        pcmPieAspectRatioStatus.toggleAspectRatio();
    }
}

/**
 * Escape で Cancel
 */
const pcmPieOnKeyDownEsc = (event)=>{
    const isOpen = !gradioApp().querySelector('#pcm_pie_container').classList.contains("hidden");
    const isKeyEvent = opts[PCM_SETTINGS_KEYS.misc.cancel_editing_with_ctrl_q]
        ? (event.ctrlKey && event.key === 'q') : event.key === 'Escape';
    if (isOpen && isKeyEvent){
        PCM_DEBUG_PRINT("Escape event.")
        event.preventDefault();
        gradioApp().querySelector('#pcm_pie_close_btn').click();
    }
};


/**
 * Ctrl-S で Save
 */
const pcmPieOnKeyDownCtrlS = (event)=>{
    if (!opts[PCM_SETTINGS_KEYS.misc.save_editing_with_ctrl_s]){return;}
    const isOpen = !gradioApp().querySelector('#pcm_pie_container').classList.contains("hidden");
    const isKeyEvent = event.ctrlKey && event.key === 's';
    if(isOpen && isKeyEvent){
        PCM_DEBUG_PRINT("Ctrl-S event.")
        event.preventDefault();
        gradioApp().querySelector('#pcm_pie_save_btn').click();
    }
}


/**
 * 解像度適用チェックボックスのコールバック
*/
const pcmPieApplyResolutionCheckboxOnchange = ()=>{
    PCM_DEBUG_PRINT('pcm_pie_apply_resolution_checkbox_onchange called : ',
        gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox input[type="checkbox"]').checked);
    // 解像度適用チェックボックスに併せて解像度スライダーの半透明化を更新
    gradioApp().querySelector('.pcm-pie-resolution-row').classList.toggle('unchecked',
        !gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox input[type="checkbox"]').checked);
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer').classList.toggle('unchecked',
        !gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox input[type="checkbox"]').checked);
}

const pcmPieInitialize = async()=>{
    PCM_DEBUG_PRINT('pcm_pie initialized');

    // キーボードショートカット
    window.addEventListener('keydown', pcmPieOnKeyDownEsc); // エスケープキー押下時にモーダルを閉じる
    window.addEventListener('keydown', pcmPieOnKeyDownCtrlS); // Ctrl-S で保存
   
    // ボタンのツールチップ
    //  - 右列データセットボタン
    gradioApp().querySelector('#pcm_pie_data_set_prpt_btn').setAttribute(
        'title', 'If the image contains png_info and prompt exists within it,\nfill the Prompt field with that value.');
    gradioApp().querySelector('#pcm_pie_data_set_neg_btn').setAttribute(
        'title', 'If the image contains png_info and negative prompt exists within it,\nfill the Negative Prompt field with that value.');
    gradioApp().querySelector('#pcm_pie_data_set_res_btn').setAttribute(
        'title', 'Set the resolution values based on the image,\nscaling them to about 1M pixels while keeping the aspect ratio.');
    //  - チェックボックス
    gradioApp().querySelector('#pcm_pie_is_replace_checkbox').setAttribute(
        'title', 'When checked, the prompt and negative prompt will be enclosed with "##>" and "##<",\n'
                 + 'and replaced by other prompt cards in replace mode.\n'
                 + 'When unchecked, the prompt and negative prompt will simply be added to the end of text.');
    gradioApp().querySelector('#pcm_pie_enable_cnet_checkbox').setAttribute(
        'title', 'When checked, CNet Send button appears on card.');
    gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox').setAttribute(
        'title', 'If checked, the resolution values will be applied to the generation parameters.\n'
                 + 'If unchecked, the resolution values will be ignored and current resolution values will be used.');
    //  - 解像度スライダ
    gradioApp().querySelector('#pcm_pie_fix_aspect_ratio_btn_wrapper').setAttribute(
        'title', 'Keep the current aspect ratio of the slider.');
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_d2').setAttribute(
        'title', 'Divide the resolution by 2.');
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_8').setAttribute(
        'title', 'Adjust the resolution to be a multiple of 8.');
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_64').setAttribute(
        'title', 'Adjust the resolution to be a multiple of 64.');
    // - フッターボタン
    gradioApp().querySelector('#pcm_pie_close_btn').setAttribute(
        'title', 'Cancel and close. [Esc]');
    gradioApp().querySelector('#pcm_pie_save_btn').setAttribute(
        'title', 'Save and close. [Ctrl-S');


    // 解像度スライダのコールバック
    gradioApp().querySelector('#pcm_pie_resolution_slider_width').addEventListener('input', pcmePieResolutionSliderOnchange);
    gradioApp().querySelector('#pcm_pie_resolution_slider_height').addEventListener('input', pcmePieResolutionSliderOnchange);

    // 解像度微調整ボタンのコールバック
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_d2').addEventListener('click', ()=>pcmPieMultipleResolution(0.5));
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_8').addEventListener('click', ()=>pcmPieAdjustResolutionToMultiple(8));
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_btn_64').addEventListener('click', ()=>pcmPieAdjustResolutionToMultiple(64));

    // 画像解像度セットボタンのコールバック
    gradioApp().querySelector('#pcm_pie_data_set_res_btn').addEventListener('click', pcmPieSetResolutionFromImageText.bind(null,1024));

    // 解像度適用チェックボックスのコールバック
    gradioApp().querySelector('#pcm_pie_apply_resolution_checkbox').addEventListener('change', pcmPieApplyResolutionCheckboxOnchange);

    // 解像度フッターのアスペクト比ボタンのコールバック
    gradioApp().querySelector('#pcm_pie_resolution_slider_footer_text_aspect_ratio_wrapper').addEventListener('click', toggleAspectRationBasis);
};

pcmWaitForContent('#pcm_pie_data_set_prpt_btn', pcmPieInitialize);