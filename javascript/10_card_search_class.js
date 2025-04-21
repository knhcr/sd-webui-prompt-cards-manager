/** カード検索管理クラス */
class PcmCardSearch {
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
            desc: "" // カードの description (lower case)
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
     * @param {string} tabname "txt2img" or "img2img"
    */
    static async updateCards(tabname=null){
        if(!["txt2img", "img2img"].includes(tabname)) return;

        try {
            // カテゴリー Alias のリフレッシュ要求
            const resAlias = await fetch(PcmCardSearch.refreshCategoryAliasUrl);
            if (!resAlias.ok) {
                throw new Error(`pcmCardSearch.updateCards failed: ${resAlias.statusText}`);
            }
 
            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${tabname} called`);

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
            PcmCardSearch.updateMatch(tabname, true, false); // DOMへの反映はしない (本処理は DOM の更新とは独立しているため)


            // 検索パスを引き継いだ場合当該ツリーを展開して data-selected クラスを追加
            if(keptPath !== null){
                const dirElem = pcmSearchPathToDirTreeElement(keptPath, tabname);
                if(dirElem) pcmExpandDirItem(tabname, dirElem, true);
                const dirElemDiv = dirElem.querySelector("div.tree-list-content-dir");
                if(dirElemDiv) dirElemDiv.dataset.selected = "";
            }
        } catch (error) {
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

    /** 指定されたsearchpathに対応するカードデータを削除,
     * path を指定した場合当該searchpathにマッチするカード(サブフォルダを含めない場合末尾に $ 必須)
     * @param {string} path card.path に対する検索パス (サブフォルダを含めない場合末尾に $ 必須)
    */
    static deleteCardData(path=null, tabName=null){
        if(path === null || path === undefined) return;
        if(!["txt2img", "img2img"].includes(tabName)) return;

        const cards = PcmCardSearch.cards[tabName];
        for (const orgname in cards){
            const card = cards[orgname];
            if(card.path.startsWith(path)){
                delete cards[orgname];
            }
        }
        
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
     * @param {boolean} updateDom マッチ結果のDOMへの反映も実施するか (デフォルトtrue)
     */
    static async updateMatch(tabname, force=false, updateDom=true){
        if(!["txt2img", "img2img"].includes(tabname)) return;
       
        PcmCardSearch.#updateMatchPath(tabname, force);
        PcmCardSearch.#updateMatchPrompt(tabname, force);
        PcmCardSearch.#updateMatchDesc(tabname, force);
        if(updateDom) PcmCardSearch.updateDom(tabname);
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

        // カード情報が無い場合は何もしない
        // ページ起動後の初回タブクリック時に、初回のデータ取得までの間一瞬全カードが消えることを防止するため
        if(Object.keys(PcmCardSearch.cards[tabname]).length === 0){
            return;
        }

        let match = PcmCardSearch.tmpMatch[tabname].path.filter( orgname =>
                PcmCardSearch.tmpMatch[tabname].prompt.includes(orgname) &&
                PcmCardSearch.tmpMatch[tabname].desc.includes(orgname));
        
        PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match.length}`);
        // PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match}`);

        try {
            // 基本いまあるカードは全部表示して、マッチしない物を非表示にする方針で処理
            const dom_cards = gradioApp().querySelectorAll(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_cards > .pcm-card`);
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
