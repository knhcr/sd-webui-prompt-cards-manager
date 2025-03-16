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
