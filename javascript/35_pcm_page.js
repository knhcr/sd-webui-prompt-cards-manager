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
                const rootElem = await pcmQuerySelectorAsync(`#${tabname}_promptcards_tree > ul > li > div`)
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

/** reforge 対応 : reforge 独自の filter, sort のハンドリングをバイパスする
 * - reforge ではカードDOM 初期化時にもまず applyExtraNetworkFilter() が適用される
 * - その処理の中で applySort() を通る
 * - reforge の applySort() は '#' + tabname_full + "_cards" の innerHTML を空にしてから
 *   div.card で引っ掛けた要素をソートして DOM として埋め込む処理に変更されている
 * - 従って card 以外のカスタムクラスだと applySort() を通った時点で DOM が空になってしまう
 * - そもそもフィルタリングは独自実装のため reforge のフィルタリングは一切不要なので
 *   monkey patch を当てて、pcmcardsの場合のみ当該処理を完全にスキップする
 */
const pcmReforgeBypassFilterSort = () => {
    const applyExtraNetworkFilter_org = window.applyExtraNetworkFilter; // original

    window.applyExtraNetworkFilter = function(tabname_full) {
      if (!tabname_full.toLowerCase().includes('promptcards')) {
        applyExtraNetworkFilter_org(tabname_full); // PromptCards 以外は通常の処理
      }
      return;
    };
};


/** 見た目の初期化 */ 
const initializePage = async()=>{
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


/** thumbsName のカードを更新する
 * DOM の差し替え, cardSearch の情報の更新, updateMatch のコール
 * tabname は判らないため、txt2img, img2img の両方を処理する
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
                const cardContainer = gradioApp().querySelector(`#${tabname}_promptcards_cards`);
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
    const selector = `#${tabname}_promptcards_cards .pcm-card`;
    const card = Array.from(gradioApp().querySelectorAll(selector))
        .find(card => card.getAttribute('onclick').includes(`'${thumbsName}'`));
    return card;
}

pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmSetPromptCardsTabOnClickAsync);
pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmReforgeBypassFilterSort);
onUiLoaded(initializePage);
