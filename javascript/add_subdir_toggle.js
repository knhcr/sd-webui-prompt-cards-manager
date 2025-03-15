const pcmAddSubdirToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_subdir_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        var label = document.createElement('span');
        label.textContent = 'SubDir:';
        label.classList.add('pcm-subdir-toggle-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // サブフォルダ表示切替チェックボックス
        var subdirCheckbox = document.createElement('input');
        subdirCheckbox.type = 'checkbox';
        subdirCheckbox.id = `${tabname}_pcm_subdirs_toggle`;
        subdirCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        subdirCheckbox.checked = true;
        subdirCheckbox.addEventListener('change', function() {
            // チェック時のスタイル
            /*
            if (this.checked) {
                this.classList.add('checked');
            } else {
                this.classList.remove('checked');
            }*/
            toggleSubdirs(tabname, 'promptcards');
        });
        controlsDiv.insertBefore(subdirCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

// checkbox 追加 (onUiLoaded では早すぎるため要素を監視)
pcmWaitForContent('.extra-networks-controls-div #txt2img_promptcards_controls', pcmAddSubdirToggleCheckbox);

/**
 * サブフォルダ表示切替チェックボックスの変更時に呼び出される
 */
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
