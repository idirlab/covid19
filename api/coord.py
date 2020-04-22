import os

source_list_prefix = '../assets/coord/'
coords = {
    "country": {},
    "state": {},

}


def get_coords(key, entity_type):
    return coords[entity_type][key]


def load_coords():
    with open(os.path.join(source_list_prefix, 'country.txt'), 'r') as f:
        for line in f:
            if 'latitude' in line:
                continue
            toks = line.strip(' \t\r\n').split('\t')
            coords['country'][toks[3].lower()] = (float(toks[1]), float(toks[2]))

    with open(os.path.join(source_list_prefix, 'states.txt'), 'r') as f:
        for line in f:
            if 'latitude' in line:
                continue
            toks = line.strip(' \t\r\n').split('\t')
            coords['state'][toks[3].lower()] = (float(toks[1]), float(toks[2]))

    print(coords)