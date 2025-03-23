/** カード検索管理クラス */
class PcmCardSearch {
    static isInitialized = {"txt2img": false, "img2img": false};

    static async initialize(){                
        // この時点ではカード一覧が無いので、カード情報の初期化は初回の updateMatch() 呼び出し時に遅延して行う
    }

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
            path: "", // カードの path
            prompt: "", // カードの prompt (lower case)
            desc: "", // カードの description (lower case)
            elem: null // 対象カードの DOM
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

    constructor(){
    }
   
    /** カードデータを更新 (カード情報をサーバから取得し、DOM 要素へのハンドラも更新)
     * リフレッシュボタン経由の場合は tabname も受け取る
     *  - a1111標準のコールバックは、クリック元のタブのカードしか一切更新しない
     *  - 従って Update の処理を分ける必要あり
     * @param {string} tabname "txt2img" or "img2img" or null (全てのタブ)
    */
    static async updateCards(tabname=null){
        let targetTabs = ["txt2img", "img2img"]
        if(tabname === null){
            // do nothing (全てのタブ)
        }
        else if (tabname === "txt2img"){
            targetTabs = ["txt2img"];
        }

        for (const tabname of targetTabs){
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

                let cards_length_dom = 0;

                let isTimeout = true;
                let i = 0;
                for (i = 0; i < 150; i++){
                    // a1111 標準処理による DOM の更新を待つ (100ms ごと, 最大15秒)
                    await pcmSleepAsync(100); 
                    cards_length_dom = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards .card`).length;
                    if (cards_length_json === cards_length_dom){
                        isTimeout = false;
                        break;
                    }
                }
                if (isTimeout){
                    PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: timeout: ${cards_length_json} cards in JSON, but ${cards_length_dom} cards in DOM`);
                    return;
                }
                PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: waited ${(i+1)*100} ms`);

                // ページ上の全カードの DOM の hash テーブルを構築
                const card_doms = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards .card`));
                const card_doms_hash = {}
                for (const elem of card_doms){
                    const orgname = elem.querySelector(".name").getAttribute("orgname");
                    // PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${orgname} in DOM`);
                    card_doms_hash[orgname] = elem;
                }

                PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${Object.keys(card_doms_hash).length} cards in DOM`);

                // カード情報を取得し、DOM 要素をマッピング
                let cards = {};
                for (const orgname in json){
                    //PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${orgname} in JSON`);
                    const card = PcmCardSearch.getDefaultCard();
                    card.path = json[orgname].path;
                    card.prompt = json[orgname].prompt;
                    card.desc = json[orgname].desc;
                    card.elem = card_doms_hash[orgname];
                    cards[orgname] = card;
                }

                PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: ${Object.keys(cards).length} cards updated for ${tabname}`);
                PcmCardSearch.cards[tabname] = cards;

                PCM_DEBUG_PRINT(`pcmCardSearch.clearQuery called`);
                PcmCardSearch.clearQuery(tabname);

                // ツリービューのアイテムにタイトルをセット
                pcmTreeViewItemsSetTitle(tabname);
            } catch (error) {
                console.error(`pcmCardSearch.updateCards failed: ${error}`);
                console.error(error.stack);
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
        if(tabname!=='txt2img' && tabname!=='img2img') return;
        if(type!=='path' && type!=='prompt' && type!=='desc') return;

        PcmCardSearch.previousQueries[tabname][type] = PcmCardSearch.queries[tabname][type];

        query = query.trim().toLowerCase();
        if(type=="path"){
            PcmCardSearch.queries[tabname][type] = query;
        }else if(type=="prompt"){
            query = query.replaceAll(",", " ");
            query = query.replace(/\s+/g, ' ');
            query = query.trim();
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }else if(type=="desc"){
            query = query.replace(/\s+/g, ' ');
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }

        if(isUpdateMatch){
            PcmCardSearch.updateMatch(tabname);
        }
    }

    /** クエリをクリア (マッチ結果もクリア)
     * @param {string} tabname "txt2img" or "img2img" or null (全てのタブ)
     */
    static clearQuery(tabname=null){
        let targetTabs = ["txt2img", "img2img"]
        if(tabname === null){
            // do nothing (全てのタブ)
        }
        else if (tabname === "txt2img"){
            targetTabs = ["txt2img"];
        }
        else if (tabname === "img2img"){
            targetTabs = ["img2img"];
        }

        for (const tabname of targetTabs){
            PcmCardSearch.queries[tabname] = { path: "", prompt: [], desc: [] };
            PcmCardSearch.previousQueries[tabname] = { path: "", prompt: [], desc: [] };
            PcmCardSearch.updateMatch(tabname, true);
        }
    }

    /** マッチのアップデート (DOMへの反映も実施)
     * @param {string} tabname "txt2img" or "img2img" or null (全てのタブ)
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static updateMatch(tabname, force=false){
        let targetTabs = ["txt2img", "img2img"]
        if(tabname === null){
            // do nothing (全てのタブ)
        }
        else if (tabname === "txt2img"){
            targetTabs = ["txt2img"];
        }else if (tabname === "img2img"){
            targetTabs = ["img2img"];
        }

        for (const tabname of targetTabs){
            if(!PcmCardSearch.isInitialized[tabname]) PcmCardSearch.updateCards(tabname);

            PcmCardSearch.#updateMatchPath(tabname, force);
            PcmCardSearch.#updateMatchPrompt(tabname, force);
            PcmCardSearch.#updateMatchDesc(tabname, force);
            PcmCardSearch.updateDom(tabname);
        }
    }

    /** Path マッチ
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static #updateMatchPath(tabname, force=false){
        if(tabname!=='txt2img' && tabname!=='img2img') return;
        const query = PcmCardSearch.queries[tabname].path;
        if(!force && query === PcmCardSearch.previousQueries[tabname].path) return;

        let ret = [];
        if(query.length == 0) {
            ret = Object.values(PcmCardSearch.cards[tabname]);
        } else {
            for(const card of Object.values(PcmCardSearch.cards[tabname])){
                if(card.path.indexOf(query) != -1){
                    ret.push(card);
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
        if(tabname!=='txt2img' && tabname!=='img2img') return;
        if(!force && PcmCardSearch.previousQueries[tabname].prompt === PcmCardSearch.queries[tabname].prompt) return;

        let ret = Object.values(PcmCardSearch.cards[tabname]);
        if(PcmCardSearch.queries[tabname].prompt.length == 0) {
            // do nothing
        } else {
            for(const card of Object.values(PcmCardSearch.cards[tabname])){
                for(const query of PcmCardSearch.queries[tabname].prompt){
                    if(card.prompt.indexOf(query) === -1){
                        ret = ret.filter(c => c !== card);
                        break;
                    }
                }
            }
        }
        PcmCardSearch.tmpMatch[tabname].prompt = ret;
    }

    /** Description マッチ
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static #updateMatchDesc(tabname, force=false){
        if(tabname!=='txt2img' && tabname!=='img2img') return;
        if(!force && PcmCardSearch.previousQueries[tabname].desc === PcmCardSearch.queries[tabname].desc) return;

        let ret = Object.values(PcmCardSearch.cards[tabname]);
        if(PcmCardSearch.queries[tabname].desc.length == 0) {
            // do nothing
        } else {
            for(const card of Object.values(PcmCardSearch.cards[tabname])){
                for(const query of PcmCardSearch.queries[tabname].desc){
                    if(card.desc.indexOf(query) === -1){
                        ret = ret.filter(c => c !== card);
                        break;
                    }
                }
            }
        }
        PcmCardSearch.tmpMatch[tabname].desc = ret;
    }

    /** マッチ結果のDOMへの反映 */
    static updateDom(tabname){
        if(tabname!=='txt2img' && tabname!=='img2img') return;

        let match = PcmCardSearch.tmpMatch[tabname].path.filter( card =>
                PcmCardSearch.tmpMatch[tabname].prompt.includes(card) &&
                PcmCardSearch.tmpMatch[tabname].desc.includes(card));

        PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match.length}`);

        try {
            for(const key of Object.keys(PcmCardSearch.cards[tabname])){
                const card = PcmCardSearch.cards[tabname][key];
                const visible = match.includes(card);
                //PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : key: ${key}, visible: ${visible}`);
                card.elem.classList.toggle("hidden", !visible);
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

    function _expand_or_collapse(_ul, _btn) {
        // Expands <ul> if it is collapsed, collapses otherwise. Updates button attributes.
        if (_ul.hasAttribute("hidden")) {
            _ul.removeAttribute("hidden");
            _btn.dataset.expanded = "";
        } else {
            _ul.setAttribute("hidden", "");
            delete _btn.dataset.expanded;
        }
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

    // If user clicks on the chevron, then we do not select the folder.
    if (true_targ.matches(".tree-list-item-action--leading, .tree-list-item-action-chevron")) {
        _expand_or_collapse(ul, btn);
    } else {
        // User clicked anywhere else on the button.
        if ("selected" in btn.dataset && !(ul.hasAttribute("hidden"))) {
            // If folder is select and open, collapse and deselect button.
            _expand_or_collapse(ul, btn);
            //delete btn.dataset.selected;
            //_update_search(tabname, extra_networks_tabname, "");
        } else if (!(!("selected" in btn.dataset) && !(ul.hasAttribute("hidden")))) {
            // If folder is open and not selected, then we don't collapse; just select.
            // NOTE: Double inversion sucks but it is the clearest way to show the branching here.
            _expand_or_collapse(ul, btn);
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        } else {
            // All other cases, just select the button.
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }
    }

    // 現在選択中のフォルダの更新
    pcmUpdateSelectedFolderHistory(tabname, event.target);
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

/** Extra Networks Tab Button Callback */
pcmWaitForContent('#txt2img_extra_tabs', async ()=>{
    await pcmSleepAsync(200);
    for (const tabname of ['txt2img', 'img2img']){
        let elem = pcmGetElementBySelectorAndText(`#${tabname}_extra_tabs button`, 'PromptCards');
        if(elem){
            elem.addEventListener('click', (event)=>{
                if (!elem.classList.contains('selected')){
                    PcmCardSearch.updateCards(tabname);
                }
            });
        }
    }
});

/** ツリービューのアイテムにタイトルをセット
 * @param {string} tabname "txt2img" or "img2img" or null (全てのタブ)
*/
pcmTreeViewItemsSetTitle = (tabname=null)=>{
    PCM_DEBUG_PRINT(`pcmTreeViewItemsSetTitle called : ${tabname}`);
    let targetTabs = ["txt2img", "img2img"]
    if(tabname === null){
        // do nothing (全てのタブ)
    }
    else if (tabname === "txt2img"){
        targetTabs = ["txt2img"];
    }
    else if (tabname === "img2img"){
        targetTabs = ["img2img"];
    }

    for (const tabname of targetTabs){
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
}
