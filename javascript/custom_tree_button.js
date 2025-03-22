/** カード検索管理クラス */
class PcmCardSearch {
    static isInitialized = false;

    static async initialize(){                
        // この時点ではカード一覧が無いので、カード情報の初期化は初回のupdateMatch() 呼び出し時に遅延して行う

        let elem = gradioApp().querySelector('#txt2img_promptcards_extra_refresh');
        if(elem){
            elem.addEventListener('click', ()=>{
                PcmCardSearch.updateCards();
            });
        }
        elem = gradioApp().querySelector('#img2img_promptcards_extra_refresh');
        if(elem){
            elem.addEventListener('click', ()=>{
                PcmCardSearch.updateCards();
            });
        }
    }

    /* 下記のオブジェクト
    {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>, elem:{"txt2img": <elem>, "img2img": <elem>}}, ... }
    elem は <div class="card">
    prompt, desc は lower case
    */
    static cards = {};

    static queries = {
        "txt2img":{ path: "", prompt: [], desc: [] },
        "img2img":{ path: "", prompt: [], desc: [] }
    };

    static previousQueries = {
        "txt2img":{ path: "", prompt: [], desc: [] },
        "img2img":{ path: "", prompt: [], desc: [] }
    };

    /** 現状の各クエリのマッチ結果 (cards[org_name] のオブジェクトの配列) */
    static tmpMatch = {
        "txt2img" : { path: [], prompt: [], desc: [] },
        "img2img" : { path: [], prompt: [], desc: [] }
    };

    static cardsInfoUrl = `${PCM_API_ENDPOINT_BASE}/prompt-card-info-all-for-search`;

    constructor(){
    }
   
    /** カードデータを更新 (カード情報をサーバから取得し、DOM 要素へのハンドラも更新) */
    static async updateCards(){
        if(!PcmCardSearch.isInitialized) PcmCardSearch.isInitialized = true;

        try {
            const res = await fetch(PcmCardSearch.cardsInfoUrl);
            if (!res.ok) {
                console.error(`pcmCardSearch.updateCards failed: ${res.statusText}`);
            return;
            }
            const json = await res.json();  // {<org_name>: {path: <search_terms>, prompt: <prompt>, desc: <description>}, ... }
            
            PCM_DEBUG_PRINT(`!!! pcmCardSearch.updateCards: ${Object.keys(json)}`);

            let cards = {};
            for(const tabname of ["txt2img", "img2img"]){
                // ページ上の全カード要素
                const card_elems = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards .card`));
                for (const card_elem of card_elems){
                    const org_name = card_elem.querySelector(".name").getAttribute("orgname");
                    let card;
                    if(org_name in cards){
                        card = cards[org_name];
                    } else if(org_name in json){
                        card = json[org_name];
                        card.elem = {txt2img: null, img2img: null};
                    } else{
                        // ここには来ないはずだが念のため
                        PCM_DEBUG_PRINT(`pcmCardSearch.updateCards: illegal state. org_name: ${org_name} not found in json, but found in cards`);
                        card = {path: "", prompt: "", desc: "", elem:{"txt2img": null, "img2img": null}};
                    }
                    card.elem[tabname] = card_elem;
                    cards[org_name] = card;
                }
            }
            PcmCardSearch.cards = cards;
            PcmCardSearch.clearQuery();
        } catch (error) {
            console.error(`pcmCardSearch.updateCards failed: ${error}`);
        }
    }

    /** 指定したクエリ文字列を更新 (デフォルトでupdateMatch()も実行)
     * @param {string} tabname "txt2img" or "img2img"
     * @param {string} type "path" or "prompt" or "desc"
     * @param {string} query クエリ文字列 (内部でtrimされる)
     * @param {boolean} isUpdateMatch マッチのアップデートもするか (デフォルトtrue)
     */
    static updateQuery(tabname, type, query, isUpdateMatch=true){
        if(tabname!=='txt2img' && tabname!=='img2img') return;
        if(type!=='path' && type!=='prompt' && type!=='desc') return;

        PcmCardSearch.previousQueries[tabname][type] = PcmCardSearch.queries[tabname][type];

        query = query.trim().toLowerCase();
        if(type=="path"){
            PcmCardSearch.queries[tabname][type] = query;
        }else if(type=="prompt"){
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }else if(type=="desc"){
            PcmCardSearch.queries[tabname][type] = query.split(' ');
        }

        if(isUpdateMatch){
            PcmCardSearch.updateMatch(tabname);
        }
    }

    /** クエリをクリア (マッチ結果もクリア) */
    static clearQuery(){
        PcmCardSearch.queries = {
            "txt2img":{ path: "", prompt: [], desc: [] },
            "img2img":{ path: "", prompt: [], desc: [] }
        };
        PcmCardSearch.previousQueries = {
            "txt2img":{ path: "", prompt: [], desc: [] },
            "img2img":{ path: "", prompt: [], desc: [] }
        };
        PcmCardSearch.updateMatch("txt2img", true);
        PcmCardSearch.updateMatch("img2img", true);
    }

    /** マッチのアップデート (DOMへの反映も実施)
     * @param {string} tabname "txt2img" or "img2img"
     * @param {boolean} force 前回マッチ時からクエリに変更が無くても再度マッチ処理するか (デフォルトfalse)
     */
    static updateMatch(tabname, force=false){
        if(tabname!=='txt2img' && tabname!=='img2img') return;

        if(!PcmCardSearch.isInitialized) PcmCardSearch.updateCards();

        PcmCardSearch.#updateMatchPath(tabname, force);
        PcmCardSearch.#updateMatchPrompt(tabname, force);
        PcmCardSearch.#updateMatchDesc(tabname, force);
        PcmCardSearch.#updateDom(tabname);
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
            ret = Object.values(PcmCardSearch.cards);
        } else {
            for(const card of Object.values(PcmCardSearch.cards)){
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

        let ret = [];
        if(PcmCardSearch.queries[tabname].prompt.length == 0) {
            PcmCardSearch.tmpMatch[tabname].prompt = Object.values(PcmCardSearch.cards);
            return;
        }

        for(const card of Object.values(PcmCardSearch.cards)){
            for(const p of PcmCardSearch.queries[tabname].prompt){
                if(card.prompt.indexOf(p) != -1){
                    ret.push(card);
                    break;
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

        let ret = [];
        if(PcmCardSearch.queries[tabname].desc.length == 0) {
            PcmCardSearch.tmpMatch[tabname].desc = Object.values(PcmCardSearch.cards);
            return;
        }

        for(const card of Object.values(PcmCardSearch.cards)){
            for(const d of PcmCardSearch.queries[tabname].desc){
                if(card.desc.indexOf(d) != -1){
                    ret.push(card);
                    break;
                }
            }
        }
        PcmCardSearch.tmpMatch[tabname].desc = ret;
    }

    /** マッチ結果のDOMへの反映 */
    static #updateDom(tabname){
        if(tabname!=='txt2img' && tabname!=='img2img') return;

        let match = PcmCardSearch.tmpMatch[tabname].path.filter( card =>
                PcmCardSearch.tmpMatch[tabname].prompt.includes(card) &&
                PcmCardSearch.tmpMatch[tabname].desc.includes(card));

        PCM_DEBUG_PRINT(`pcmCardSearch.updateDom ${tabname} : match: ${match.length}`);

        for(const card of Object.values(PcmCardSearch.cards)){
            const visible = match.includes(card);
            card.elem[tabname].classList.toggle("hidden", !visible);
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

// 初期化
pcmWaitForContent('#txt2img_promptcards_extra_refresh', PcmCardSearch.initialize);


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
