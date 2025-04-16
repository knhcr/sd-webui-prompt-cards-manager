/** カード検索管理クラス */
class PcmCardSearch {
    static isInitialized = {"txt2img": false, "img2img": false};

    /** それぞれ {"org_name": card, ...}
     * t2i と i2i で elem 以外は同一の値のため無駄があるが、
     * a1111 標準の t2i と i2i のカード管理は独立していて、
     * 片方だけリフレッシュすると DOM 上のカード枚数が不揃いになるため
     * それぞれのテーブルを独立に管理する
    */
    static cards = { "txt2img":{}, "img2img":{} };

    /** card オブジェクトの初期値 */ 
    static getDefaultCard(){
        return {
            path: "", // カードの path (末尾は $ が付与)
            prompt: "", // カードの prompt (lower case)
            desc: "", // カードの description (lower case)
            orgname: ""
        };
    }

    static queries = {
        "txt2img":{ path: "", prompt: [], desc: [] }, // prompt, desc は split 済み
        "img2img":{ path: "", prompt: [], desc: [] }
    };

    static previousQueries = {
        "txt2img":{ path: "", prompt: [], desc: [] }, // prompt, desc は split 済み
        "img2img":{ path: "", prompt: [], desc: [] }
    };

    /** 現状の各クエリのマッチ結果 (card オブジェクトの配列) */
    static tmpMatch = {
        "txt2img" : { path: [], prompt: [], desc: [] },
        "img2img" : { path: [], prompt: [], desc: [] }
    };

    static cardsInfoUrl = `${PCM_API_ENDPOINT_BASE}/prompt-card-info-all-for-search`;
    static refreshCategoryAliasUrl = `${PCM_API_ENDPOINT_BASE}/refresh-category-alias`;

    constructor(){
    }
   
