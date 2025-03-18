/** subdir toggle checkbox */
const pcmAddSubdirToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_subdir_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'SubDir:';
        label.classList.add('pcm-subdir-toggle-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // サブフォルダ表示切替チェックボックス
        const subdirCheckbox = document.createElement('input');
        subdirCheckbox.type = 'checkbox';
        const checkboxId = `${tabname}_pcm_subdirs_toggle`;
        subdirCheckbox.id = checkboxId;
        label.htmlFor = checkboxId;
        subdirCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        subdirCheckbox.checked = true;
        subdirCheckbox.addEventListener('change', function() {
            toggleSubdirs(tabname, 'promptcards');
        });
        controlsDiv.insertBefore(subdirCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/** subdir toggle callback */
function toggleSubdirs(tabname, extra_networks_tabname) {
    const checkbox = gradioApp().querySelector(`#${tabname}_pcm_subdirs_toggle`);
    const search = gradioApp().querySelector(`#${tabname}_${extra_networks_tabname}_extra_search`);
    const pcm_search_root = 'prompt_cards';
    
    let currentValue = search.value;
    if (checkbox.checked) {
        if (currentValue.endsWith('$')) {
            search.value = currentValue.slice(0, -1);
        }else{
            search.value = currentValue + '$';
        }
    } else {
        if (!currentValue.endsWith('$')) {
            if (!currentValue) {
                search.value = pcm_search_root + '$';
            } else {
                search.value = currentValue + '$';
            }
        }
    }
    updateInput(search);
}

/* --------------------------------------------------------------------------------------*/

/** dirname toggle checkbox */
const pcmAddDirnameToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_dirname_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'ShowDirName:';
        label.classList.add('pcm-dirname-toggle-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // フォルダ名表示切替チェックボックス
        const dirnameCheckbox = document.createElement('input');
        dirnameCheckbox.type = 'checkbox';
        const checkboxId = `${tabname}_pcm_dirname_toggle`;
        dirnameCheckbox.id = checkboxId;
        label.htmlFor = checkboxId;
        dirnameCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        dirnameCheckbox.checked = false;
        dirnameCheckbox.addEventListener('change', function() {
            _pcmRefreshHideDirName(tabname, 'promptcards');
        });
        controlsDiv.insertBefore(dirnameCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/** dirname toggle callback, also called when refresh btn clicked */
function _pcmRefreshHideDirName(tabname, extra_networks_tabname) {
    const isShow = gradioApp().querySelector(`#${tabname}_pcm_dirname_toggle`).checked;
    const cardNames = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .card .name`);
    for (let cardName of cardNames){
        if (isShow){
            cardName.textContent = cardName.getAttribute('orgname');
        }else{
            cardName.textContent = cardName.getAttribute('basename');
            
        }
    }
}

/* --------------------------------------------------------------------------------------*/

// checkbox 追加 (onUiLoaded では早すぎるため要素を監視)
pcmWaitForContent('.extra-networks-controls-div #txt2img_promptcards_controls', pcmAddSubdirToggleCheckbox);
pcmWaitForContent('.extra-networks-controls-div #txt2img_promptcards_controls', pcmAddDirnameToggleCheckbox);

// HideDirName : refresh btn の callback にも追加
pcmWaitForContent('.tab-nav #txt2img_promptcards_extra_refresh', ()=>{
    gradioApp().querySelector('#txt2img_promptcards_extra_refresh').addEventListener(
        'click', ()=>{_pcmRefreshHideDirName('txt2img', 'promptcards')});
});
pcmWaitForContent('.tab-nav #img2img_promptcards_extra_refresh', ()=>{
    gradioApp().querySelector('#img2img_promptcards_extra_refresh').addEventListener(
        'click', ()=>{_pcmRefreshHideDirName('img2img', 'promptcards')});
});
