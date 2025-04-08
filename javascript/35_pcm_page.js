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
    const originalApplyExtraNetworkFilter = window.applyExtraNetworkFilter; // original

    window.applyExtraNetworkFilter = function(tabname_full) {
      if (!tabname_full.toLowerCase().includes('promptcards')) {
        originalApplyExtraNetworkFilter(tabname_full); // PromptCards 以外のときだけ通常の処理
      }
      return;
    };
};

pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmSetPromptCardsTabOnClickAsync);
pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmReforgeBypassFilterSort);
