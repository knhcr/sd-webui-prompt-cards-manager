function pcmSetupMiniGalleryObserver() {
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

        const hiddenTxt = gradioApp().querySelector('#pcm_mini_gallery_hidden_txt textarea');
        if (ret && hiddenTxt) {
            PCM_DEBUG_PRINT(`updateMiniGallery called: ${ret}`);
            hiddenTxt.value = ret;
            hiddenTxt.dispatchEvent(new Event('input', {bubbles:true}));
        }else{
            PCM_DEBUG_PRINT(`updateMiniGallery failed: ${images}`);
        }
    }
}

onUiLoaded(pcmSetupMiniGalleryObserver);