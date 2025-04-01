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
     * リフレッシュボタン経由の場合は tabname も受け取る
     *   - a1111標準のコールバックは、クリック元のタブのカードしか更新しないため t2i と i2i は別々に管理する
     * リフレッシュ時は、カードに変化があるかどうかで DOM の挙動が変わる
     *   - カードに変化が無い : div.card だけが全削除されてから再生成される
     *   - カードに変化がある : さらにその上の tree-view も内包する DOM 要素全体が削除されて再生成される
     * -> ここで監視せず以下で監視する
     * #txt2img_promptcards_cards_html.block > div.wrap が読み込み中の半透明の画面暗転エフェクトの実体
     *   - リフレッシュ中は class に translucent が付与され、読み込み終了後に削除される
     *   - ただし、起動時、初回に別タブから Prompt Cards タブを開いた場合に走る updateCards は translucent は付与されないため補足できない
     *     -> updateCards の処理がタイムアウト待ちで止まってしまうため初回タブクリックによる更新は無しに変更
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
            }, 30000);
            obsWrapDiv.observe(
                gradioApp().querySelector(`#${tabname}_promptcards_cards_html.block`),
                {childList: true, subtree: true});

        });

        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${tabname} called, isInitialized: ${PcmCardSearch.isInitialized[tabname]}`);
        if(!PcmCardSearch.isInitialized[tabname]) PcmCardSearch.isInitialized[tabname] = true;
        try {
            // カード情報を取得
            const res = await fetch(PcmCardSearch.cardsInfoUrl);
            if (!res.ok) {
                console.error(`pcmCardSearch.updateCards failed: ${res.statusText}`);
            return;
            }
            const json = await res.json();  // {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}, ... }

            const cards_length_json = Object.keys(json).length;
            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${cards_length_json} cards in JSON`);

            // JSON をカード情報に加工 (現状サーバのデータそのままだが念のため)
            let cards = {};
            for (const orgname in json){
                //PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${orgname} in JSON`);
                const card = PcmCardSearch.getDefaultCard();
                card.path = json[orgname].path;
                card.prompt = json[orgname].prompt.toLowerCase();
                card.desc = json[orgname].desc.toLowerCase();
                cards[orgname] = card;
            }

            PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${Object.keys(cards).length} cards updated for ${tabname}`);
            PcmCardSearch.cards[tabname] = cards;

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

            await pDomUpadated; // DOM の更新を待機

            // クエリの再適用
            if(!isTimeout) PcmCardSearch.updateMatch(tabname, true);

            // 検索パスを引き継いだ場合ツリーを展開
            if(keptPath !== null){
                const dirElem = pcmSearchPathToDirTreeElement(keptPath, tabname);
                if(dirElem) pcmExpandDirItem(tabname, dirElem, true);
            }

            pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
            pcmTreeViewSetLeafDirMark(tabname); // ツリービューの葉ノードにマークをセット

            // 表示オプションの適用
            pcmApplyShowOptions(tabname);

        } catch (error) {
            console.error(`pcmCardSearch.updateCards failed: ${error}`);
            console.error(error.stack);
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
            const dom_cards = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .card`);
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

