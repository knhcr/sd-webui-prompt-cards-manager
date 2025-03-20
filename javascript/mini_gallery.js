onUiLoaded(pcmSetupMiniGallery); // ミニギャラリーの初期化

async function pcmSetupMiniGallery(){
    const isShow = await pcmGetMiniGalleryIsShow();
    if (!isShow) {
        const galleryColumn = gradioApp().querySelector('#pcm_mini_gallery_column');
        if (galleryColumn) galleryColumn.parentElement.parentElement.style.display = 'none';
        return;
    }

    pcmSetupMiniGalleryImageObserver(); // 画像生成時に画像をセット
    pcmSetupGenerationConditionsObservers(); // 解像度とCNET-unit0の有効/無効を監視
}


/** OnUiLoaded のタイミングはかなり早いので Settings の初期化が完了するまで待機して結果を返す */
async function pcmGetMiniGalleryIsShow(){
    if (opts.prompt_cards_manager_show_mini_gallery === undefined) {
        for (let i = 0; i < 50; i++){
            await pcmSleepAsync(100);
            if (opts.prompt_cards_manager_show_mini_gallery !== undefined){
                break;
            }
        }
    }
    PCM_DEBUG_PRINT(`pcmIsMiniGalleryShowOption: prompt_cards_manager_show_mini_gallery ${opts.prompt_cards_manager_show_mini_gallery}`);
    return opts.prompt_cards_manager_show_mini_gallery;
}


/** 画像生成を監視して Mini Gallery に画像を転送 */
function pcmSetupMiniGalleryImageObserver() {
    // 画像生成時の動作
    //  - Gallery はイメージ選択時と非選択時でDOMの構造が変わるため監視対象が複数必要
    //    + どちらのモードでも #txt2img_gallery .grid-wrap > .grid-container > button.thumbnail-item > img は存在
    //    + 当該<img>は一度生成後は常に 1つ以上は存在する筈 (src 属性が代わり、複数枚バッチ or マスク生成の場合は増減する)
    //    + 選択モードでは同じセレクタで引っかかる要素がもう1セット生成される場合がある？ので重複チェックが必要
    //  - 初回の生成前は txt2img_gallery は殆ど空の状態で内部のコンテナごと生成される
    const images_selector = '#txt2img_gallery .grid-wrap > .grid-container > button.thumbnail-item > img';
    let isInitial = true;
    const o1 = new MutationObserver((ms1, o1) => {
        // 初回の生成前は #txt2img_gallery のノード生成を監視
        for (const m1 of ms1) {
            if (m1.type === 'childList' && m1.addedNodes.length > 0) {
                const images = Array.from(gradioApp().querySelectorAll(images_selector));

                // 1回の生成処理で監視に複数回引っかかるため、images が空でない、かつ、初回のみ処理する
                if (images.length > 0 && isInitial) {
                    PCM_DEBUG_PRINT(`updateMiniGallery observer initial detected: ${images.length} images`);
                    isInitial = false;
                    updateMiniGallery(images);

                    // 初回用の監視は切断して、2回目以降の生成処理用の監視を登録
                    o1.disconnect();
                    const o2 = new MutationObserver((ms2, o2)=>{
                        for (const m2 of ms2) {
                            if (m2.type === 'attributes' && m2.attributeName === 'src') {
                                const images = Array.from(gradioApp().querySelectorAll(images_selector));
                                PCM_DEBUG_PRINT(`updateMiniGallery observer after initial detected: ${images.length} images`);
                                updateMiniGallery(images);
                            }
                        }
                    });
                    // 監視登録 
                    // 2回目以降は #txt2img_gallery .grid-wrap > .grid-container > button.thumbnail-item > img の第一要素の src 属性を監視)
                    const imgElement = gradioApp().querySelector('#txt2img_gallery .grid-wrap > .grid-container > button.thumbnail-item > img');
                    if (imgElement){
                        PCM_DEBUG_PRINT(`updateMiniGallery observer after initial observe started`);
                        o2.observe(imgElement, { attributes: true, subtree: false });
                    }
                }
            }
        }
    });

    // 監視登録 (#txt2img_gallery)
    const gallery = gradioApp().querySelector('#txt2img_gallery');
    if (gallery){
        o1.observe(gallery, { childList: true, subtree: true });
    }

    /** 
     * ミニギャラリー更新処理の実体
     * タイムスタンプ付きのフル物理パス(html escaped) (<image_fullpath>?123456789.1234567) を python に渡す
     * 複数ある場合は '$' セパレートで纏めて渡す
     * @param {string[]} images タイムスタンプ付きのフル物理パス(html escaped) (http://<host>/file=<image_fullpath>?123456789.1234567) の配列
    */
    function updateMiniGallery(images) {
        let ret = [];
        if (images) {
            PCM_DEBUG_PRINT(`updateMiniGallery num images: ${images.length}`);
            ret = [...new Set(images)];
            ret = ret.map(x=>x.src.split('/file=')[1]); // タイムスタンプは付けたまま渡す
            ret = ret.join('$');
        }

        const hiddenTxt = gradioApp().querySelector('#pcm_mini_gallery_hidden_txt_image textarea');
        if (ret && hiddenTxt) {
            PCM_DEBUG_PRINT(`updateMiniGallery called: ${ret}`);
            hiddenTxt.value = ret;
            hiddenTxt.dispatchEvent(new Event('input', {bubbles:true}));
        }else{
            PCM_DEBUG_PRINT(`updateMiniGallery failed: ${images}`);
        }
    }
}

