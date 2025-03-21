onUiLoaded(pcmSetupMiniGallery); // ミニギャラリーの初期化

async function pcmSetupMiniGallery(){
    // ミニギャラリーが非表示になっている場合は非表示にして終了
    const isShow = await pcmGetMiniGalleryIsShow();
    if (!isShow) {
        const galleryColumn = gradioApp().querySelector('#pcm_mini_gallery_column');
        if (galleryColumn) galleryColumn.parentElement.parentElement.style.display = 'none';
        return;
    }

    // ミニギャラリー Show Cnet が False になっている場合
    const isShowCnet = opts.prompt_cards_manager_show_cnet_values_in_mini_gallery;
    if (!isShowCnet){
        const cnetGroup = gradioApp().querySelector('#pcm_mini_gallery_cnet_group');
        if (cnetGroup) cnetGroup.style.display = 'none';
    }

    // 初期値の同期
    pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});

    // -- コールバックの登録 --
    // 画像生成時に画像をセット
    pcmSetupMiniGalleryImageObserver(); 

    // Generation Tab のコントロール群本体 -> Mini Gallery
    pcmRegisterGenerationConditionsCallbacks();

    // その他のスクリプト群からの変更に対応
    // 解像度スイッチボタン -> Mini Gallery
    const resSwitchBtn = gradioApp().querySelector('#txt2img_res_switch_btn');
    if (resSwitchBtn){
        resSwitchBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(80);
            pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});
        });
    }

    // png_inf paste ボタン -> Mini Gallery
    const pngInfPasteBtn = gradioApp().querySelector('#txt2img_tools button#paste');
    if (pngInfPasteBtn){
        pngInfPasteBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({
                update_width: true, update_height: true,
                update_cnet_enabled: true, update_cnet_weight: true, update_cnet_end_step: true
            });
        });
    }

    // Config Presets Extension ドロップダウン -> Mini Gallery
    const configPresetsExtDropdown = gradioApp().querySelector('#config_preset_txt2img_dropdown input');
    if (configPresetsExtDropdown){
        configPresetsExtDropdown.addEventListener('change', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});
        });
    }

    // Config Presets Extension Reapply ボタン -> Mini Gallery
    const scriptConfigPresetReapplyBtn = gradioApp().querySelector('#txt2img_extra_tabs #script_config_preset_reapply_button');
    if (scriptConfigPresetReapplyBtn){
        scriptConfigPresetReapplyBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});
        });
    }

    // PNG Info タブ Send to txt2img ボタン -> Mini Gallery
    const pngInfoSendToTxt2imgBtn = gradioApp().querySelector('#tab_pnginfo button#txt2img_tab');
    if (pngInfoSendToTxt2imgBtn){
        pngInfoSendToTxt2imgBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(800);
            pcmUpdateMiniGalleryControlValues({
                update_width: true, update_height: true,
                update_cnet_enabled: true, update_cnet_weight: true, update_cnet_end_step: true
            });
        });
    }
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

/** [Gradioからコール] Width : Mini Gallery -> Generation Tab (txt2img のみ) */
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

/** [Gradioからコール] Height : Mini Gallery -> Generation Tab (txt2img のみ) */
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

/** [Gradioからコール] CNet Enabled : Mini Gallery -> Generation Tab (txt2img のみ) */
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

/** [Gradioからコール] CNet Weight : Mini Gallery -> Generation Tab (txt2img のみ) */
async function pcmUpdateDefaultGalleryCNetWeight(_cnet_weight){
    selectorTmp = `#txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const weight = parseFloat(elemTmp.value);
    if (weight !== _cnet_weight){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGalleryCNetWeight change weight ${weight} -> ${_cnet_weight}`);
        elemTmp.value = _cnet_weight;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** [Gradioからコール] CNet End Step : Mini Gallery -> Generation Tab (txt2img のみ) */
async function pcmUpdateDefaultGalleryCNetEndStep(_cnet_end_step){
    selectorTmp = `#txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const endStep = parseFloat(elemTmp.value);
    if (endStep !== _cnet_end_step){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGalleryCNetEndStep change endStep ${endStep} -> ${_cnet_end_step}`);
        elemTmp.value = _cnet_end_step;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** [CallBack] Width, Height, CNet enabled : Generation Tab -> Mini Gallery (txt2img のみ)
 * 直接当該コントールを弄る場合はこれで更新
 * 別途 script で更新する場合は pcmUpdateMiniGalleryControlValues を明示的に叩かせる必要あり
*/
function pcmRegisterGenerationConditionsCallbacks(){
    const width_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="number"]');
    const width_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="range"]');
    const height_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="number"]');
    const height_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="range"]');
    const cnet_enabled_dg = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox input[type="checkbox"]');
    const cnet_weight_dg_num = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider input[type="number"]');
    const cnet_weight_dg_range = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider input[type="range"]');
    const cnet_end_step_dg_num = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider input[type="number"]');
    const cnet_end_step_dg_range = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider input[type="range"]');

    // Width (Number box)
    width_dg_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_width: true});
    });

    // Width (Range slider)
    width_dg_range.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_width: true});
    });

    // Height (Number box)
    height_dg_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_height: true});
    });

    // Height (Range slider)
    height_dg_range.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_height: true});
    });

    // CNet
    const isShowCnet = opts.prompt_cards_manager_show_cnet_values_in_mini_gallery;
    if (isShowCnet){
        // CNet Enabled
        if (cnet_enabled_dg){
            cnet_enabled_dg.addEventListener('change', (e)=>{
                pcmUpdateMiniGalleryControlValues({update_cnet_enabled: true});
            });
        }

        // CNet Weight (Number box)
        if (cnet_weight_dg_num){
            cnet_weight_dg_num.addEventListener('change', (e)=>{
                pcmUpdateMiniGalleryControlValues({update_cnet_weight: true});
            });
        }

        // CNet Weight (Range slider)
        if (cnet_weight_dg_range){
            cnet_weight_dg_range.addEventListener('change', (e)=>{
                pcmUpdateMiniGalleryControlValues({update_cnet_weight: true});
            });
        }

        // CNet End Step (Number box)
        if (cnet_end_step_dg_num){
            cnet_end_step_dg_num.addEventListener('change', (e)=>{
                pcmUpdateMiniGalleryControlValues({update_cnet_end_step: true});
            });
        }

        // CNet End Step (Range slider)
        if (cnet_end_step_dg_range){
            cnet_end_step_dg_range.addEventListener('change', (e)=>{
                pcmUpdateMiniGalleryControlValues({update_cnet_end_step: true});
            });
        }
    }
}


/** Call this function when you change Generation Resolution via script.
 * @param {boolean} update_width Default: false, if true, update width
 * @param {boolean} update_height Default: false, if true, update height
 * @param {boolean} update_cnet_enabled Default: false, if true, update cnet enabled
 * @param {boolean} update_cnet_weight Default: false, if true, update cnet weight
 * @param {boolean} update_cnet_end_step Default: false, if true, update cnet end step
*/
function pcmUpdateMiniGalleryControlValues({
    update_width= false, update_height= false,
    update_cnet_enabled= false, update_cnet_weight= false, update_cnet_end_step= false }){

    // 解像度 width
    if (update_width){
        const width =pcmGetGradioComponentByElemId("txt2img_width");
        if(width){
            const width_mg = gradioApp().querySelector('#pcm_mini_gallery_width input[type="number"]');
            if(width_mg){
                if (width.props.value !== width_mg.value){
                    width_mg.value = width.props.value;
                    updateInput(width_mg);
                }
            }
        }
    }
    // 解像度 height
    if (update_height){
        const height = pcmGetGradioComponentByElemId("txt2img_height");
        if(height){
            const height_mg = gradioApp().querySelector('#pcm_mini_gallery_height input[type="number"]');
            if(height_mg){
                if (height.props.value !== height_mg.value){
                    height_mg.value = height.props.value;
                    updateInput(height_mg);
                }
            }
        }
    }

    // CNet
    const isShowCnet = opts.prompt_cards_manager_show_cnet_values_in_mini_gallery;
    if (isShowCnet){
        // CNet Enabled
        if (update_cnet_enabled){
            const cnet_enabled = pcmGetGradioComponentByElemId("txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox");
            if(cnet_enabled){
                const cnet_enabled_mg = gradioApp().querySelector('#pcm_mini_gallery_cnet_enabled input[type="checkbox"]');
                if(cnet_enabled_mg){
                    if (cnet_enabled.props.value !== cnet_enabled_mg.checked){
                        cnet_enabled_mg.checked = cnet_enabled.props.value;
                        updateInput(cnet_enabled_mg);
                    }
                }
            }
        }

        // CNet Weight
        if (update_cnet_weight){
            const cnet_weight = pcmGetGradioComponentByElemId("txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider");
            if(cnet_weight){
                const cnet_weight_mg = gradioApp().querySelector('#pcm_mini_gallery_cnet_weight input[type="number"]');
                if(cnet_weight_mg){
                    if (cnet_weight.props.value !== cnet_weight_mg.value){
                        cnet_weight_mg.value = cnet_weight.props.value;
                        updateInput(cnet_weight_mg);
                    }
                }
            }
        }   

        // CNet End Step
        if (update_cnet_end_step){
            const cnet_end_step = pcmGetGradioComponentByElemId("txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider");
            if(cnet_end_step){
                const cnet_end_step_mg = gradioApp().querySelector('#pcm_mini_gallery_cnet_end_step input[type="number"]');
                if(cnet_end_step_mg){
                    if (cnet_end_step.props.value !== cnet_end_step_mg.value){
                        cnet_end_step_mg.value = cnet_end_step.props.value;
                        updateInput(cnet_end_step_mg);
                    }
                }
            }
        }
    }
}