/** ディレクトリツリービューのアイテムクリック */
function pcmExtraNetworksTreeOnClick(event, tabname, extra_networks_tabname) {
    /**
     * Handles `onclick` events for buttons within an `extra-network-tree .tree-list--tree`.
     *
     * Determines whether the clicked button in the tree is for a file entry or a directory
     * then calls the appropriate function.
     *
     * @param event                     The generated event.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    var btn = event.currentTarget;
    var par = btn.parentElement;
    PCM_DEBUG_PRINT(`pcmExtraNetworksTreeOnClick: CLICKED BUTTON: ${btn.dataset.path}`);
    if (par.dataset.treeEntryType === "file") {
        pcmExtraNetworksTreeProcessFileClick(event, btn, tabname, extra_networks_tabname);
    } else {
        pcmExtraNetworksTreeProcessDirectoryClick(event, btn, tabname, extra_networks_tabname);
    }
}

/** ディレクトリツリービューのファイルアイテムクリック */
function pcmExtraNetworksTreeProcessFileClick(event, btn, tabname, extra_networks_tabname) {
    /**
     * Processes `onclick` events when user clicks on files in tree.
     *
     * @param event                     The generated event.
     * @param btn                       The clicked `tree-list-item` button.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    // NOTE: Currently unused.
    PCM_DEBUG_PRINT(`pcmExtraNetworksTreeOnClick: FILE TYPE TREE BUTTON clicked: ${btn.dataset.path}`);
    return;
}

/** ディレクトリツリービューのディレクトリアイテムクリック */
function pcmExtraNetworksTreeProcessDirectoryClick(event, btn, tabname, extra_networks_tabname) {
    /**
     * Processes `onclick` events when user clicks on directories in tree.
     *
     * Here is how the tree reacts to clicks for various states:
     * unselected unopened directory: Diretory is selected and expanded.
     * unselected opened directory: Directory is selected.
     * selected opened directory: Directory is collapsed and deselected.
     * chevron is clicked: Directory is expanded or collapsed. Selected state unchanged.
     *
     * @param event                     The generated event.
     * @param btn                       The clicked `tree-list-item` button.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    var ul = btn.nextElementSibling;
    // This is the actual target that the user clicked on within the target button.
    // We use this to detect if the chevron was clicked.
    var true_targ = event.target;

    function _expand_or_collapse(_ul, _btn, _tabname) {
        // not used
    }

    function _remove_selected_from_all() {
        // Removes the `selected` attribute from all buttons.
        var sels = document.querySelectorAll("div.tree-list-content");
        [...sels].forEach(el => {
            delete el.dataset.selected;
        });
    }

    function _select_button(_btn) {
        // Removes `data-selected` attribute from all buttons then adds to passed button.
        _remove_selected_from_all();
        _btn.dataset.selected = "";
    }

    function _update_search(_tabname, _extra_networks_tabname, _search_text) {
        // _search_text は <div type="button" data-path="prompt_cards/subdir/subdir$"> の data-path の値
        //   - data-path は ui_extra_networks.py の create_tree_dir_item_html() で初期化される (dir_path の値がそのまま入る)
        //     + Case Sensitive, $ は含まない

        if(_search_text) {
            // パスの区切り文字を正規化
            _search_text = _search_text.replace(/\\/g, '/');
            
            // SubDirチェックボックスの状態を確認
            var checkbox = gradioApp().querySelector(`#${_tabname}_pcm_subdirs_toggle`);
            if (checkbox && !checkbox.checked && !_search_text.endsWith('$')) {
                // SubDirにチェックが無い場合は$を付加
                _search_text += '$';
            }
        }
        PcmCardSearch.updateQuery(_tabname, "path", _search_text, true); // クエリを更新し、マッチ結果も更新
    }

    
    // シェブロン をクリック : expand / collapse のトグルのみ
    if (true_targ.matches(".tree-list-item-action--leading, .tree-list-item-action-chevron")) {
        if (ul.hasAttribute("hidden")){
            pcmExpandDirItem(tabname, btn.closest('li.tree-list-item'), true);
        } else {
            pcmCollapseDirItem(tabname, btn.closest('li.tree-list-item'));
        }
    } 
    // ボタン部分をクリック
    else {
        const li = btn.closest('li.tree-list-item');

        // 選択中 かつ 展開中 => 折り畳む (当該フォルダのみ)
        if ("selected" in btn.dataset && !(ul.hasAttribute("hidden"))) {
            pcmCollapseDirItem(tabname, li);
            //_select_button(btn, tabname, extra_networks_tabname);
            //_update_search(tabname, extra_networks_tabname, btn.dataset.path);
        } 

        // 非選択中 かつ 展開中 => 選択 (念のため再帰的展開も実施)
        else if (!("selected" in btn.dataset) && !(ul.hasAttribute("hidden"))) {
            pcmExpandDirItem(tabname, li, true);
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }

        // 選択中 かつ 折り畳み中 => 展開 (念のため再帰的展開)
        else if ("selected" in btn.dataset && (ul.hasAttribute("hidden"))){
            pcmExpandDirItem(tabname, li, true);
            //_select_button(btn, tabname, extra_networks_tabname);
            //_update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }

        // 非選択中 かつ 折り畳み中 => 展開して選択 (念のため再帰的展開)
        else {
            pcmExpandDirItem(tabname, li, true);
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }
    }

    // 現在選択中のフォルダの更新
    let dirElem = null;
    if (event.target.tagName === 'SPAN') dirElem = event.target.parentElement.parentElement;
    else if (event.target.tagName === 'DIV') dirElem = event.target.parentElement;
    else return; // ここには来ない
    pcmUpdateSelectedFolderHistory(tabname, pcmDirTreeElementToSearchPath(dirElem));
}


/** ツリービューのディレクトリアイテムを展開する
 * @param {string} tabname "txt2img" or "img2img"
 * @param {any} target Elemnt or str (CSS Selector) of 'li.tree-list-item' element
 * @param {boolean} recursive ルートノードから再帰的に展開するか (デフォルトfalse)
 */
function pcmExpandDirItem(tabname, target, recursive=false){
    if(typeof target === 'string'){
        target = gradioApp().querySelector(target);
    }
    if(!target) return;
    
    if(target.classList.contains('pcm-tree-view-leaf-dir')){
        // 葉ノードの場合は何もしない
    } else{
        const elemUL = target.querySelector(':scope > ul');
        const elemDiv = target.querySelector(':scope > div.tree-list-content');
        if(!elemUL || !elemDiv) return;
        if(elemUL.hasAttribute("hidden")) elemUL.removeAttribute("hidden");
        elemDiv.dataset.expanded = "";
    }

    if(recursive){
        const container = gradioApp().querySelector(`#${tabname}_promptcards_tree`);
        if(!container) return;

        const parent = target.parentElement.parentElement;
        if(!parent || parent.tagName !== 'LI' || !container.contains(parent)) return;

        pcmExpandDirItem(tabname, parent, recursive);
    }
}


/** ツリービューのディレクトリアイテムを折り畳む
 * @param {string} tabname "txt2img" or "img2img"
 * @param {any} target Elemnt or str (CSS Selector) of 'li.tree-list-item' element
 */
function pcmCollapseDirItem(tabname, target){
    if(typeof target === 'string'){
        target = gradioApp().querySelector(target);
    }
    if(!target) return;
    
    if(target.classList.contains('pcm-tree-view-leaf-dir')){
        // 葉ノードの場合は何もしない
    } else{
        const elemUL = target.querySelector(':scope > ul');
        const elemDiv = target.querySelector(':scope > div.tree-list-content');
        if(!elemUL || !elemDiv) return;
        if(!elemUL.hasAttribute("hidden")) elemUL.setAttribute("hidden", "");
        delete elemDiv.dataset.expanded;
    }
}


/** subdir toggle callback */
function pcmToggleSubdirs(tabname) {
    const checkbox = gradioApp().querySelector(`#${tabname}_pcm_subdirs_toggle`);
    const PCM_SEARCH_ROOT = 'prompt_cards';
    
    let search_text = PcmCardSearch.queries[tabname].path;
    if (checkbox.checked) {
        if (search_text.endsWith('$')) {
            search_text = search_text.slice(0, -1);
        }else{
            search_text += '$';
        }
    } else {
        if (!search_text.endsWith('$')) {
            if (!search_text) {
                search_text = PCM_SEARCH_ROOT + '$'; // 空文字の場合(全マッチ状態) の場合に $ を付ける場合はルートノードを付加 
            } else {
                search_text += '$';
            }
        }
    }
    PcmCardSearch.updateQuery(tabname, "path", search_text);
}
pcmWaitForContent('#txt2img_pcm_subdirs_toggle', ()=>{
    for (const tabname of ['txt2img', 'img2img']){
        gradioApp().querySelector(`#${tabname}_pcm_subdirs_toggle`).addEventListener('change', function() {
            pcmToggleSubdirs(tabname);
        });
    }
});


/** Prompt Search Callback */
function pcmPromptSearchCallback(tabname){
    const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_prompt`);
    if(!elem) return;
    let query = elem.value;
    if (query === null || query === undefined) query = "";
    PcmCardSearch.updateQuery(tabname, "prompt", query, true);
}
pcmWaitForContent('#txt2img_promptcards_extra_search_prompt', ()=>{
    for (const tabname of ['txt2img', 'img2img']){
        const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_prompt`);
        elem.addEventListener('input', ()=>{
            pcmPromptSearchCallback(tabname);
        });
    }
});


