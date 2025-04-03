/** for dir button view */
function pcmExtraNetworksSearchButton(tabname, extra_networks_tabname, event) {
    var button = event.target;
    var text = button.classList.contains("search-all") ? "" : button.textContent.trim();

    if(text) {
        text = text.replace(/\\/g, '/');
        
        // SubDirチェックボックスの状態を確認
        var subdirToggleBtn = gradioApp().querySelector(`#${tabname}_pcm_subdirs_toggle`);
        if (subdirToggleBtn && !subdirToggleBtn.classList.contains('enabled') && !text.endsWith('$')) {
            // SubDirにチェックが無い場合は$を付加
            text += '$';
        }
    }
    PcmCardSearch.updateQuery(tabname, "path", text, true); // クエリを更新し、マッチ結果も更新
}