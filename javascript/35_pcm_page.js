/** Extra Networks の PromptCards タブボタンに Callback を貼り直し続ける Observer の登録 */
const pcmSetPromptCardsTabOnClickAsync = async ()=>{
    /* [a1111 標準のタブ切り替え動作]
    * - UIロード後の初回クリック
    *   + 前回の最後のカードがキャッシュから読まれる
    *   + PCM で付与している title や leaf マークは無い
    *   + root ノード collapse 状態
    * - 2回目以降のクリック
    *   + カードの hidden 属性が全て削除される
    *   + dir tree の選択状態, collapse 状態は維持される
    *   + タブボタン自体はクリックするたびに全て再生成されるため、その都度 イベントリスナーを張り付ける必要あり
    */
    let isTabOpenedOnce = {txt2img: false, img2img: false};
    let o = new MutationObserver((ms)=>{
        // tabname の特定
        let tabname = null;
        for (const tmp of ['txt2img', 'img2img']){
            const container = document.querySelector(`#${tmp}_extra_tabs > .tab-nav`);
            if (container && container.contains(ms[0].target)){
                tabname = tmp;
                break;
            }
        }
        if (!tabname) return;

        // PromptCards タブボタンの取得
        const elem = pcmGetElementBySelectorAndText(`#${tabname}_extra_tabs button`, 'PromptCards');
        if(!elem) return;

        // hidden 属性を貼り直すための event handler をセット
        if (!elem.hasAttribute('pcm-onclick-set')){ // 初期化済みマークを付けて既に貼られているか判定
            elem.toggleAttribute('pcm-onclick-set', true);
            elem.addEventListener('click', async ()=>{
                PCM_DEBUG_PRINT(`pcmPromptCards Tab OnClick: ${tabname}`);
                if(!isTabOpenedOnce[tabname]){
                    // 初回クリック時
                    isTabOpenedOnce[tabname] = true;
                    await pcmSleepAsync(100);
                    //await PcmCardSearch.updateCards(tabname); // カードリスト更新
                    const rootElem = await pcmQuerySelectorAsync(`#${tabname}_promptcards_tree > ul > li > div`)
                    if(!rootElem) return;
                    pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
                    pcmTreeViewSetLeafDirMark(tabname); // ツリービューの葉ノードにマークをセット
                    rootElem.click();
                    pcmApplyShowOptions(tabname); // 表示オプションの適用
                }
                else{
                    await pcmSleepAsync(20);
                    PcmCardSearch.updateDom(tabname);
                }
                return;
            });
        }
    });
    for (const tabname of ['txt2img', 'img2img']){
        o.observe(document.querySelector(`#${tabname}_extra_tabs > .tab-nav`), {childList: true, subtree: false});
    }
};

pcmWaitForContent('#txt2img_extra_tabs > .tab-nav', pcmSetPromptCardsTabOnClickAsync);
