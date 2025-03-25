/** Mini Gallery の初期化 */
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

    document.querySelector("#pcm_mini_gallery_switch_btn").setAttribute("title", "Switch width/height");

    // 初期値の同期
    pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});

    // -- コールバックの登録 --
    // 画像生成時に画像をセット
    pcmSetupMiniGalleryImageObserver(); 

    // Generation Tab のコントロール群本体 -> Mini Gallery
    pcmRegisterGenerationConditionsCallbacks();

    // その他のスクリプト群からの変更に対応
    // Generation Tab の解像度スイッチボタン -> Mini Gallery
    const resSwitchBtn = gradioApp().querySelector('#txt2img_res_switch_btn');
    if (resSwitchBtn){
        resSwitchBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(80);
            pcmUpdateMiniGalleryControlValues({update_width: true, update_height: true});
        });
    }

    // Mini Gallery : 解像度スイッチボタン -> Generation Tab
    const miniGalleryResSwitchBtn = gradioApp().querySelector('#pcm_mini_gallery_switch_btn');
    if (miniGalleryResSwitchBtn){
        miniGalleryResSwitchBtn.addEventListener('click', async (e)=>{
            pcmMinigallerySwitchWidthHeight();
        });
    }

    // Mini Gallery : Seed Random ボタン -> Generation Tab
    const miniGallerySeedRandomBtn = gradioApp().querySelector('button#pcm_mini_gallery_seed_rnd');
    if (miniGallerySeedRandomBtn){
        miniGallerySeedRandomBtn.addEventListener('click', async (e)=>{
            pcmMinigallerySeedRandom();
        });
    }

    // Mini Gallery : Seed Reuse ボタン -> Generation Tab
    const miniGallerySeedReuseBtn = gradioApp().querySelector('button#pcm_mini_gallery_seed_reuse');
    if (miniGallerySeedReuseBtn){
        miniGallerySeedReuseBtn.addEventListener('click', async (e)=>{
            pcmMinigallerySeedReuse();
        });
    }

    // Mini Gallery : Seed Extra Random ボタン -> Generation Tab
    const miniGallerySeedExtraRandomBtn = gradioApp().querySelector('button#pcm_mini_gallery_subseed_rnd');
    if (miniGallerySeedExtraRandomBtn){
        miniGallerySeedExtraRandomBtn.addEventListener('click', async (e)=>{
            pcmMinigallerySeedExtraRandom();
        });
    }

    // Mini Gallery : Seed Extra Reuse ボタン -> Generation Tab
    const miniGallerySeedExtraReuseBtn = gradioApp().querySelector('button#pcm_mini_gallery_subseed_reuse');
    if (miniGallerySeedExtraReuseBtn){
        miniGallerySeedExtraReuseBtn.addEventListener('click', async (e)=>{
            pcmMinigallerySeedExtraReuse();
        });
    }

    // png_inf paste ボタン -> Mini Gallery
    const pngInfPasteBtn = gradioApp().querySelector('#txt2img_tools button#paste');
    if (pngInfPasteBtn){
        pngInfPasteBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(500);
            pcmUpdateMiniGalleryControlValues({
                update_width: true, update_height: true,
                update_seed: true, update_seed_extra_cbx: true, update_seed_extra: true, update_seed_extra_strength: true,
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
                update_seed: true, update_seed_extra_cbx: true, update_seed_extra: true, update_seed_extra_strength: true,
                update_cnet_enabled: true, update_cnet_weight: true, update_cnet_end_step: true
            });
        });
    }

    // Seed Random ボタン -> Mini Gallery
    const seedRandomBtn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_random_seed');
    if (seedRandomBtn){
        seedRandomBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_seed: true});
        });
    }

    // Seed Reuse ボタン -> Mini Gallery
    const seedReuseBtn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_reuse_seed');
    if (seedReuseBtn){
        seedReuseBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_seed: true});
        });
    }

    // Seed Extra Random ボタン -> Mini Gallery
    const seedExtraRandomBtn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_random_subseed');
    if (seedExtraRandomBtn){
        seedExtraRandomBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_seed_extra: true});
        });
    }

    // Seed Extra Reuse ボタン -> Mini Gallery
    const seedExtraReuseBtn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_reuse_subseed');
    if (seedExtraReuseBtn){
        seedExtraReuseBtn.addEventListener('click', async (e)=>{
            await pcmSleepAsync(100);
            pcmUpdateMiniGalleryControlValues({update_seed_extra: true});
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

/** [Gradioからコール] Seed : Mini Gallery -> Generation Tab (txt2img のみ) */
function pcmUpdateDefaultGallerySeed(_seed){
    selectorTmp = `#txt2img_seed input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const seed = parseInt(elemTmp.value);
    if (seed !== _seed){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySeed change seed ${seed} -> ${_seed}`);
        elemTmp.value = _seed;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** [Gradioからコール] Seed Extra Checkbox : Mini Gallery -> Generation Tab (txt2img のみ) */
function pcmUpdateDefaultGallerySeedExtraCb(_seed_extra_cb){
    selectorTmp = `#txt2img_subseed_show input[type="checkbox"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const seed_extra_cb = elemTmp.checked;
    if (seed_extra_cb !== _seed_extra_cb){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySeedExtraCb change seed_extra_cb ${seed_extra_cb} -> ${_seed_extra_cb}`);
        elemTmp.checked = _seed_extra_cb;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** [Gradioからコール] V.Seed : Mini Gallery -> Generation Tab (txt2img のみ) */
function pcmUpdateDefaultGallerySeedExtra(_seed_extra){
    selectorTmp = `#txt2img_subseed input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const seed_extra = parseInt(elemTmp.value);
    if (seed_extra !== _seed_extra){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySeedExtra change seed_extra ${seed_extra} -> ${_seed_extra}`);
        elemTmp.value = _seed_extra;
        updateInput(elemTmp); // only input event (change event not fired)
    }
}

/** [Gradioからコール] Seed Extra Strength : Mini Gallery -> Generation Tab (txt2img のみ) */
function pcmUpdateDefaultGallerySeedExtraStrength(_seed_extra_strength){
    selectorTmp = `#txt2img_subseed_strength input[type="number"]`;
    elemTmp = gradioApp().querySelector(selectorTmp);
    if (!elemTmp) return;
    const seed_extra_strength = parseFloat(elemTmp.value);
    if (seed_extra_strength !== _seed_extra_strength){
        PCM_DEBUG_PRINT(`pcmUpdateDefaultGallerySeedExtraStrength change seed_extra_strength ${seed_extra_strength} -> ${_seed_extra_strength}`);
        elemTmp.value = _seed_extra_strength;
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

/** [直接のCallBackを登録] Width, Height, Seed, CNet enabled : Generation Tab -> Mini Gallery (txt2img のみ)
 * 直接当該コントールを弄る場合の更新処理を登録
 * 別途 script で更新する場合は別途個別に pcmUpdateMiniGalleryControlValues を登録する
*/
function pcmRegisterGenerationConditionsCallbacks(){
    const width_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="number"]');
    const width_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_width input[type="range"]');
    const height_dg_num = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="number"]');
    const height_dg_range = gradioApp().querySelector('#txt2img_column_size #txt2img_height input[type="range"]');

    const seed_dg_num = gradioApp().querySelector('#txt2img_seed input[type="number"]');
    const seed_dg_rnd_btn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_random_seed');
    const seed_dg_reuse_btn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_reuse_seed');
    const seed_dg_extra_cbx = gradioApp().querySelector('#txt2img_subseed_show input[type="checkbox"]');
    
    const seed_dg_extra_num = gradioApp().querySelector('#txt2img_subseed input[type="number"]');
    const seed_dg_extra_rnd_btn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_random_subseed');
    const seed_dg_extra_reuse_btn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_reuse_subseed');
    const seed_dg_extra_strength_num = gradioApp().querySelector('#txt2img_subseed_strength input[type="number"]');
    const seed_dg_extra_strength_range = gradioApp().querySelector('#txt2img_subseed_strength input[type="range"]');
    
    const cnet_enabled_dg = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_enable_checkbox input[type="checkbox"]');
    const cnet_weight_dg_num = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider input[type="number"]');
    const cnet_weight_dg_range = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_control_weight_slider input[type="range"]');
    const cnet_end_step_dg_num = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider input[type="number"]');
    const cnet_end_step_dg_range = gradioApp().querySelector('#txt2img_controlnet_ControlNet-0_controlnet_ending_control_step_slider input[type="range"]');

    // Resolution
    //  - Width (Number box)
    width_dg_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_width: true});
    });

    //  - Width (Range slider)
    width_dg_range.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_width: true});
    });

    //  - Height (Number box)
    height_dg_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_height: true});
    });

    //  - Height (Range slider)
    height_dg_range.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_height: true});
    });

    // Seed
    //  - Seed (Number box)
    seed_dg_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_seed: true});
    });

    //  - Seed Extra Checkbox
    seed_dg_extra_cbx.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_seed_extra_cbx: true});
    });

    //  - Seed Extra (Number box)   
    seed_dg_extra_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_seed_extra: true});
    });

    //  - Seed Extra (Number box)
    seed_dg_extra_strength_num.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_seed_extra_strength: true});
    }); 

    //  - Seed Extra (Range slider)
    seed_dg_extra_strength_range.addEventListener('change', (e)=>{
        pcmUpdateMiniGalleryControlValues({update_seed_extra_strength: true});
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

/** Update all Mini Gallery values. Call this function when you change Generation Resolution via script.
 * @param {boolean} update_width Default: false, if true, update width
 * @param {boolean} update_height Default: false, if true, update height
 * @param {boolean} update_seed Default: false, if true, update seed
 * @param {boolean} update_seed_extra_cbx Default: false, if true, update seed extra checkbox
 * @param {boolean} update_seed_extra Default: false, if true, update seed extra
 * @param {boolean} update_seed_extra_strength Default: false, if true, update seed extra strength
 * @param {boolean} update_cnet_enabled Default: false, if true, update cnet enabled
 * @param {boolean} update_cnet_weight Default: false, if true, update cnet weight
 * @param {boolean} update_cnet_end_step Default: false, if true, update cnet end step
*/
function pcmUpdateMiniGalleryControlValues({
    update_width= false, update_height= false,
    update_seed= false, update_seed_extra_cbx= false, update_seed_extra= false, update_seed_extra_strength= false,
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

    // Seed
    if (update_seed){
        const seed = pcmGetGradioComponentByElemId("txt2img_seed");
        if (seed){
            const seed_mg = gradioApp().querySelector('#pcm_mini_gallery_seed_input input[type="number"]');
            if (seed_mg){
                if (seed.props.value !== seed_mg.value){
                    seed_mg.value = seed.props.value;
                    updateInput(seed_mg);
                }
            }
        }
    }

    // Seed Extra
    if (update_seed_extra){
        const seed_extra = pcmGetGradioComponentByElemId("txt2img_subseed");
        if (seed_extra){
            const seed_extra_mg = gradioApp().querySelector('#pcm_mini_gallery_subseed_input input[type="number"]');
            if (seed_extra_mg){
                if (seed_extra.props.value !== seed_extra_mg.value){
                    seed_extra_mg.value = seed_extra.props.value;
                    updateInput(seed_extra_mg);
                }
            }
        }
    }

    // Seed Extra Checkbox
    if (update_seed_extra_cbx){
        const seed_extra_cbx = pcmGetGradioComponentByElemId("txt2img_subseed_show");
        if (seed_extra_cbx){
            const seed_extra_cbx_mg = gradioApp().querySelector('#pcm_mini_gallery_subseed_checkbox input[type="checkbox"]');
            if (seed_extra_cbx_mg){
                if (seed_extra_cbx.props.value !== seed_extra_cbx_mg.checked){
                    seed_extra_cbx_mg.checked = seed_extra_cbx.props.value;
                    updateInput(seed_extra_cbx_mg);
                }
            }
        }
    }

    // Seed Extra Strength
    if (update_seed_extra_strength){
        const seed_extra_strength = pcmGetGradioComponentByElemId("txt2img_subseed_strength");
        if (seed_extra_strength){
            const seed_extra_strength_mg = gradioApp().querySelector('#pcm_mini_gallery_subseed_strength input[type="number"]');
            if (seed_extra_strength_mg){
                if (seed_extra_strength.props.value !== seed_extra_strength_mg.value){
                    seed_extra_strength_mg.value = seed_extra_strength.props.value;
                    updateInput(seed_extra_strength_mg);
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

/** [DOM内] Mini Gallery Switch width and height Button */
function pcmMinigallerySwitchWidthHeight(){
    const _width_elem = gradioApp().querySelector('#pcm_mini_gallery_width input[type="number"]');
    const _height_elem = gradioApp().querySelector('#pcm_mini_gallery_height input[type="number"]');
    if (!_width_elem || !_height_elem) return;

    const _width = parseInt(_width_elem.value);
    const _height = parseInt(_height_elem.value);

    if (_width !== _height){
        const tmp = _width;
        _width_elem.value = _height;
        _height_elem.value = tmp;
        updateInput(_width_elem);
        updateInput(_height_elem);

        // Update Generation Tab
        let selectorTmp = `#txt2img_column_size #txt2img_width input[type="number"]`;
        let elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;
        const width = parseInt(elemTmp.value);
        if (width !== _width){
            elemTmp.value = _width;
            updateInput(elemTmp);
        }

        selectorTmp = `#txt2img_column_size #txt2img_height input[type="number"]`;
        elemTmp = gradioApp().querySelector(selectorTmp);
        if (!elemTmp) return;
        const height = parseInt(elemTmp.value);
        if (height !== _height){
            elemTmp.value = height;
            updateInput(elemTmp);
        }
    }
}

/** [DOM内] Mini Gallery Seed Random Button */
function pcmMinigallerySeedRandom(){
    const seed_dg_rnd_btn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_random_seed');
    if (!seed_dg_rnd_btn) return;
    seed_dg_rnd_btn.click();
}

/** [DOM内] Mini Gallery Seed Reuse Button */
function pcmMinigallerySeedReuse(){
    const seed_dg_reuse_btn = gradioApp().querySelector('#txt2img_seed_row button#txt2img_reuse_seed');
    if (!seed_dg_reuse_btn) return;
    seed_dg_reuse_btn.click();
}

/** [DOM内] Mini Gallery Seed Extra Random Button */
function pcmMinigallerySeedExtraRandom(){
    const seed_dg_extra_rnd_btn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_random_subseed');
    if (!seed_dg_extra_rnd_btn) return;
    seed_dg_extra_rnd_btn.click();
}

/** [DOM内] Mini Gallery Seed Extra Reuse Button */
function pcmMinigallerySeedExtraReuse(){
    const seed_dg_extra_reuse_btn = gradioApp().querySelector('#txt2img_seed_extras button#txt2img_reuse_subseed');
    if (!seed_dg_extra_reuse_btn) return;
    seed_dg_extra_reuse_btn.click();
}

onUiLoaded(pcmSetupMiniGallery); // ミニギャラリーの初期化