/**Width : Mini Gallery -> Default Gallery (txt2img のみ) */
function pcmUpdateDefaultGallerySliderWidth(_width){
    selectorTmp = `#txt2img_column_size #txt2img_width input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const width = parseInt(elemTmp.value);
    if (width !== _width){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySliderWidth change width ${width} -> ${_width}`);
        elemTmp.value = _width;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** Height : Mini Gallery -> Default Gallery (txt2img のみ) */
function pcmUpdateDefaultGallerySliderHeight(_height){
    selectorTmp = `#txt2img_column_size #txt2img_height input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const height = parseInt(elemTmp.value);
    if (height !== _height){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySliderHeight change height ${height} -> ${_height}`);
        elemTmp.value = _height;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** CNet Enabled : Mini Gallery -> CNet Unit 0 (txt2img のみ) */
async function pcmUpdateDefaultGalleryCNetEnabled(_cnet_enabled){
    // CNetが有効になっていなければ Enable ボタンをクリック
    selectorTmp = `#txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox input[type='checkbox']`
    if(!(elemTmp = pcmGetElement(selectorTmp))){
        console.error(`Prompt Cards Manager Error. txt2img ControlNet Unit 0 Enable Checkbox not found`);
        return;
    }
    statusTmp = pcmGetGradioComponentByElemId(`txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox`)
    if(statusTmp){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGalleryCNetEnabled clicked: input=${_cnet_enabled}, tmp=${statusTmp.props.value}`);
        if(statusTmp.props.value !== _cnet_enabled){
            elemTmp.click(); 
            await pcmSleepAsync(10);
        }
    }
}


/** Width : Default Gallery -> Mini Gallery (txt2img のみ) */
/*
function pcmSetupMiniGallerySliderObserver(){
    const width_mg = gradioApp().querySelector('#pcm_mini_gallery_width input[type="number"]');
    if (!width_mg) PCM_DEBUG_PRINT(`!!! pcmSetupMiniGallerySliderObserver width_mg not found`);
    const height_mg = gradioApp().querySelector('#pcm_mini_gallery_height input[type="number"]');
    const cnet_enabled_mg = gradioApp().querySelector('#pcm_mini_gallery_cnet_enabled input[type="checkbox"]');
    
    
    PCM_DEBUG_PRINT(`pcmSetupMiniGallerySliderObserver observe started`);
    ow = new MutationObserver((mws, ow)=>{
        PCM_DEBUG_PRINT(`pcmSetupMiniGallerySliderObserver observed`);
        for (const mw of mws){
            if (mw.type === 'attributes' && mw.attributeName === 'value'){
                PCM_DEBUG_PRINT(`pcmSetupMiniGallerySliderObserver width changed: width=${mw.target.value}, width_m=${width_mg.value}`);
                const width = parseInt(mw.target.value);
                if (width_mg && width_mg.value !== width){
                    width_mg.value = width; // Event Dispatch はしない
                }
            }
        }
    });

    const width_dg = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="number"]');
    if (width_dg) ow.observe(width_dg, { attributes: true, subtree: false });

}
*/

/** 
 * Generation タブの解像度とCNET-unit0の有効/無効を Mini Gallery に反映
 * 値が同じ場合はスキップ
 * */
function pcmSetupGenerationConditionsObservers(){
    const width_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="number"]');
    const width_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="range"]');
    const height_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="number"]');
    const height_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="range"]');
    const cnet_enabled_dg = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox input[type="checkbox"]');

    const width_mg = gradioApp().querySelector('#pcm_mini_gallery_width input[type="number"]');
    const height_mg = gradioApp().querySelector('#pcm_mini_gallery_height input[type="number"]');
    const cnet_enabled_mg = gradioApp().querySelector('#pcm_mini_gallery_cnet_enabled input[type="checkbox"]');

    if (!width_dg_num || !width_mg){
        return;
    }

    // Width の数値ボックス変更時
    width_dg_num.addEventListener('change', (e)=>{
        PCM_DEBUG_PRINT(`pcm_mini_gallery_width_change num: ${e.target.value}`);
        if(e.target.value !== width_mg.value){
            _updateMiniGalleryControlValues(e.target.value, "width");
        }
    });

    // Width のスライダー変更時
    width_dg_range.addEventListener('change', (e)=>{
        PCM_DEBUG_PRINT(`pcm_mini_gallery_width_change range: ${e.target.value}`);
        if(e.target.value !== width_mg.value){
            _updateMiniGalleryControlValues(e.target.value, "width");
        }
    });

    // Height の数値ボックス変更時
    height_dg_num.addEventListener('change', (e)=>{
        PCM_DEBUG_PRINT(`pcm_mini_gallery_height_change num: ${e.target.value}`);
        if(e.target.value !== height_mg.value){
            _updateMiniGalleryControlValues(e.target.value, "height");
        }
    });

    // Height のスライダー変更時
    height_dg_range.addEventListener('change', (e)=>{
        PCM_DEBUG_PRINT(`pcm_mini_gallery_height_change range: ${e.target.value}`);
        if(e.target.value !== height_mg.value){
            _updateMiniGalleryControlValues(e.target.value, "height");
        }
    });

    // CNet Enabled のチェックボックス変更時 (a1111 の場合は存在しないためスキップ)
    if (cnet_enabled_dg){
        cnet_enabled_dg.addEventListener('change', (e)=>{
            PCM_DEBUG_PRINT(`pcm_mini_gallery_cnet_enabled_change: ${e.target.checked}`);
            if(e.target.checked !== cnet_enabled_mg.checked){
                _updateMiniGalleryControlValues(e.target.checked, "cnet_enabled");
            }
        });
    }

    /**
     * Mini Gallery の値を変更
     */
    function _updateMiniGalleryControlValues(value, type){
        if (type === "width" && value !== width_mg.value){
            width_mg.value = value;
            updateInput(width_mg);
        }else if (type === "height" && value !== height_mg.value){
            height_mg.value = value;
            updateInput(height_mg);
        }else if (type === "cnet_enabled" && value !== cnet_enabled_mg.checked){
            cnet_enabled_mg.checked = value;
            updateInput(cnet_enabled_mg);
        }
    }
}
