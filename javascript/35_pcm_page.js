/* 初回クリックされるまでタブボタンに EventHandler を貼り直し続ける */ 
const pcmSetPromptCardsTabOnClickAsync = async ()=>{
    let isTabOpenedOnce = {txt2img: false, img2img: false};
    let obs = new MutationObserver((ms, o)=>{
        // 変更が発生した tabname の特定
        let tabname = null;
        for (const tmp of ['txt2img', 'img2img']){
            const container = document.querySelector(`#${tmp}_extra_tabs > .tab-nav`);
            if (container && container.contains(ms[0].target)){
                tabname = tmp;
                break;
            }
        }
        if (!tabname) return;
        // 両方のタブが初回クリック完了後はもう不要
        if (isTabOpenedOnce["img2img"] && isTabOpenedOnce["txt2img"]){
            o.disconnect();
            return;
        }

        if (isTabOpenedOnce[tabname]) return; // 今のタブがクリックされている場合は不要

        // PromptCards タブボタンの取得
        const elem = pcmGetElementBySelectorAndText(`#${tabname}_extra_tabs button`, 'PromptCards');
        if(!elem) return;

        // event handler をセット
        if (!elem.hasAttribute('pcm-onclick-set')){ // 初期化済みマークを付けて既に貼られているか判定
            elem.toggleAttribute('pcm-onclick-set', true);
            elem.addEventListener('click', async ()=>{
                PCM_DEBUG_PRINT(`pcmPromptCards Tab OnClick: ${tabname}`);
                isTabOpenedOnce[tabname] = true;
                await pcmSleepAsync(100);
                //await PcmCardSearch.updateCards(tabname); // カードリスト更新
                const rootElem = await pcmQuerySelectorAsync(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree > ul > li > div`)
                if(!rootElem) return;
                pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
                pcmTreeViewSetLeafDirMark(tabname); // ツリービューの葉ノードにマークをセット
                rootElem.click();
                pcmApplyShowOptions(tabname); // 表示オプションの適用
            });
        }
    });
    for (const tabname of ['txt2img', 'img2img']){
        obs.observe(document.querySelector(`#${tabname}_extra_tabs > .tab-nav`), {childList: true, subtree: false});
    }
};


/**
 * PromptCards の applyFilter(), applySort() の差し替え
 * - フィルタリングもソートも独自実装のため標準機能による処理は不要
 *   + 特に reforge の場合は処理をバイパスしないとカードが全て消されてしまう
 * - DOM のリフレッシュ処理が終わった後のコールバックとして再利用する
 *   + refresh() の処理後だけでなく、extranewtowks tab のボタンを押した時もコールされる
 *     - 直前に呼ばれる extraNetworksTabSelected() にモンキーパッチを当てることで対処
 * 
 * [元々の処理の概要] 
 * - カードのリフレッシュ時にapplyExtraNetworkFilter() がコールされる
 *   + 中身は extraNetworksApplyFilter[tabname_full] のコール
 * - extraNetworksApplyFilter[tabname_full] は setupExtraNetworksForTab() で初期化され、個別のタブ毎に生成された内部関数 applyFilter() が登録されている
 * - applyFilter() の最後には applySort() もコールされる
 * 
 * [reforge 対応] 
 * - reforge 版の applySort() は `#${tabname_full}_cards` の innerHTML を空にしてから
 *   div.card で引っ掛けた要素をソートして DOM として埋め込む処理に変更されている
 * - 従って card 以外のカスタムクラスだと applySort() を通った時点で DOM が空になってしまう
 */
async function pcmSetApplyFunctions(){
    PCM_DEBUG_PRINT(`pcmSetApplyFunctions called`);
    const tabnames = ['txt2img', 'img2img'];
    
    // setupExtraNetworksForTab() が終わるまで待機
    let isSetupFinished = false;
    while(!isSetupFinished){
        let flags = [];
        for (const tabname of tabnames){
            const tabname_full = `${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}`;
            if(typeof extraNetworksApplyFilter[tabname_full] !== undefined) flags.push(true);
            else flags.push(false);
            
            if(typeof extraNetworksApplySort[tabname_full] !== undefined) flags.push(true);
            else flags.push(false);
        }
        if(flags.every(x => x)){
            isSetupFinished = true;
        }
        await pcmSleepAsync(100);
    }

    // applyFilter()
    for (const tabname of tabnames){
        const tabname_full = `${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}`;

        extraNetworksApplyFilter[tabname_full] = (flag)=>{
            // use this as refresh finished callback
            PCM_DEBUG_PRINT(`pcm applyFilter() : refresh DOM finished: ${tabname_full}, flag = ${flag}`);
            const tabname = tabname_full.slice(0, tabname_full.indexOf(PCM_EXTRA_NETWORKS_TABNAME)-1);

            // タブからのコール回数のカウンタを確認してカードデータを更新するかどうかを決める
            let needUpdateCards = false;
            if (typeof window.pcm_apply_filter_call_count_from_tab !== 'object'){
                window.pcm_apply_filter_call_count_from_tab = {};
                window.pcm_apply_filter_call_count_from_tab[tabname] = 0;
            }
            PCM_DEBUG_PRINT(`applyFilter() call from tab counter ${tabname} : ${window.pcm_apply_filter_call_count_from_tab[tabname]}`);
        
            if (window.pcm_apply_filter_call_count_from_tab[tabname] === 0){
                needUpdateCards = true;
            }else{
                // タブからのコールであることを示すカウンタをデクリメント
                window.pcm_apply_filter_call_count_from_tab[tabname] -= 1;
                
                // ページロード後の初回のコールの場合
                // DOM は前回終了時のキャッシュが読み込まれるが、カードサーチ情報はキャッシュされないので、取得する必要あり
                if (typeof window.pcm_card_data_initialized !== 'object'){
                    window.pcm_card_data_initialized = {};
                    if (!tabname in window.pcm_card_data_initialized){
                        window.pcm_card_data_initialized[tabname] = false;
                    }
                }
                if (!window.pcm_card_data_initialized[tabname]){
                    needUpdateCards = true;
                    window.pcm_card_data_initialized[tabname] = true;
                }
            }

            // カードデータを更新する必要がある場合はコール
            if (needUpdateCards){
                pcmOnRefreshEnd(tabname);
            }
        };
    }

    // applySort()
    for (const tabname of tabnames){
        const tabname_full = `${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}`;
        extraNetworksApplySort[tabname_full] = ()=>{};
    }
    PCM_DEBUG_PRINT(`pcmSetApplyFunctions finished`);
};


/** DOM リフレッシュ終了時の処理 */
async function pcmOnRefreshEnd(tabname){
    await PcmCardSearch.updateCards(tabname); // card 検索用内部データの更新
    PcmCardSearch.updateDom(tabname); // 新しいマッチ結果を DOM に反映
    pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
    pcmTreeViewSetLeafDirMark(tabname); // ツリービューのリーフノードにマークをセット
    pcmApplyShowOptions(tabname); // 表示オプションの適用
}


/** モンキーパッチ : ExtraNetworks Tab の遷移時のコールバックに、tab 遷移が契機であることを示すフラグをセットさせる */
function pcmPatchTabSelected(){
    const extraNetworksTabSelected_org = window.extraNetworksTabSelected; // original

    function extraNetworksTabSelected(tabname, id, showPrompt, showNegativePrompt, tabname_full){
        if (tabname_full.toLowerCase().includes(PCM_EXTRA_NETWORKS_TABNAME)){
            // PCM の場合タブからのコールであることを示すカウンタをインクリメント
            if (typeof window.pcm_apply_filter_call_count_from_tab !== 'object'){
                window.pcm_apply_filter_call_count_from_tab = {};
                window.pcm_apply_filter_call_count_from_tab[tabname] = 0;
            }
            window.pcm_apply_filter_call_count_from_tab[tabname] += 1;
        }

        // 元の関数をコール
        extraNetworksTabSelected_org(tabname, id, showPrompt, showNegativePrompt, tabname_full);
    }

    window.extraNetworksTabSelected = extraNetworksTabSelected;
};


/** 見た目の初期化 */ 
const pcmInitializePage = async()=>{
    // Forge の場合は tree dir view の幅を調整
    const settings = await pcmGetSettingsAsync();
    if (settings && settings.IS_FORGE && !settings.IS_REFORGE){
        const _dedent = (str, indent=1)=>{
            return str.replace(new RegExp(`^(?:    ){${indent}}`, 'gm'), '');
        };
        let style =`
            #txt2img_promptcards_tree, #img2img_promptcards_tree{
                width: 300px;
                flex: none;
            }`;
        style = _dedent(style, 3);

        const styleElem = document.createElement('style');
        styleElem.textContent = style;
        document.head.appendChild(styleElem);
    }
};


/** カードの thumbsName (複数可) を指定して当該カードのみを更新する
 * DOM の差し替え, cardSearch の情報の更新, updateMatch のコール
 * 
 * 現状の用途はカードエディタでカード情報を更新した際のコールバック 
 *  - この場合tabname は判らないため、txt2img, img2img の両方を処理する
  * @param {string[] or string} thumbsNames <thumbsName>$timestamp or その配列
 * @param {string} tabname txt2img or img2img or null (null の場合は両方)
*/
const pcmUpdateCards = async (thumbsNames, tabname=null)=>{
    PCM_DEBUG_PRINT(`pcmUpdateCards: ${thumbsNames}`);
    if(!thumbsNames) return;
    if (typeof thumbsNames === 'string'){
        thumbsNames = [thumbsNames];
    }

    thumbsNames = thumbsNames.map(x => x.split("$")[0]);

    // 更新済みカードを取得
    const queryDict = thumbsNames.map(thumbsName => ({thumbsName: thumbsName}));
    const newData = await fetch(`${PCM_API_ENDPOINT_BASE}/cards`, {
        method: 'POST',
        body: JSON.stringify(queryDict)
    });
    const jsonData = await newData.json();
    //console.log(jsonData);
    //{
    //    "thumbsName": {
    //        "txt2img": "<div class='pcm-card'>...</div>",
    //        "img2img": "<div class='pcm-card'>...</div>",
    //        "cardData": {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}}
    //    }
    //}

    let targetTabnames = [];

    if (tabname === 'txt2img')      targetTabnames = ['txt2img'];
    else if (tabname === 'img2img') targetTabnames = ['img2img'];
    else if (tabname === null)      targetTabnames = ['txt2img', 'img2img'];

    for (const tabname of targetTabnames){
        for (const thumbsName of thumbsNames){
            // 更新済みカードを適用
            const cardDomNew = document.createRange().createContextualFragment(jsonData[thumbsName][tabname]);
            //  - ファイル名から既存のカードDOMを取得して差し替え
            const cardDom = pcmGetCardByThumbsName(thumbsName, tabname);
            if(cardDom){
                cardDom.replaceWith(cardDomNew);
            }else{
                // 新規の場合はとりあえず末尾に追加
                const cardContainer = gradioApp().querySelector(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_cards`);
                if (!cardContainer){
                    console.error(`PromptCardsManger Error: ${thumbsName} ${tabname} cardContainer not found`);
                    return;
                }
                cardContainer.appendChild(cardDomNew);
            }

            // CardSearch 用のデータを更新
            PcmCardSearch.updateCardData(jsonData[thumbsName].cardData, tabname);
        }

        // マッチと表示の再適用
        PcmCardSearch.updateMatch(tabname, true);
        pcmApplyShowOptions(tabname);
    }
}


/** thumbsName からカードの DOM を取得する */
const pcmGetCardByThumbsName = (thumbsName, tabname)=>{
    if(!tabname) return null;
    const selector = `#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_cards .pcm-card`;
    const card = Array.from(gradioApp().querySelectorAll(selector))
        .find(card => card.getAttribute('onclick').includes(`'${thumbsName}'`));
    return card;
}

pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmSetPromptCardsTabOnClickAsync);
pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmSetApplyFunctions);
onUiLoaded(pcmInitializePage);
onUiLoaded(pcmPatchTabSelected);
