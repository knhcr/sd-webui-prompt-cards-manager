import os
from typing import Callable
def filter_walk(
        dir: str,
        ignore_dot_starts:bool = False,
        filter_d: Callable[[str], bool] = lambda x: True,
        filter_f: Callable[[str], bool] = lambda x: True,
    ) -> list[tuple[str, list[str], list[str]]]:
    '''
    Walk with pruning the search when the filter conditions is not met.
    Always follow symlinks.
    Returns a tupple for each directory (dirpath, dirnames, filenames), same as os.walk().
    If ignore_dot_starts is True, ignore directories and files starting with '.'.
    filter_d is a filtering function for directory, filter_f is for filename.
    Both take a string of basename (not path) and return a boolean.
    '''
    _ret = []
    
    if ignore_dot_starts:
        filter_d_org = filter_d
        filter_d = lambda x: not x.startswith('.') and filter_d_org(x)
        filter_f_org = filter_f
        filter_f = lambda x: not x.startswith('.') and filter_f_org(x)
    
    def _filter_walk(dir, filter_d, filter_f, _ret):
        if not filter_d(os.path.basename(dir)):
            return _ret
        
        ret_dirpath, ret_dirnames, ret_filenames = dir, [], []
        
        with os.scandir(dir) as entries:
            for entry in entries:
                if entry.is_file() and filter_f(entry.name):
                    ret_filenames.append(entry.name)
                elif entry.is_dir() and filter_d(entry.name):
                    ret_dirnames.append(entry.name)
        
        _ret.append((ret_dirpath, ret_dirnames, ret_filenames))
        
        for sub_dir in ret_dirnames:
            _filter_walk(os.path.join(dir, sub_dir), filter_d, filter_f, _ret)
        
        return _ret
    
    return _filter_walk(dir, filter_d, filter_f, _ret)



from pathlib import Path
def safe_join(safe_dir, target_path):
    ''' Same functionality as werkzeug.utils.safe_join() with standard library.
    Check if target_path is under safe_dir, if so, return the absolute path, otherwise return None.
    '''
    safe_path = Path(safe_dir).resolve()
    target_path = Path(target_path)
    
    if not target_path.is_absolute():
        # If target_path is relative, combine it with safe_dir and check
        target_path = safe_path.joinpath(target_path).resolve()
    else:
        # If target_path is absolute, check it directly
        target_path = target_path.resolve()

    safe_path_str = os.path.normpath(str(safe_path))
    target_path_str = os.path.normpath(str(target_path))
    if target_path_str.startswith(safe_path_str + os.path.sep):
        return target_path_str
    else:
        return None



from typing import Any, Callable, Union
import re, unicodedata
def natsort_obj(items: list[Any], key:Callable[[Any], str]=lambda x: x) -> list[Any]:
    ''' natural order sort for list of any objects
    e.g.)
        item1.id = 'foo_001', item3.id = 'foo_03', item2.id = 'foo_2'
        natsort_obj([item1, item3, item2], key=lambda x: x.id) # => [item1, item2, item3]

    Parameters:
        items: list of any objects
        key: function for extracting key string for sorting
    '''
    def _key_func(item: Any) -> list[Union[str, int]]:
        ''' returns splited list of item's key (list of str.lower() or int if it is digit) for sorted()
        'foo_01bar100.txt' -> ['foo_', 1, 'bar', 100, '.txt']
        '''
        key_str = key(item) or ''
        key_str = unicodedata.normalize('NFKC', key_str) # convert 2byte Number to ASCII Number (e.g. １ -> 1)
        main_keys = [
            int(x) if x.isdigit() else x.casefold() # casefold() is lower() for unicode
            for x in re.split(r'(\d+)', key_str) if x # ignore empty string
        ]
        
        # For stable sort add key_str.
        # Comparing "FOO100" and "foo100" 's main_keys is completely the same, so add key_str to distinguish them.
        return [main_keys, key_str]

    return sorted(items, key=_key_func)