    /** カードデータとカテゴリー Alias を更新
     *   - a1111標準のコールバックは、クリック元のタブのカードしか更新しないため t2i と i2i は別々に管理する
     * 
     * リフレッシュ時は、カードに変化があるかどうかで挙動が変わる
     *   - カードに変化が無い : div.card だけが全削除されてから再生成される(カスタムカードの場合は変化なし)
     *      -> おそらく実際には DOM の再生成ではなく、 forge の applySort() による作用
     *   - カードに変化がある : さらにその上の tree-view も内包する DOM 要素全体が削除されて再生成される
     *
     * #txt2img_promptcards_cards_html.block > div.wrap が読み込み中の半透明の画面暗転エフェクトの実体
     *   - リフレッシュ中は class に translucent が付与され、読み込み終了後に削除される
     *   - 基本的にこれで DOM 更新の終了を捕捉可能
     * 
     * 起動時の初回にタブを開いた時だけ refresh ボタンが自動で押される
     *   - この場合は暗転処理が行われないため捕捉不可
     *   - 基本的には前回終了時の DOM がキャッシュされているため変化は少ない筈
     *     -> 初回の updateCards は DOM 更新の厳密な終了タイミングを捕捉せず、適当に待機して即次の処理に移る
     * @param {string} tabname "txt2img" or "img2img"
    */
    static async updateCards(tabname=null){
        if(!["txt2img", "img2img"].includes(tabname)) return;

        // カテゴリー Alias のリフレッシュ要求
        const res = await fetch(PcmCardSearch.refreshCategoryAliasUrl);
        if (!res.ok) {
            console.error(`pcmCardSearch.updateCards failed: ${res.statusText}`);
        }
 
        // a1111 による DOM の更新が走るのを監視
        let isTimeout = false;
        const pDomUpadated = new Promise((resolve, reject) => {
            if(PcmCardSearch.isInitialized[tabname]){
                // 初回以降は translucent で判定可能
                const wrapDiv = gradioApp().querySelector(`#${tabname}_promptcards_cards_html.block > div.wrap`);
                if(!wrapDiv) reject(new Error(`pcmCardSearch.updateCards: ${tabname} div.wrap not found`));

                let isStarted = false; // div.wrap に translucent が付与されたら true
                const obsWrapDiv = new MutationObserver(async (ms, o) => {
                    for(const m of ms){
                        //PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: Update Observer ${tabname} ${m.type} ${m.attributeName}`);
                        if(!isStarted && wrapDiv.classList.contains("translucent")){
                            isStarted = true;
                            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: Update Observer ${tabname} DOM Update started`);
                            return;
                        }
                        else if(isStarted && !wrapDiv.classList.contains("translucent")){
                            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: Update Observer ${tabname} DOM Update finished`);
                            o.disconnect();
                            await pcmSleepAsync(150); // 念のため少し待つ                            
                            resolve();
                            return;
                        }
                    }
                    return; // 関係なかった場合
                });
                // 念のためタイムアウトを設定しておく
                setTimeout(() => {
                    obsWrapDiv.disconnect();
                    isTimeout = true;
                    resolve();
                }, 40000);
                obsWrapDiv.observe(
                    gradioApp().querySelector(`#${tabname}_promptcards_cards_html.block`),
                    {childList: true, subtree: true}
                );
            }else{
                // 初回の場合は何もせず少し待ってresolve
                setTimeout(() => resolve(), 150);
                return;
            }
        });

        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${tabname} called, isInitialized: ${PcmCardSearch.isInitialized[tabname]}`);

        try {
            await pDomUpadated; // DOM の更新を待機

            if(isTimeout){
                PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${tabname} timeout`);
                if(!PcmCardSearch.isInitialized[tabname]) PcmCardSearch.isInitialized[tabname] = true;
                return;
            }
            
            // カード情報を取得
            const res = await fetch(PcmCardSearch.cardsInfoUrl);
            if (!res.ok) {
                console.error(`pcmCardSearch.updateCards failed: ${res.statusText}`);
            return;
            }
            const json = await res.json();  // {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}, ... }

            const cards_length_json = Object.keys(json).length;
            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${cards_length_json} cards in JSON`);

            // カード情報を更新
            PcmCardSearch.cards[tabname] = {}; // リセット
            PcmCardSearch.updateCardData(json, tabname);

            if(PcmCardSearch.isInitialized[tabname]){
                const tmpQuery = PcmCardSearch.queries[tabname];
                PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: tmpQuery: path = ${tmpQuery.path}, prompt = ${tmpQuery.prompt.join(" ")}, desc = ${tmpQuery.desc.join(" ")}`);

                PCM_DEBUG_PRINT(`pcmCardSearch.clearQuery called`);
                PcmCardSearch.clearQuery(tabname);

                // 更新前にクエリがセットされていた場合は、再度クエリをセットしなおしてマッチ状態に適用
                const tmpPath = tmpQuery.path;
                let keptPath = null;
                if (tmpPath !== null && tmpPath !== undefined && tmpPath.length > 0){
                    // 更新後もセットされていたPathが有効な場合
                    //  - 更新後のフォルダ名一覧に存在するか
                    //    + ディレクトリツリーはパスの途中のフォルダもノードとして存在する
                    //    + 従ってフォルダ名としてマッチするか否かで有効性を確認する
                    // カード情報の全パスから $ を外して/に付け替えた集合
                    let all_paths = new Set(Object.values(PcmCardSearch.cards[tabname]).map(o=>o.path.slice(0, -1)+'/')); // [`prompt_curds/subdir/subdir`, ...]

                    let checkPath = tmpPath;
                    if (checkPath.endsWith('$')) checkPath = checkPath.slice(0, -1);
                    checkPath += '/';
                    let isValidPath = false;
                    for (const path of all_paths){
                        if (path.startsWith(checkPath)){
                            isValidPath = true;
                            break;
                        }
                    }
                    if (isValidPath){
                        keptPath = tmpPath;
                        PcmCardSearch.updateQuery(tabname, "path", tmpPath, false);
                        PcmCardSearch.updateQuery(tabname, "prompt", tmpQuery.prompt.join(" "), false);
                        PcmCardSearch.updateQuery(tabname, "desc", tmpQuery.desc.join(" "), false);
                        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: previous query : path = ${tmpPath}, prompt = ${tmpQuery.prompt.join(" ")}, desc = ${tmpQuery.desc.join(" ")}`);
                    }
                }else{
                    // 検索クエリのみがセットされていた場合
                    if (tmpQuery.prompt.length > 0 || tmpQuery.desc.length > 0){
                        PcmCardSearch.updateQuery(tabname, "prompt", tmpQuery.prompt.join(" "), false);
                        PcmCardSearch.updateQuery(tabname, "desc", tmpQuery.desc.join(" "), false);
                        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: previous query : prompt = ${tmpQuery.prompt.join(" ")}, desc = ${tmpQuery.desc.join(" ")}`);
                    }
                }

                // クエリの再適用
                PcmCardSearch.updateMatch(tabname, true);

                // 検索パスを引き継いだ場合当該ツリーを展開して data-selected クラスを追加
                if(keptPath !== null){
                    const dirElem = pcmSearchPathToDirTreeElement(keptPath, tabname);
                    if(dirElem) pcmExpandDirItem(tabname, dirElem, true);
                    const dirElemDiv = dirElem.querySelector("div.tree-list-content-dir");
                    if(dirElemDiv) dirElemDiv.dataset.selected = "";
                }
            }

            pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
            pcmTreeViewSetLeafDirMark(tabname); // ツリービューの葉ノードにマークをセット

            // 表示オプションの適用
            pcmApplyShowOptions(tabname);

            if(!PcmCardSearch.isInitialized[tabname]) PcmCardSearch.isInitialized[tabname] = true;

        } catch (error) {
            if(!PcmCardSearch.isInitialized[tabname]) PcmCardSearch.isInitialized[tabname] = true;
            console.error(`pcmCardSearch.updateCards failed: ${error}`);
            console.error(error.stack);
        }
    }

    /** サーバからの JSON データをカードデータに加工して cards にセット
     * @param {object} jsonData サーバからの JSON データ {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}, ... }
     * @param {string} tabname "txt2img" or "img2img"
    */
    static updateCardData(jsonData, tabname){
        let cards = {};
        for (const orgname in jsonData){
            //PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${orgname} in JSON`);
            const card = PcmCardSearch.getDefaultCard();
            card.path = jsonData[orgname].path;
            card.prompt = jsonData[orgname].prompt.toLowerCase();
            card.desc = jsonData[orgname].desc.toLowerCase();
            cards[orgname] = card;
        }
        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${Object.keys(cards).length} cards updated for ${tabname}`);
        Object.assign(PcmCardSearch.cards[tabname], cards);
    }


    /** 指定したクエリ文字列を更新 (デフォルトでupdateMatch()も実行)
     * @param {string} tabname "txt2img" or "img2img"
     * @param {string} type "path" or "prompt" or "desc"
     * @param {string} query クエリ文字列 (内部でtrimされる)
     * @param {boolean} isUpdateMatch マッチのアップデートもするか (デフォルトtrue)
     * 
     */
    static updateQuery(tabname, type, query, isUpdateMatch=true){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        if(!["path", "prompt", "desc"].includes(type)) return;

        PcmCardSearch.previousQueries[tabname][type] = PcmCardSearch.queries[tabname][type];

        if(type=="path"){
            PcmCardSearch.queries[tabname][type] = query;
        }else if(type=="prompt"){
            query = query.trim().toLowerCase();
            query = query.replaceAll(",", " ");
            query = query.replace(/\s+/g, ' ');
            query = query.trim();
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }else if(type=="desc"){
            query = query.trim().toLowerCase();
            query = query.replace(/\s+/g, ' ');
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }

        if(isUpdateMatch){
            PcmCardSearch.updateMatch(tabname);
        }
    }

    /** クエリをクリア (マッチ結果もクリア)
     * @param {string} tabname "txt2img" or "img2img"
     */
    static clearQuery(tabname){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        PcmCardSearch.queries[tabname] = { path: "", prompt: [], desc: [] };
        PcmCardSearch.previousQueries[tabname] = { path: "", prompt: [], desc: [] };
        PcmCardSearch.updateMatch(tabname, true);
    }

    /** マッチのアップデート (DOMへの反映も実施)
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static async updateMatch(tabname, force=false){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        
        if(!PcmCardSearch.isInitialized[tabname]) await PcmCardSearch.updateCards(tabname);
        PcmCardSearch.#updateMatchPath(tabname, force);
        PcmCardSearch.#updateMatchPrompt(tabname, force);
        PcmCardSearch.#updateMatchDesc(tabname, force);
        PcmCardSearch.updateDom(tabname);
    }

    /** Path マッチ
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static #updateMatchPath(tabname, force=false){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        const query = PcmCardSearch.queries[tabname].path;
        if(!force && query === PcmCardSearch.previousQueries[tabname].path) return;

        let ret = [];
        if(query.length == 0) {
            ret = Object.keys(PcmCardSearch.cards[tabname]);
        } else {
            for(const orgname of Object.keys(PcmCardSearch.cards[tabname])){
                const card = PcmCardSearch.cards[tabname][orgname];
                if(card.path.indexOf(query) != -1){
                    ret.push(orgname);
                }
            }
        }
        PCM_DEBUG_PRINT(`pcmCardSearch.updateMatchPath: ${tabname}.path query: ${query}, ret: ${ret.length}`);
        PcmCardSearch.tmpMatch[tabname].path = ret;
    }

    /** Prompt マッチ
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static #updateMatchPrompt(tabname, force=false){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        if(!force && PcmCardSearch.previousQueries[tabname].prompt === PcmCardSearch.queries[tabname].prompt) return;

        let ret = Object.keys(PcmCardSearch.cards[tabname]); // とりあえず全部突っ込む
        if(PcmCardSearch.queries[tabname].prompt.length == 0) {
            // do nothing
        } else {
            for(const orgname of Object.keys(PcmCardSearch.cards[tabname])){
                const card = PcmCardSearch.cards[tabname][orgname];
                for(const query of PcmCardSearch.queries[tabname].prompt){
                    // 積条件なので一つでも外れたら除外
                    if(card.prompt.indexOf(query) === -1){
                        ret = ret.filter(c => c !== orgname);
                        break;
                    }
                }
            }
        }
        PcmCardSearch.tmpMatch[tabname].prompt = ret;
    }

    /** Description マッチ : カードパス(カード名含む)、プロンプト、Description のいずれかにマッチするか否か
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static #updateMatchDesc(tabname, force=false){
        if(!["txt2img", "img2img"].includes(tabname)) return;
        if(!force && PcmCardSearch.previousQueries[tabname].desc === PcmCardSearch.queries[tabname].desc) return;

        let ret = Object.keys(PcmCardSearch.cards[tabname]); // とりあえず全部突っ込む
        if(PcmCardSearch.queries[tabname].desc.length == 0) {
            // do nothing
        } else {
            for(const orgname of Object.keys(PcmCardSearch.cards[tabname])){
                const card = PcmCardSearch.cards[tabname][orgname];
                let text = card.path + " " + card.prompt + " " + card.desc;
                text = text.trim().toLowerCase();
                for(const query of PcmCardSearch.queries[tabname].desc){
                    // 積条件なので一つでも外れたら除外
                    if(text.indexOf(query) === -1){
                        ret = ret.filter(c => c !== orgname);
                        break;
                    }
                }
            }
        }
        PcmCardSearch.tmpMatch[tabname].desc = ret;
    }

    /** マッチ結果のDOMへの反映 */
    static updateDom(tabname){
        if(!["txt2img", "img2img"].includes(tabname)) return;

        let match = PcmCardSearch.tmpMatch[tabname].path.filter( orgname =>
                PcmCardSearch.tmpMatch[tabname].prompt.includes(orgname) &&
                PcmCardSearch.tmpMatch[tabname].desc.includes(orgname));
        
        PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match.length}`);
        // PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match}`);

        try {
            // 基本いまあるカードは全部表示して、マッチしない物を非表示にする方針で処理
            const dom_cards = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .pcm-card`);
            for (const dom_card of dom_cards){
                let visible = true;
                const nameElem = dom_card.querySelector(".name");
                if(nameElem){
                    const orgname = nameElem.getAttribute("orgname");
                    if(orgname){
                        // PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : orgname: ${orgname}`);
                        if (!match.includes(orgname)){
                            visible = false;
                        }
                    }
                }
                dom_card.classList.toggle("hidden", !visible);
            }
        } catch (error) {
            console.error(`pcmCardSearch.updateDom failed: ${error}`);
            console.error(error.stack);
        }
    }
}
