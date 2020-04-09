from flask import Flask, request, jsonify, render_template, Blueprint
from flask_cors import CORS
from threading import Timer
from time import sleep
from datetime import datetime
from absl import logging
import os
import pandas

app = Flask(__name__)
CORS(app)

file_list = {}
source_list_prefix = '../../covid19data/COVID_data_collection/data/'
source_list = {
    'CDC': 'cdc_time_series.csv',  # state
    'CNN': 'cnn_time_series.csv',  # state
    'COVID Tracking Project': 'COVIDTrackingProject_time_series.csv',  # state
    'NY Times': 'NYtimes_time_series.csv',  # state
    'JHU': {
        'country': 'JHU_global_time_series.csv',  # country and province
        'state': 'johns_hopkins_states_time_series.csv',  # state
        'county': 'johns_hopkins_counties_time_series.csv',  # county
    }
}

refresh_interval_hrs = 1
refreshing = False
query_processes = []


def clear_cached_data():
    file_list.clear()


@app.route('/api/v1/allsourcequery')
def all_source_query():
    return jsonify(source_list)


# ----- all countries in world -----
# country level data -> 1) jhu global time series.tsv
# ----- united states only -----
# state level data -> 1) CNN 2) CDC 3) JHU States 4) ny times us states 5) covidtracking states time series
# county level data -> 1) jhu counties time series
@app.route('/api/v1/statquery')
def stat_query():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['node', 'date', 'dsrc']])):
        node = request.args['node'].lower()
        date = request.args['date']
        dsrc = request.args['dsrc']
    else:
        return jsonify(-1)

    logging.info('Processing request...')

    entity_type = select_entity_type(node)
    logging.info('is {}'.format(entity_type))

    if entity_type == 'county':
        node = node.replace(' county', '')
        node = node.replace(' borough', '')
        node = node.replace(' parish', '')
    elif 'province' in entity_type:
        node = '{} - {}'.format(entity_type.split('-')[1], node)
        entity_type = 'province'

    ret = {
        'curnode': {
            'default_stats': get_data_from_source(node, date, dsrc, entity_type),
            'detailed_stats': get_all_data(node, date, entity_type)
        },
        'children': [{
            'name': x,
            'default_stats': get_data_from_source(x, date, dsrc, ('state' if entity_type == 'country' else ('county' if entity_type == 'state' else ('country' if entity_type == 'global' else '-1'))), par=node)
        } for x in get_children(node, entity_type)]
    }

    ret = jsonify(parse_into_arrays(ret))

    query_processes.remove(pid)
    return ret


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
    if entity_type == 'global':
        return [x.lower().strip(' \r\t\n') for x in open(os.path.join(source_list_prefix, 'countries.txt'), 'r') if ' - ' not in x]
    elif entity_type == 'country':
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
    elif entity_type == 'province':
        return []
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
    elif entity_type == 'country':
        return 'global'
    elif entity_type == 'province':
        return node.split(' - ')[0]
    else:
        return -1


def get_data_from_source(node, date, source, entity_type, par=None):
    if entity_type == 'county':
        node = '{}-{}'.format(node, (get_parent(node, entity_type) if par == None else par))

    if entity_type == 'global':
        if source == 'JHU':
            if date in file_list['JHU']['country'][1]:
                res = [0, 0, 0]
                has_na = [False, False, False]
                temp = file_list['JHU']['country'][0].iloc[file_list['JHU']['country'][1][date]]

                for i in range(1, len(temp)):
                    for idx, el in enumerate(temp[i].split('-')):
                        if el.isdigit():
                            res[idx] += int(el)
                        else:
                            has_na[idx] = True

                return '-'.join(['NA' if x == 0 and has_na[i] else str(x) for i, x in enumerate(res)])
            else:
                return []
        else:
            return []
    elif source != "JHU":
        if date in file_list[source][1]:
            try:
                info = file_list[source][0].iloc[file_list[source][1][date], file_list[source][0].columns.get_loc(node)]
            except Exception as _:
                return []
            return info
        else:
            return []
    else:
        if entity_type == 'province':
            entity_type = 'country'

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
# province: contained in either China or Canada list
# country: all other?
def select_entity_type(name):
    def is_state():
        with open(os.path.join(source_list_prefix, 'states.txt'), 'r') as f:
            for line in f:
                if line.lower().strip(' \n\r\t') == name:
                    return True
            return False

    def is_province():
        def prc_file(fname):
            with open(os.path.join(source_list_prefix, fname), 'r') as f:
                states = [x.lower() for x in f.readline().strip(' \r\n\t').split(',')]
                if name in states:
                    return True
            return False

        if prc_file('provinces-china.csv'):
            return 'china'
        elif prc_file('provinces-canada.csv'):
            return 'canada'
        else:
            return None

    if name == 'global':
        return 'global'
    elif any([x in name for x in ['county', 'parish', 'borough']]):
        return 'county'
    elif is_state():
        return 'state'
    else:
        is_prov = is_province()
        if is_prov is None:
            return 'country'
        else:
            return 'province-{}'.format(is_prov)


def get_all_data(node, date, entity_type):
    if entity_type == 'state':
        ret = {}
        for source in ['CDC', 'CNN', 'COVID Tracking Project', 'NY Times', 'JHU']:
            ret[source] = get_data_from_source(node, date, source, entity_type)
        return ret
    else:
        return {'JHU': get_data_from_source(node, date, 'JHU', entity_type)}

def refresh_data_util():
    def prc(v):
        path = os.path.join(source_list_prefix, v)

        delim = ','
        with open(path, 'r') as f:
            if '\t' in f.read():
                delim = '\t'

        logging.info('loading {}'.format(path))

        df = pandas.read_csv(path, sep=delim)
        df.columns = df.columns.str.lower()
        dates = {}
        for i, el in enumerate(df[df.columns[0]]):
            dates[el] = i

        logging.info(dates)

        return (df, dates)

    for key, value in source_list.items():
        if key != 'JHU':
            file_list[key] = prc(value)
        else:
            file_list[key] = {}
            for subkey, subvalue in source_list[key].items():
                file_list[key][subkey] = prc(subvalue)


def refresh_data():
    global refreshing, query_processes

    while len(query_processes) > 0:
        logging.info('waiting to refresh, query_processes={}'.format(query_processes))
        sleep(0.5)

    refreshing = True
    logging.info('{}: starting refresh'.format(datetime.now()))

    clear_cached_data()
    refresh_data_util()

    Timer(int(refresh_interval_hrs * 3600), refresh_data).start()
    logging.info('{}: refresh complete'.format(datetime.now()))

    refreshing = False


if __name__ == "__main__":
    logging.set_verbosity(logging.INFO)
    refresh_data()
    
    app.run(host="0.0.0.0", port="2222", threaded=True, debug=False, use_reloader=False)