/** Desc Search Callback */
function pcmDescSearchCallback(tabname){
    const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_desc`);
    if(!elem) return;
    let query = elem.value;
    if (query === null || query === undefined) query = "";
    PcmCardSearch.updateQuery(tabname, "desc", query, true);
}
pcmWaitForContent('#txt2img_promptcards_extra_search_desc', ()=>{
    for (const tabname of ['txt2img', 'img2img']){
        const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_desc`);
        elem.addEventListener('input', ()=>{
            pcmDescSearchCallback(tabname);
        });
    }
});


/** Card List Refresh Button Callback */
pcmWaitForContent('#txt2img_promptcards_extra_refresh', ()=>{
    for (const tabname of ['txt2img', 'img2img']){
        let elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_refresh`);
        if(elem){
            elem.addEventListener('click', ()=>{
                PcmCardSearch.updateCards(tabname);
            });
        }
    }
});

/** Extra Networks の PromptCards タブボタン Callback */
pcmWaitForContent('#txt2img_extra_tabs', async ()=>{
    await pcmSleepAsync(200);
    for (const tabname of ['txt2img', 'img2img']){
        const elem = pcmGetElementBySelectorAndText(`#${tabname}_extra_tabs button`, 'PromptCards');
        if(elem){
            elem.addEventListener('click', async (event)=>{
                if (!elem.classList.contains('selected')){ // PromptCards タブの外から PromptCards タブに入ってくる場合
                    PCM_DEBUG_PRINT(`pcmPromptCardsOnClick: ${tabname} clicked.`);
                    if (!PcmCardSearch.isInitialized[tabname]){
                        PCM_DEBUG_PRINT(`pcmPromptCardsOnClick: ${tabname} : first time.`);
                        // 初回はカードリスト更新し、ルートノードを expand -> 一旦無し
                        //await PcmCardSearch.updateCards(tabname);

                        // 一応DOMに現れるまで待つ
                        const rootElem = await pcmQuerySelectorAsync(`#${tabname}_promptcards_tree > ul > li > div`)
                        if(!rootElem) return;
                        pcmTreeViewItemsSetTitle(tabname); // ツリービューのアイテムにタイトルをセット
                        pcmTreeViewSetLeafDirMark(tabname); // ツリービューの葉ノードにマークをセット
                        rootElem.click();
                        pcmApplyShowOptions(tabname); // 表示オプションの適用
                        
                        // 2回目以降のクリックでは、カードの hidden 属性が全て削除されるので DOM Update を行う処理を追加する
                        //   - 別タブに移動すると、カレントのタブ要素 (button) は削除されて再生成される模様 (eventListner も属性も毎回消える)
                        //   - 親要素のアイテム追加を mutationObserver で監視してその都度 イベントリスナーを張り付ける
                        let o = new MutationObserver((ms)=>{
                            const elem = pcmGetElementBySelectorAndText(`#${tabname}_extra_tabs button`, 'PromptCards');
                            if(elem){
                                // 初期化済みマークを付けて現在のDOM要素には既に event ハンドラが張られているか否かの目印とする
                                if (!elem.hasAttribute('pcm-onclick-set')){
                                    elem.toggleAttribute('pcm-onclick-set', true);
                                    elem.addEventListener('click', async ()=>{
                                        // どのタブか判定してDOM更新
                                        for (const tabname of ['txt2img', 'img2img']){
                                            const container = document.querySelector(`#${tabname}_extra_tabs > .tab-nav`);
                                            if (container && container.contains(ms[0].target)){
                                                PCM_DEBUG_PRINT(`pcmPromptCards Tab OnClick: ${tabname}`);
                                                await pcmSleepAsync(50);
                                                PcmCardSearch.updateDom(tabname);
                                                return;
                                            }
                                        }
                                    });
                                }
                            }
                        });
                        o.observe(document.querySelector(`#${tabname}_extra_tabs > .tab-nav`), {childList: true, subtree: false});
                    }
                }
            });
        }
    }
});


