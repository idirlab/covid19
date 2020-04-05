from flask import Flask, request, jsonify, render_template, Blueprint
from flask_cors import CORS
import os
import pandas

app = Flask(__name__)
CORS(app)

file_list = {}
source_list_prefix = '../assets/COVID_data_collection/data/'
source_list = {
    'CDC': 'cdc_time_series.csv',  # state
    'CNN': 'cnn_time_series.csv',  # state
    'COVID Tracking Project': 'COVIDTrackingProject_time_series_with_history.csv',  # state
    'NY Times': 'NYtimes_us-states.csv',  # state
    'JHU': {
        'country': 'JHU_global_time_series.csv',  # country
        'state': 'johns_hopkins_states_time_series.csv',  # state
        'county': 'johns_hopkins_counties_time_series.csv',  # county
    }
}


# ----- all countries in world -----
# country level data -> 1) jhu global time series.tsv
# ----- united states only -----
# state level data -> 1) CNN 2) CDC 3) JHU States 4) ny times us states 5) covidtracking states time series
# county level data -> 1) jhu counties time series
@app.route('/api/v1/statquery')
def stat_query():
    if (all([x in request.args for x in ['node', 'date', 'dsrc']])):
        node = request.args['node'].lower()
        date = request.args['date']  # what format?
        dsrc = request.args['dsrc']
    else:
        return jsonify(-1)

    print('Processing request...')

    entity_type = select_entity_type(node)
    print('is {}'.format(entity_type))

    if entity_type == 'county':
        node = node.replace(' county', '')
        node = node.replace(' borough', '')
        node = node.replace(' parish', '')

    ret = {
        'curnode': {
            'default_stats': get_data_from_source(node, date, dsrc, entity_type),
            'detailed_stats': get_all_data(node, date, entity_type)
        },
        'children': [{
            'name': x,
            'default_stats': get_data_from_source(x, date, dsrc, ('state' if entity_type == 'country' else ('county' if entity_type == 'state' else '-1')), par=node)
        } for x in get_children(node, entity_type)]
    }

    ret = parse_into_arrays(ret)

    return jsonify(ret)


def parse_into_arrays(ret):
    def fn(x):
        if not x:
            return []
        return [int(z) if z.isdigit() else -1 for z in x.split('-')]

    ret['curnode']['default_stats'] = fn(ret['curnode']['default_stats'])
    for k, _ in ret['curnode']['detailed_stats'].items():
        ret['curnode']['detailed_stats'][k] = fn(ret['curnode']['detailed_stats'][k])
    for i in range(len(ret['children'])):
        ret['children'][i]['default_stats'] = fn(ret['children'][i]['default_stats'])

    return ret


def get_children(node, entity_type):
    if entity_type == 'country':
        if node == "us":
            return [x.lower().strip(' \t\r\n') for x in open(os.path.join(source_list_prefix, 'states.txt'), 'r')]
        else:
            return []
    elif entity_type == 'state':
        ret = []
        with open(os.path.join(source_list_prefix, 'counties.txt'), 'r') as f:
            for line in f:
                line = line.lower().strip(' \r\t\n')
                if node in line and not line[line.rindex(node) - 2].isdigit():
                    ret.append(line.split(',')[1])
        return ret
    else:
        return []


def get_parent(node, entity_type):
    if entity_type == 'county':
        with open(os.path.join(source_list_prefix, 'counties.txt'), 'r') as f:
            for line in f:
                line = line.lower().strip(' \r\t\n')
                if ',{},'.format(node) in line:
                    return line.split(',')[2]
            return -1
    elif entity_type == 'state':
        return 'us'
    else:
        return -1


def get_data_from_source(node, date, source, entity_type, par=None):
    if entity_type == 'county':
        node = '{}-{}'.format(node, (get_parent(node, entity_type) if par == None else par))

    if source != "JHU":
        if date in file_list[source][1]:
            try:
                info = file_list[source][0].iloc[file_list[source][1][date], file_list[source][0].columns.get_loc(node)]
            except Exception as _:
                return []
            return info
        else:
            return []
    else:
        if date in file_list[source][entity_type][1]:
            try:
                info = file_list[source][entity_type][0].iloc[file_list[source][entity_type][1][date], file_list[source][entity_type][0].columns.get_loc(node)]
            except Exception as _:
                return []
            return info
        else:
            return []


# county: COUNTY, PARISH, BOROUGH
# state: contained in united-states.txt
# country: all other?
def select_entity_type(name):
    def is_state():
        with open(os.path.join(source_list_prefix, 'states.txt'), 'r') as f:
            for line in f:
                if line.lower().strip(' \n\r\t') == name:
                    return True
            return False

    if any([x in name for x in ['county', 'parish', 'borough']]):
        return 'county'
    elif is_state():
        return 'state'
    else:
        return 'country'


def get_all_data(node, date, entity_type):
    ret = {}

    if entity_type == 'country':
        if date in file_list['JHU']['country'][1]:
            info = file_list['JHU']['country'][0].iloc[file_list['JHU']['country'][1][date], file_list['JHU']['country'][0].columns.get_loc(node)]
            ret['JHU'] = info
    elif entity_type == 'state':
        for source in ['CDC', 'CNN', 'COVID Tracking Project']:
            if date in file_list[source][1]:
                info = file_list[source][0].iloc[file_list[source][1][date], file_list[source][0].columns.get_loc(node)]
                ret[source] = info

        if date in file_list['JHU']['state'][1]:
            info = file_list['JHU']['state'][0].iloc[file_list['JHU']['state'][1][date], file_list['JHU']['state'][0].columns.get_loc(node)]
            ret['JHU'] = info

        # NY times sucks, annoying formatting
    else:
        if date in file_list['JHU']['county'][1]:
            col_idx = None
            
            try:
                col_idx = file_list['JHU']['county'][0].columns.get_loc(node)
            except Exception as _:
                col_idx = file_list['JHU']['county'][0].columns.get_loc('{}-{}'.format(node, get_parent(node, entity_type)))

            info = file_list['JHU']['county'][0].iloc[file_list['JHU']['county'][1][date], col_idx]
            ret['JHU'] = info

    return ret


@app.route('/api/v1/allsourcequery')
def all_source_query():
    return jsonify(source_list)


def init_server():
    def prc(v):
        path = os.path.join(source_list_prefix, v)

        delim = ','
        with open(path, 'r') as f:
            if '\t' in f.read():
                delim = '\t'

        df = pandas.read_csv(path, sep=delim)
        df.columns = df.columns.str.lower()
        dates = {}
        for i, el in enumerate(df[df.columns[0]]):
            dates[el] = i

        print(dates)
        
        return (df, dates)

    for key, value in source_list.items():
        if key != 'JHU':
            file_list[key] = prc(value)
        else:
            file_list[key] = {}
            for subkey, subvalue in source_list[key].items():
                file_list[key][subkey] = prc(subvalue)

if __name__ == "__main__":
    init_server()
    app.run(port="2222", threaded=True, debug=False)