/** ツリービューのアイテムにタイトルをセット
 * @param {string} tabname "txt2img" or "img2img"
*/
pcmTreeViewItemsSetTitle = (tabname)=>{
    PCM_DEBUG_PRINT(`pcmTreeViewItemsSetTitle called : ${tabname}`);
    if(!["txt2img", "img2img"].includes(tabname)) return;

    const elems = gradioApp().querySelectorAll(`#${tabname}_promptcards_tree .tree-list-content.tree-list-content-dir`);
    for (const elem of elems){
        let title = ""
        let path = elem.getAttribute('data-path');
        if(path){
            path = path.replaceAll('\\', '/');
            title = path.split('/').slice(-1)[0];
        }
        elem.setAttribute('title', title);
    }
}

/** ツリービューの葉ノードにマークとして pcm-tree-view-leaf-dir class をセットし、chevron のクラスを tree-list-leaf-chevron に変更
 * @param {string} tabname "txt2img" or "img2img"
*/
pcmTreeViewSetLeafDirMark = (tabname=null)=>{
    PCM_DEBUG_PRINT(`pcmTreeViewSetLeafDirMark called : ${tabname}`);
    if(!["txt2img", "img2img"].includes(tabname)) return;

    const elems = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_tree li.tree-list-item[data-tree-entry-type="dir"]`));
    for (const elem of elems){
        // 直下の ul > li に data-tree-entry-type="dir" があるか
        const children = Array.from(elem.querySelectorAll(':scope > ul > li[data-tree-entry-type="dir"]'));
        let hasChildren = true;
        if(children.length === 0) hasChildren = false;
        elem.classList.toggle('pcm-tree-view-leaf-dir', !hasChildren);
        if(!hasChildren){
            const chevron = elem.querySelector('i.tree-list-item-action-chevron');
            if(chevron){
                chevron.classList.add('tree-list-leaf-chevron');
                chevron.classList.remove('tree-list-item-action-chevron');
            }
        }
    }
}


/** 表示オプションの適用 : ShowDir, ShowDesc, ImageFit */
pcmApplyShowOptions = (tabname)=>{
    _pcmRefreshHideDirName(tabname);
    _pcmRefreshShowDesc(tabname);
    _pcmRefreshImageFit(tabname);
}